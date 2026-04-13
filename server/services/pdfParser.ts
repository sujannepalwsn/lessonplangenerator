import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';

const execPromise = promisify(exec);

export async function computeFileHash(buffer: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function isDuplicate(hash: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('books')
    .select('id')
    .eq('hash', hash)
    .maybeSingle();

  return !!data;
}

export async function parsePdfToMarkdown(pdfPath: string): Promise<string> {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_to_markdown.py');
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath} "${pdfPath}"`);

    if (stderr && !stdout) {
      throw new Error(`Python script error: ${stderr}`);
    }

    return stdout;
  } catch (error: any) {
    console.error('Error in parsePdfToMarkdown:', error);
    throw error;
  }
}

export async function downloadAndParse(pdfUrl: string): Promise<{ markdown: string, hash: string, buffer: Buffer }> {
  const response = await fetch(pdfUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = await computeFileHash(buffer);

  const tempPath = path.join(process.cwd(), 'temp', `${hash}.pdf`);
  fs.writeFileSync(tempPath, buffer);

  try {
    const markdown = await parsePdfToMarkdown(tempPath);
    return { markdown, hash, buffer };
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
