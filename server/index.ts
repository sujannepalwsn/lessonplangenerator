import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdf from 'pdf-parse';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Robust helper to call Gemini with a custom key or environment key
 */
async function callGeminiBackend(params: {
  prompt: string,
  system?: string,
  jsonMode?: boolean,
  apiKey?: string,
  textContext?: string
}) {
  const finalKey = params.apiKey || process.env.GEMINI_API_KEY;
  if (!finalKey) throw new Error("No Gemini API Key provided. Please set it in Settings.");

  const genAI = new GoogleGenerativeAI(finalKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: params.system
  });

  const fullPrompt = params.textContext
    ? `CONTEXT FROM TEXTBOOK:\n${params.textContext}\n\nUSER REQUEST:\n${params.prompt}`
    : params.prompt;

  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  let text = response.text();

  if (params.jsonMode) {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];
    else text = text.replace(/```json\n?|```/g, '').trim();
  }
  return text;
}

app.post('/api/chat', async (req, res) => {
  const { prompt, system, agent, jsonMode, pdfBase64, pdfPath, pdfPaths, userKeys } = req.body;
  try {
    let textContext = "";
    const activePaths = pdfPaths || (pdfPath ? [pdfPath] : []);

    if (activePaths.length > 0) {
      for (const path of activePaths) {
        try {
          const { data, error } = await supabase.storage.from('books').download(path);
          if (!error && data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            const pdfData = await pdf(buffer);
            textContext += `\n--- SOURCE: ${path} ---\n${pdfData.text}\n`;
          }
        } catch (e) {
          console.error(`Error parsing PDF at ${path}:`, e);
        }
      }
    } else if (pdfBase64) {
      const buffer = Buffer.from(pdfBase64, 'base64');
      const pdfData = await pdf(buffer);
      textContext = pdfData.text;
    }

    const response = await callGeminiBackend({
      prompt, system, jsonMode,
      apiKey: userKeys?.gemini,
      textContext: textContext.slice(0, 40000)
    });

    res.json({ response });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze/toc', async (req, res) => {
  const { pdfPath, userKeys } = req.body;
  if (!pdfPath) return res.status(400).json({ error: 'PDF Path is required' });

  try {
    const { data, error: downloadError } = await supabase.storage.from('books').download(pdfPath);
    if (downloadError || !data) throw new Error('Failed to download PDF from storage');

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdf(buffer);
    const fullText = pdfData.text;

    const tocPrompt = `Extract the Table of Contents from this textbook.
    Identify every Unit, Chapter, and Lesson.
    Return ONLY a JSON array of objects: [{ "unit": string, "chapter": string, "lesson": string, "topic": string }]`;

    const response = await callGeminiBackend({
      prompt: tocPrompt,
      textContext: fullText.slice(0, 100000),
      jsonMode: true,
      apiKey: userKeys?.gemini
    });

    res.json({ toc: JSON.parse(response) });
  } catch (error: any) {
    console.error("TOC error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze/topic', async (req, res) => {
  const { bookId, pdfPath, tocItem, userKeys } = req.body;
  if (!bookId || !pdfPath || !tocItem) return res.status(400).json({ error: 'Missing parameters' });

  try {
    const { data, error: downloadError } = await supabase.storage.from('books').download(pdfPath);
    if (downloadError || !data) throw new Error('Failed to download PDF');

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdf(buffer);

    const detailPrompt = `Extract detailed content for: Unit: ${tocItem.unit}, Topic: ${tocItem.topic}.
    Capture:
    - full_content (detailed explanation)
    - goals (learning outcomes)
    - key_points (array)
    - examples (array)
    - formulas (array)
    Return as JSON.`;

    const response = await callGeminiBackend({
      prompt: detailPrompt,
      textContext: pdfData.text,
      jsonMode: true,
      apiKey: userKeys?.gemini
    });

    const details = JSON.parse(response);
    const content = { ...tocItem, ...details, book_id: bookId };

    await supabase.from('book_contents').upsert([content], { onConflict: 'book_id,topic' });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Topic error:", error);
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
  });
}

export default app;
