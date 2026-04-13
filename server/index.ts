import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

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
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
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
  if (!finalKey) {
    throw new Error("Gemini API Key is missing. Please provide one in the Settings tab.");
  }

  try {
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
      // Improved JSON extraction regex
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        text = jsonMatch[0];
      } else {
        text = text.replace(/```json\n?|```/g, '').trim();
      }
    }
    return text;
  } catch (err: any) {
    if (err.message?.includes("403")) {
      throw new Error("The API key provided is invalid or does not have permission. Please check your Settings.");
    }
    throw err;
  }
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
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');
        const pdfData = await pdf(buffer);
        textContext = pdfData.text;
      } catch (e) {
        console.error("Error parsing base64 PDF:", e);
      }
    }

    // RAG Integration: If no PDF is provided but we have a bookId, search vector DB
    let ragContext = textContext;
    if (!ragContext && req.body.bookId) {
      const genAI = new GoogleGenerativeAI(userKeys?.gemini || process.env.GEMINI_API_KEY!);
      const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const embeddingResult = await embedModel.embedContent(prompt);
      const embedding = embeddingResult.embedding.values;

      const { data: matches, error: matchError } = await supabase.rpc('match_book_contents', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
        filter_book_id: req.body.bookId
      });

      if (!matchError && matches) {
        ragContext = matches.map((m: any) => `[Topic: ${m.topic}]\n${m.content}`).join('\n\n');
      }
    }

    // Include CDC Grid if applicable
    if (req.body.subject && req.body.grade) {
      const { data: grid } = await supabase
        .from('cdc_grids')
        .select('analyzed_data')
        .eq('subject', req.body.subject)
        .eq('class', req.body.grade)
        .maybeSingle();

      if (grid) {
        ragContext = `CURRICULUM STANDARDS (CDC GRID):\n${JSON.stringify(grid.analyzed_data)}\n\n${ragContext}`;
      }
    }

    const response = await callGeminiBackend({
      prompt, system, jsonMode,
      apiKey: userKeys?.gemini,
      textContext: ragContext.slice(0, 80000)
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
    if (downloadError || !data) throw new Error('Failed to download PDF from storage. Check if file exists.');

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdf(buffer);
    const fullText = pdfData.text;

    const tocPrompt = `Extract the full Table of Contents from this textbook text.
    Identify every Unit, Chapter, and Lesson.
    Return ONLY a valid JSON array of objects: [{ "unit": string, "chapter": string, "lesson": string, "topic": string }]`;

    const response = await callGeminiBackend({
      prompt: tocPrompt,
      textContext: fullText.slice(0, 80000),
      jsonMode: true,
      apiKey: userKeys?.gemini
    });

    res.json({ toc: JSON.parse(response) });
  } catch (error: any) {
    console.error("TOC error:", error);
    res.status(500).json({ error: error.message || "Unknown error during TOC extraction" });
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

    const detailPrompt = `You are an expert academic analyzer. Extract detailed content for the following section from this textbook text.

    SECTION:
    Unit: ${tocItem.unit}
    Lesson/Topic: ${tocItem.topic}

    REQUIREMENTS:
    1. full_content: Capture the detailed academic text.
    2. goals: Specific learning outcomes.
    3. key_points: Array of takeaways.
    4. examples: Array of illustrative examples.
    5. formulas: Array of formulas if applicable.
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

app.get('/api/autonomous/status', async (req, res) => {
  const { data: iteration } = await supabase
    .from('iteration_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: logs } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('iteration_id', iteration?.id)
    .order('created_at', { ascending: false })
    .limit(20);

  res.json({
    status: iteration?.status || 'idle',
    iteration: iteration,
    logs: logs || []
  });
});

app.post('/api/autonomous/start', async (req, res) => {
  const { url, userKeys } = req.body;
  const { runAutonomousIngestion } = await import('./services/orchestrator.js');

  // Start ingestion in the background
  runAutonomousIngestion(url, userKeys).catch(console.error);

  res.json({ message: 'Autonomous ingestion started' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, async () => {
    console.log(`Backend server running on http://localhost:${port}`);

    // Start the background worker
    const { startWorker } = await import('./services/worker.js');
    startWorker().catch(err => console.error("Worker failed to start:", err));
  });
}

export default app;
