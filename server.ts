import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/free-agent/metadata", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "Missing PDF data" });
      
      const pdfImport = await import("pdf-parse");
      const pdf = (pdfImport as any).default || pdfImport;
      const buffer = Buffer.from(pdfBase64, "base64");
      const data = await pdf(buffer);
      const text = data.text.substring(0, 5000);

      const titleMatch = text.match(/(?:Title|Book Name):\s*(.*)/i);
      const subjectMatch = text.match(/(?:Subject):\s*(.*)/i);
      const classMatch = text.match(/(?:Class|Grade):\s*(\d+)/i);

      res.json({
        metadata: {
          title: titleMatch ? titleMatch[1].trim() : "Unknown Title",
          subject: subjectMatch ? subjectMatch[1].trim() : "General",
          class: classMatch ? classMatch[1].trim() : "General"
        }
      });
    } catch (error) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: "Failed to extract metadata" });
    }
  });

  // Alias for backward compatibility or other callers
  app.post("/api/extract-metadata", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "Missing PDF data" });
      
      const pdfImport = await import("pdf-parse");
      const pdf = (pdfImport as any).default || pdfImport;
      const buffer = Buffer.from(pdfBase64, "base64");
      const data = await pdf(buffer);
      const text = data.text.substring(0, 5000);

      const titleMatch = text.match(/(?:Title|Book Name):\s*(.*)/i);
      const subjectMatch = text.match(/(?:Subject):\s*(.*)/i);
      const classMatch = text.match(/(?:Class|Grade):\s*(\d+)/i);

      res.json({
        title: titleMatch ? titleMatch[1].trim() : "Unknown Title",
        subject: subjectMatch ? subjectMatch[1].trim() : "General",
        class: classMatch ? classMatch[1].trim() : "General"
      });
    } catch (error) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: "Failed to extract metadata" });
    }
  });

  app.post("/api/free-agent/crawl", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "Missing URL" });

      const axios = (await import("axios")).default;
      const cheerio = await import("cheerio");
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const links: string[] = [];

      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.toLowerCase().endsWith('.pdf')) {
          try {
            const absoluteUrl = new URL(href, url).href;
            links.push(absoluteUrl);
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      res.json({ links: [...new Set(links)] });
    } catch (error) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: "Failed to crawl site" });
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server is listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
