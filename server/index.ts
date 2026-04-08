import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { runAutonomousIngestion } from './services/orchestrator.js';
import { callAgent, AgentType } from './services/multiAgent.js';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
export const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    supabaseConnected: !!supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co'
  });
});

app.post('/api/chat', async (req, res) => {
  const { prompt, system, agent, jsonMode, pdfBase64, userKeys } = req.body;
  try {
    // If PDF is provided, we currently only support Gemini for multimodal
    if (pdfBase64) {
      const geminiKey = userKeys?.gemini || process.env.GEMINI_API_KEY || "";
      const activeAI = new GoogleGenAI(geminiKey);
      const model = activeAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: (system ? system + "\n\n" : "") + prompt }
      ]);
      const response = await result.response;
      let text = response.text();
      if (jsonMode) text = text.replace(/```json\n?|```/g, '').trim();
      return res.json({ response: text });
    }

    const response = await callAgent(agent as AgentType, prompt, system, jsonMode, userKeys);
    res.json({ response });
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

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
