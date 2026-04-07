import { chromium } from 'playwright';
import { GoogleGenAI } from "@google/genai";

export interface PDFLink {
  url: string;
  title: string;
}

/**
 * Scrape PDF links using Gemini 3 Flash (Primary)
 */
export async function scrapePDFLinksWithGemini(targetUrl: string, apiKey: string): Promise<PDFLink[]> {
  const ai = new GoogleGenAI({ apiKey });
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // Add extra headers to avoid bot detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    // Retry logic for navigation
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        console.log(`Navigating to ${targetUrl} (Attempt ${attempts + 1}/${maxAttempts})...`);
        await page.goto(targetUrl, {
          waitUntil: 'networkidle', // Wait for full load to bypass some bot checks
          timeout: 45000
        });
        break;
      } catch (e) {
        attempts++;
        if (attempts === maxAttempts) throw e;
        await page.waitForTimeout(2000 * attempts);
      }
    }

    const html = await page.content();
    await browser.close();

    const prompt = `Analyze this HTML and extract all links to PDF files.
    Return a JSON array of objects with "url" and "title" for each PDF link found.
    HTML: ${html.slice(0, 50000)}`; // Basic truncation for context window

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json\n?|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini scraping error:', error);
    throw error;
  }
}

export async function scrapePDFLinks(targetUrl: string): Promise<PDFLink[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${targetUrl} (Playwright Fallback)...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });

    // Intelligent Wait for some dynamic content
    await page.waitForTimeout(2000);

    // Extract PDF links
    const links: PDFLink[] = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .filter(a => a.href.toLowerCase().endsWith('.pdf'))
        .map(a => ({
          url: a.href,
          title: a.innerText.trim() || a.getAttribute('title') || 'Untitled PDF'
        }));
    });

    console.log(`Found ${links.length} PDF links.`);
    return links;
  } catch (error) {
    console.error(`Scraping error for ${targetUrl}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Fallback DOM parser using a lighter fetch approach if Playwright fails or is not needed
 */
export async function fallbackDOMParser(targetUrl: string): Promise<PDFLink[]> {
  try {
    const response = await fetch(targetUrl);
    const html = await response.text();

    // Simple regex for PDF links as a last resort
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
