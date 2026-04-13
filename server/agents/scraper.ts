import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PDFLink {
  url: string;
  title: string;
}

/**
 * Scrape PDF links using Gemini 1.5 Flash (Primary)
 * Uses dynamic import for playwright to prevent issues in serverless environments
 */
export async function scrapePDFLinksWithGemini(targetUrl: string, apiKey: string): Promise<PDFLink[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { chromium } = await import('playwright').catch(() => ({ chromium: null }));
    if (!chromium) throw new Error("Scraping unavailable in this environment (Playwright missing)");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      console.log(`Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const html = await page.content();
      await browser.close();

      const prompt = `Analyze this HTML and extract all links to PDF files.
      Return ONLY a JSON array of objects with "url" and "title" for each PDF link found.
      HTML: ${html.slice(0, 30000)}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```json\n?|```/g, '').trim();
      return JSON.parse(text);
    } finally {
      if (browser) await browser.close();
    }
  } catch (error) {
    console.error('Gemini scraping error:', error);
    throw error;
  }
}

export async function scrapePDFLinks(targetUrl: string): Promise<PDFLink[]> {
  try {
    const { chromium } = await import('playwright').catch(() => ({ chromium: null }));
    if (!chromium) return fallbackDOMParser(targetUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      console.log(`Navigating to ${targetUrl} (Playwright Fallback)...`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const links: PDFLink[] = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
          .filter(a => a.href.toLowerCase().endsWith('.pdf'))
          .map(a => ({
            url: a.href,
            title: a.innerText.trim() || a.getAttribute('title') || 'Untitled PDF'
          }));
      });

      return links;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(`Scraping error for ${targetUrl}:`, error);
    return fallbackDOMParser(targetUrl);
  }
}

/**
 * Fallback DOM parser using a lighter fetch approach
 */
export async function fallbackDOMParser(targetUrl: string): Promise<PDFLink[]> {
  try {
    const response = await fetch(targetUrl);
    const html = await response.text();

    const pdfRegex = /href="([^"]+\.pdf)"/gi;
    const links: PDFLink[] = [];
    let match;

    while ((match = pdfRegex.exec(html)) !== null) {
      const url = new URL(match[1], targetUrl).toString();
      links.push({ url, title: 'Discovered PDF' });
    }

    return links;
  } catch (error) {
    console.error(`Fallback DOM parser error for ${targetUrl}:`, error);
    return [];
  }
}
