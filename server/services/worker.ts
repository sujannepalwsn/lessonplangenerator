import { supabase } from '../lib/supabase.js';
import { parsePdfToMarkdown } from './pdfParser.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import fs from 'fs';

const GEMINI_RPM_LIMIT = 15;
const THROTTLE_MS = (60 * 1000) / GEMINI_RPM_LIMIT;

function cleanJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : text.replace(/```json\n?|```/g, '').trim();
}

async function getEmbeddings(text: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function processQueueItem(queueItem: any, userKeys: any = {}) {
  const apiKey = userKeys?.gemini || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    await supabase.from('ingestion_queue').update({ status: 'processing', updated_at: new Date() }).eq('id', queueItem.id);

    const { data: book } = await supabase.from('books').select('*').eq('id', queueItem.book_id).single();
    if (!book) throw new Error("Book not found");

    // 1. Download PDF from Storage
    const { data: pdfBuffer, error: dlError } = await supabase.storage.from('books').download(book.file_path);
    if (dlError || !pdfBuffer) throw new Error(`Failed to download PDF: ${dlError?.message}`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, `${book.hash}.pdf`);
    fs.writeFileSync(tempPath, Buffer.from(await pdfBuffer.arrayBuffer()));

    // 2. Convert to Markdown
    const markdown = await parsePdfToMarkdown(tempPath);
    fs.unlinkSync(tempPath);

    // 3. Extract TOC
    const tocPrompt = `You are a curriculum architect. Analyze the provided textbook Table of Contents (Markdown).
    Your task is to decompose the book into its structural components: Units, Chapters, and Lessons/Topics.

    Rules:
    1. Identify the hierarchy: Unit > Chapter > Lesson.
    2. If a level is missing, use the parent's title or a logical grouping.
    3. Ensure 'topic' is the most granular level (usually the Lesson title).
    4. Return ONLY a JSON array of objects.

    Output Format:
    [{"unit": "Unit Title", "chapter": "Chapter Title", "lesson": "Lesson Title", "topic": "Specific Topic"}]

    TOC MARKDOWN CONTENT:
    ${markdown.slice(0, 30000)}`;

    const tocResult = await model.generateContent(tocPrompt);
    const toc = JSON.parse(cleanJSON((await tocResult.response).text()));

    // 4. Process each TOC item (Iterative deep extraction)
    for (const item of toc) {
      const topicPrompt = `You are an expert academic content extractor. Your goal is to extract the complete educational content for a specific topic from the textbook markdown.

      TARGET TOPIC:
      Unit: ${item.unit}
      Chapter: ${item.chapter}
      Lesson: ${item.lesson || item.topic}

      CONTEXT:
      Below is the textbook content in Markdown. Find the section matching the Target Topic and extract the details.

      TEXTBOOK MARKDOWN:
      ${markdown.slice(0, 500000)}

      INSTRUCTIONS:
      1. 'full_content': Extract the verbatim academic text, including definitions, explanations, and key details. Use Markdown.
      2. 'content': Provide a 2-3 paragraph instructional summary of the topic.
      3. 'goals': List the specific behavioral learning objectives (e.g., "Students will be able to...").
      4. 'key_points': A JSON array of the most important concepts/takeaways.
      5. 'examples': A JSON array of illustrative examples or word problems found in the text.
      6. 'formulas': A JSON array of any mathematical or scientific formulas mentioned.

      Return ONLY valid JSON.`;

      const topicResult = await model.generateContent(topicPrompt);
      const details = JSON.parse(cleanJSON((await topicResult.response).text()));

      // 5. Generate Embedding
      const embedding = await getEmbeddings(details.full_content, apiKey);

      // Update progress log
      await supabase.from('agent_logs').insert({
        file_name: book.title,
        status: 'processing',
        agent_type: 'gemini',
        metadata: { topic: item.topic || item.lesson, unit: item.unit },
        iteration_id: queueItem.iteration_id // We should probably pass this through the queue
      }).catch(() => {});

      // 6. Save to book_contents
      await supabase.from('book_contents').insert({
        book_id: book.id,
        unit: item.unit,
        chapter: item.chapter,
        lesson: item.lesson,
        topic: item.topic || item.lesson,
        content: details.content,
        full_content: details.full_content,
        goals: details.goals,
        key_points: details.key_points,
        examples: details.examples,
        formulas: details.formulas,
        embedding: embedding
      });

      // Throttle between topics to respect RPM
      await new Promise(r => setTimeout(r, THROTTLE_MS));
    }

    await supabase.from('ingestion_queue').update({ status: 'completed', updated_at: new Date() }).eq('id', queueItem.id);
  } catch (error: any) {
    console.error(`Worker error for book ${queueItem.book_id}:`, error);
    await supabase.from('ingestion_queue').update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date()
    }).eq('id', queueItem.id);
  }
}

export async function startWorker() {
  console.log("Background worker started...");
  while (true) {
    const { data: queueItems } = await supabase
      .from('ingestion_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .limit(1);

    if (queueItems && queueItems.length > 0) {
      await processQueueItem(queueItems[0]);
    } else {
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}
