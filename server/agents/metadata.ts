import axios from 'axios';
import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';

export interface BookMetadata {
  title: string;
  grade: string;
  subject: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Download a PDF file from a URL to a local buffer
 */
export async function downloadPDF(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

/**
 * Extract metadata using a local LLM via Ollama API
 */
export async function extractMetadataWithOllama(pdfBuffer: Buffer, filename: string): Promise<BookMetadata> {
  try {
    // Read only the first 1MB for metadata to be efficient
    const metadataBuffer = pdfBuffer.slice(0, 1024 * 1024);
    const data = await pdf(metadataBuffer);
    const textSnippet = data.text.slice(0, 2000); // Send first 2000 characters to the LLM

    console.log(`Asking Ollama for metadata on: ${filename}`);

    const prompt = `
      Identify the Grade/Class, Subject, and a clean Title for this textbook based on its contents and filename.

      Filename: ${filename}
      Content snippet: ${textSnippet}

      Return ONLY a JSON object with:
      {
        "title": "Clean book title",
        "grade": "The grade/class level (e.g. 10, 12, Grade 5)",
        "subject": "The subject (e.g. Mathematics, Science, Nepali)"
      }
      If you can't identify one, use "General" for grade and "Unknown" for subject.
    `;

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
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
    console.error('Ollama metadata extraction error:', error);
    return {
      title: filename.replace('.pdf', ''),
      grade: 'General',
      subject: 'Unknown'
    };
  }
}

/**
 * Extract metadata using a free cloud-based LLM API as a secondary fallback if Ollama is unavailable
 */
export async function extractMetadataWithFreeCloudLLM(pdfBuffer: Buffer, filename: string): Promise<BookMetadata> {
  // Placeholder for another free-tier API like Groq, Mistral, or Gemini-free
  // For now, it will return basic identification from filename
  return {
    title: filename.replace('.pdf', ''),
    grade: 'General',
    subject: 'Unknown'
  };
}
