import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { runAutonomousIngestion } from './services/orchestrator.js';
import { callAgent, AgentType } from './services/multiAgent.js';
import { GoogleGenAI } from "@google/genai";
import pdf from 'pdf-parse';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
export const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    supabaseConnected: !!supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co'
  });
});

app.post('/api/chat', async (req, res) => {
  const { prompt, system, agent, jsonMode, pdfBase64, pdfPath, pdfPaths, userKeys } = req.body;
  try {
    let textContext = "";

    // Handle multiple PDF paths (for Exam Generator)
    const activePaths = pdfPaths || (pdfPath ? [pdfPath] : []);

    if (activePaths.length > 0) {
      for (const path of activePaths) {
        const { data, error } = await supabase.storage.from('books').download(path);
        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          const pdfData = await pdf(buffer);
          textContext += `\n--- SOURCE: ${path} ---\n${pdfData.text}\n`;
        }
      }
    } else if (pdfBase64) {
      const buffer = Buffer.from(pdfBase64, 'base64');
      const pdfData = await pdf(buffer);
      textContext = pdfData.text;
    }

    const finalPrompt = textContext
      ? `CONTEXT FROM PDF:\n${textContext.slice(0, 30000)}\n\nUSER PROMPT: ${prompt}`
      : prompt;

    const response = await callAgent(agent as AgentType, finalPrompt, system, jsonMode, userKeys);
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze/toc', async (req, res) => {
  const { pdfPath, userKeys } = req.body;
  if (!pdfPath) return res.status(400).json({ error: 'PDF Path is required' });

  try {
    const { data, error: downloadError } = await supabase.storage.from('books').download(pdfPath);
    if (downloadError || !data) throw new Error('Failed to download PDF');

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdf(buffer);
    const fullText = pdfData.text;

    const tocPrompt = `Extract the Table of Contents from this textbook text.
    Identify every Unit, Chapter, and Lesson.
    Return a JSON array of objects: { "unit": string, "chapter": string, "lesson": string, "topic": string }`;

    const tocResponse = await callAgent('gemini', fullText.slice(0, 50000), tocPrompt, true, userKeys);
    const toc = JSON.parse(tocResponse);

    res.json({ toc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze/topic', async (req, res) => {
  const { bookId, pdfPath, tocItem, userKeys } = req.body;
  if (!bookId || !pdfPath || !tocItem) return res.status(400).json({ error: 'Missing required parameters' });

  try {
    const { data, error: downloadError } = await supabase.storage.from('books').download(pdfPath);
    if (downloadError || !data) throw new Error('Failed to download PDF');

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdf(buffer);
    const fullText = pdfData.text;

    const detailPrompt = `Extract micro-details for: Unit: ${tocItem.unit}, Lesson: ${tocItem.lesson}, Topic: ${tocItem.topic}.
    Capture:
    - full_content (detailed explanation)
    - goals (learning outcomes)
    - key_points (array)
    - examples (array)
    - formulas (array)
    Return as JSON.`;

    const detailResponse = await callAgent('gemini', fullText, detailPrompt, true, userKeys);
    const details = JSON.parse(detailResponse);

    const content = { ...tocItem, ...details, book_id: bookId };

    // Save/Update to Supabase
    const { error: insertError } = await supabase.from('book_contents').upsert([content], { onConflict: 'book_id,topic' });
    if (insertError) throw insertError;

    res.json({ success: true, content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Basic structure for agent endpoints
app.post('/api/autonomous/start', async (req, res) => {
  const { url, userKeys } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Trigger ingestion in background
  runAutonomousIngestion(url, userKeys).catch(console.error);

  res.json({ message: 'Autonomous ingestion started in background', url });
});

app.get('/api/autonomous/status', async (req, res) => {
  try {
    // Return the most recent iteration status
    const { data: iterations, error } = await supabase
      .from('iteration_status')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1);

    if (error) throw error;

    const currentIteration = iterations?.[0] || null;

    // Get recent logs as well
    const { data: logs } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('iteration_id', currentIteration?.id)
      .order('created_at', { ascending: false });

    res.json({
      status: currentIteration?.status || 'idle',
      iteration: currentIteration,
      logs: logs || []
    });
  } catch (err: any) {
    // Fallback for when tables don't exist yet or config is missing
    res.json({ status: 'idle', iteration: null, logs: [], note: err.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
  });
}

export default app;
