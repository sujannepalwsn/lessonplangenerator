import { supabase } from '../index.js';
import { scrapePDFLinks, scrapePDFLinksWithGemini, PDFLink } from '../agents/scraper.js';
import { downloadPDF, extractMetadataWithOllama, BookMetadata } from '../agents/metadata.js';
import { GoogleGenAI, Type } from "@google/genai";
import { callAgent } from './multiAgent.js';
import crypto from 'crypto';

// Configuration
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function logToIteration(iterationId: string, logEntry: any) {
  const { data: iteration } = await supabase
    .from('iteration_status')
    .select('logs')
    .eq('id', iterationId)
    .single();

  if (iteration) {
    const logs = Array.isArray(iteration.logs) ? [...iteration.logs, logEntry] : [logEntry];
    await supabase
      .from('iteration_status')
      .update({ logs })
      .eq('id', iterationId);
  }
}

/**
 * Clean Markdown JSON formatting (e.g., ```json ... ```)
 */
function cleanJSON(text: string): string {
  return text.replace(/```json\n?|```/g, '').trim();
}

export async function processSinglePDF(pdfLink: PDFLink, iterationId: string, userKeys: any = {}) {
  let agentType = 'gemini';
  let metadata: BookMetadata | null = null;
  let status = 'processing';
  let errorMsg = '';
  let uploadedUrl = '';

  try {
    // 0. Update queue status to processing
    await supabase.from('scraping_queue').update({ status: 'processing' }).eq('url', pdfLink.url);

    // 1. Download the PDF
    const pdfBuffer = await downloadPDF(pdfLink.url);
    const pdfHash = crypto.createHash('md5').update(pdfBuffer).digest('hex');

    // Check for deduplication by hash OR title
    // Since we don't have a 'hash' column yet, we'll check by file_path suffix which contains the hash
    const { data: existingByPath } = await supabase
      .from('books')
      .select('id')
      .ilike('file_path', `%/${pdfHash}.pdf`)
      .maybeSingle();

    const { data: existingByTitle } = await supabase
      .from('books')
      .select('id')
      .eq('title', pdfLink.title)
      .maybeSingle();

    if (existingByPath || existingByTitle) {
      console.log(`Skipping ${pdfLink.title} as it already exists.`);
      return { status: 'skipped', message: 'Already exists' };
    }

    // 2. Metadata Extraction (Gemini primary)
    try {
      // Limit size to avoid payload issues even internally if needed
      const base64 = pdfBuffer.slice(0, 2 * 1024 * 1024).toString('base64');
      const geminiKey = userKeys?.gemini || process.env.GEMINI_API_KEY || "";
      const activeAI = new GoogleGenAI(geminiKey);

      const prompt = `Identify the Grade/Class, Subject, and a clean Title for this textbook.
      Filename: ${pdfLink.title}.pdf
      Return a JSON object with: { "title": string, "subject": string, "class": string }`;

      const result = await activeAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: prompt }
          ]
        }]
      });

      const extracted = JSON.parse(cleanJSON(result.text || "{}"));
      metadata = { title: extracted.title, grade: extracted.class, subject: extracted.subject };
      agentType = 'gemini';
    } catch (geminiError: any) {
      // Catch Gemini quota or other API errors
      const isRateLimit = geminiError?.status === "RESOURCE_EXHAUSTED" ||
                          geminiError?.message?.includes("429") ||
                          geminiError?.message?.includes("quota");

      if (isRateLimit) {
        console.warn('Gemini quota reached. Falling back to other agents...');
        // Try Groq as secondary
        try {
          const textSnippet = pdfBuffer.slice(0, 2000).toString('utf-8'); // Rough fallback
          const extractedText = await callAgent('groq',
            `Identify Title, Subject, Class for: ${pdfLink.title}. Contents: ${textSnippet}`,
            "Return JSON: {title, subject, class}",
            true,
            userKeys
          );
          const extracted = JSON.parse(extractedText);
          metadata = { title: extracted.title, grade: extracted.class, subject: extracted.subject };
          agentType = 'groq';
        } catch (fallbackErr) {
          metadata = await extractMetadataWithOllama(pdfBuffer, pdfLink.title);
          agentType = 'ollama';
        }
      } else {
        throw geminiError;
      }
    }

    if (!metadata) throw new Error('Failed to extract metadata');

    // 3. Upload to Storage
    const storagePath = `${metadata.grade}/${pdfHash}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(storagePath, pdfBuffer);

    if (uploadError) throw uploadError;
    uploadedUrl = storagePath;

    // 4. Save to DB
    const { data: newBook, error: dbError } = await supabase
      .from('books')
      .insert({
        title: metadata.title,
        subject: metadata.subject,
        class: metadata.grade,
        file_path: storagePath
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 5. Generate Initial Lesson Plan (Goal Requirement)
    try {
      console.log(`Generating initial lesson plan for: ${metadata.title}`);
      const geminiKey = userKeys?.gemini || process.env.GEMINI_API_KEY || "";
      const activeAI = new GoogleGenAI(geminiKey);

      const lpPrompt = `Generate a comprehensive lesson plan for the book: ${metadata.title} (Subject: ${metadata.subject}, Grade: ${metadata.grade}).
      Focus on the first introductory chapter.
      Return as a JSON object matching this schema:
      {
        "subject": string,
        "class": string,
        "lesson_topic": string,
        "objectives": string,
        "warm_up_review": string,
        "teaching_activities": string[],
        "evaluation": string[],
        "class_work": string[],
        "home_assignment": string[]
      }`;

      const lpResult = await activeAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: lpPrompt }] }]
      });
      const lpData = JSON.parse(cleanJSON(lpResult.text || "{}"));

      await supabase.from('lesson_plans').insert({
        ...lpData,
        book_id: newBook.id,
        center_id: '00000000-0000-0000-0000-000000000000',
        teacher_id: '00000000-0000-0000-0000-000000000000',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (lpErr) {
      console.warn('Lesson plan generation failed, but book was ingested:', lpErr);
    }

    status = 'success';
    await supabase.from('scraping_queue').update({ status: 'completed' }).eq('url', pdfLink.url);

  } catch (error: any) {
    status = 'failure';
    errorMsg = error.message;
    console.error(`Error processing ${pdfLink.url}:`, error);
    await supabase.from('scraping_queue').update({ status: 'failed', error_message: errorMsg }).eq('url', pdfLink.url);
  } finally {
    // 5. Log the results
    await supabase.from('agent_logs').insert({
      file_name: pdfLink.title,
      source_url: pdfLink.url,
      uploaded_url: uploadedUrl,
      status: status,
      agent_type: agentType,
      metadata: metadata,
      error_if_any: errorMsg,
      iteration_id: iterationId
    });

    await logToIteration(iterationId, {
      file: pdfLink.title,
      status,
      agent: agentType,
      error: errorMsg
    });
  }
}

export async function runAutonomousIngestion(startUrl: string, userKeys: any = {}) {
  // Create a new iteration
  const { data: iteration, error: iterError } = await supabase
    .from('iteration_status')
    .insert({ status: 'running' })
    .select()
    .single();

  if (!iteration) throw new Error('Failed to start iteration: ' + iterError?.message);
  const iterationId = iteration.id;

  const activeGeminiKey = userKeys?.gemini || apiKey;
  try {
    // 1. Scrape for PDF links
    let links: PDFLink[] = [];
    try {
      links = await scrapePDFLinksWithGemini(startUrl, activeGeminiKey);
    } catch (err) {
      console.warn('Gemini discovery failed, falling back to Playwright/DOM scraper:', err);
      links = await scrapePDFLinks(startUrl);
    }

    // Add links to the queue for visibility
    const queueItems = links.map(l => ({ url: l.url, title: l.title, status: 'pending' }));
    await supabase.from('scraping_queue').upsert(queueItems, { onConflict: 'url' });

    // Update iteration with total count
    await supabase.from('iteration_status').update({ total_files: links.length }).eq('id', iterationId);

    // 2. Process each link one by one
    let processedCount = 0;
    for (const link of links) {
      await processSinglePDF(link, iterationId, userKeys);
      processedCount++;
      await supabase.from('iteration_status').update({ processed_files: processedCount }).eq('id', iterationId);

      // Respect rate-limiting (1-3s as requested)
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    await supabase.from('iteration_status').update({ status: 'completed', end_time: new Date().toISOString() }).eq('id', iterationId);
    console.log('Ingestion completed successfully.');

  } catch (err: any) {
    await supabase.from('iteration_status').update({ status: 'failed', logs: [{ error: err.message }] }).eq('id', iterationId);
    console.error('Autonomous ingestion failed:', err);
  }
}
