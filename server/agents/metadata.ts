import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

export interface BookMetadata {
  title: string;
  grade: string;
  subject: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

export async function downloadPDF(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

export async function extractMetadataWithOllama(pdfBuffer: Buffer, filename: string, customUrl?: string): Promise<BookMetadata> {
  try {
    const metadataBuffer = pdfBuffer.slice(0, 1024 * 1024);
    const data = await pdf(metadataBuffer);
    const textSnippet = data.text.slice(0, 2000);

    const activeUrl = customUrl || OLLAMA_URL;
    const prompt = `Identify Grade/Class, Subject, and Title for: ${filename}. Snippet: ${textSnippet}. Return ONLY JSON {title, grade, subject}`;

    const response = await axios.post(`${activeUrl}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json'
    });

    const metadata = JSON.parse(response.data.response);
    return {
      title: metadata.title || filename.replace('.pdf', ''),
      grade: metadata.grade || 'General',
      subject: metadata.subject || 'Unknown'
    };
  } catch (error) {
    return { title: filename.replace('.pdf', ''), grade: 'General', subject: 'Unknown' };
  }
}
