import { supabase } from '../lib/supabase.js';
import { scrapePDFLinks } from '../agents/scraper.js';
import { downloadAndParse, isDuplicate } from './pdfParser.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

function cleanJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : text.replace(/```json\n?|```/g, '').trim();
}

export async function runAutonomousIngestion(startUrl: string, userKeys: any = {}) {
  const apiKey = userKeys?.gemini || process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { data: iteration } = await supabase.from('iteration_status').insert({ status: 'running' }).select().single();
    const links = await scrapePDFLinks(startUrl);

    await supabase.from('iteration_status').update({ total_files: links.length }).eq('id', iteration.id);

    for (const link of links) {
      try {
        // 1. Download and check hash
        const response = await fetch(link.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        const { data: existing } = await supabase.from('books').select('id').eq('hash', hash).maybeSingle();
        if (existing) {
           await supabase.from('agent_logs').insert({
             file_name: link.title,
             source_url: link.url,
             status: 'skipped',
             metadata: { reason: 'Duplicate hash' },
             iteration_id: iteration.id
           });
           continue;
        }

        // 2. Extract Metadata (Basic)
        const prompt = `Identify Grade, Subject, Title for "${link.title}". Return JSON {title, subject, class}`;
        const result = await model.generateContent(prompt);
        const extracted = JSON.parse(cleanJSON((await result.response).text()));

        // 3. Upload to Storage
        const storagePath = `${extracted.class}/${hash}.pdf`;
        await supabase.storage.from('books').upload(storagePath, buffer);

        // 4. Create Book Record
        const { data: book } = await supabase.from('books').insert({
          title: extracted.title,
          subject: extracted.subject,
          class: extracted.class,
          file_path: storagePath,
          hash: hash
        }).select().single();

        // 5. Queue for processing
        await supabase.from('ingestion_queue').insert({
          book_id: book.id,
          iteration_id: iteration.id,
          status: 'pending'
        });

        await supabase.from('agent_logs').insert({
          file_name: link.title,
          source_url: link.url,
          status: 'success',
          iteration_id: iteration.id
        });

      } catch (err: any) {
        await supabase.from('agent_logs').insert({
          file_name: link.title,
          source_url: link.url,
          status: 'failure',
          error_if_any: err.message,
          iteration_id: iteration.id
        });
      }

      const { data: currentIter } = await supabase.from('iteration_status').select('processed_files').eq('id', iteration.id).single();
      await supabase.from('iteration_status').update({ processed_files: (currentIter?.processed_files || 0) + 1 }).eq('id', iteration.id);
    }

    await supabase.from('iteration_status').update({ status: 'completed', end_time: new Date() }).eq('id', iteration.id);
  } catch (err) {
    console.error('Ingestion failed:', err);
  }
}
