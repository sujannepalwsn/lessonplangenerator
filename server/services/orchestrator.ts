import { supabase } from '../lib/supabase.js';
import { scrapePDFLinks, scrapePDFLinksWithGemini, PDFLink } from '../agents/scraper.js';
import { downloadPDF, extractMetadataWithOllama, BookMetadata } from '../agents/metadata.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { callAgent } from './multiAgent.js';
import crypto from 'crypto';

function cleanJSON(text: string): string {
  return text.replace(/```json\n?|```/g, '').trim();
}

export async function processSinglePDF(pdfLink: PDFLink, iterationId: string, userKeys: any = {}) {
  let agentType = 'gemini';
  let metadata: BookMetadata | null = null;
  let status = 'processing';
  let errorMsg = '';

  try {
    const pdfBuffer = await downloadPDF(pdfLink.url);
    const pdfHash = crypto.createHash('md5').update(pdfBuffer).digest('hex');

    const geminiKey = userKeys?.gemini || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const activeAI = new GoogleGenerativeAI(geminiKey);
      const model = activeAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Identify Grade, Subject, Title for ${pdfLink.title}. Return JSON {title, subject, class}`;
      const result = await model.generateContent(pdfLink.title);
      const response = await result.response;
      const extracted = JSON.parse(cleanJSON(response.text()));
      metadata = { title: extracted.title, grade: extracted.class, subject: extracted.subject };
    } else {
       metadata = await extractMetadataWithOllama(pdfBuffer, pdfLink.title);
       agentType = 'ollama';
    }

    const storagePath = `${metadata!.grade}/${pdfHash}.pdf`;
    await supabase.storage.from('books').upload(storagePath, pdfBuffer);

    await supabase.from('books').insert({
      title: metadata!.title,
      subject: metadata!.subject,
      class: metadata!.grade,
      file_path: storagePath
    });

    status = 'success';
  } catch (error: any) {
    status = 'failure';
    errorMsg = error.message;
  }
}

export async function runAutonomousIngestion(startUrl: string, userKeys: any = {}) {
  try {
    const { data: iteration } = await supabase.from('iteration_status').insert({ status: 'running' }).select().single();
    const iterationId = iteration.id;
    let links = await scrapePDFLinks(startUrl);

    for (const link of links) {
      await processSinglePDF(link, iterationId, userKeys);
      await new Promise(r => setTimeout(r, 2000));
    }
    await supabase.from('iteration_status').update({ status: 'completed' }).eq('id', iterationId);
  } catch (err) {
    console.error('Ingestion failed:', err);
  }
}
