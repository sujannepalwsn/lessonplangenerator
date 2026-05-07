# Autonomous PDF Ingestion Scheduler

To fully automate the PDF discovery and upload process, you can set up a scheduler using **GitHub Actions** or a **Cron Job**.

## Option 1: GitHub Actions (Recommended)

Create a file `.github/workflows/ingest_books.yml` in your repository:

```yaml
name: Daily PDF Ingestion

on:
  schedule:
    - cron: '0 0 * * *' # Runs daily at midnight
  workflow_dispatch: # Allows manual trigger

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Ingestion Agent
        run: |
          curl -X POST "https://your-app-url.run.app/api/free-agent/crawl" \
          -H "Content-Type: application/json" \
          -d '{"url": "https://moecdc.gov.np/en/textbooks"}'
```

## Option 2: Server-Side Cron (Internal)

If you want the server to handle it internally, you can add a `node-cron` task in `server.ts`.

1. Install `node-cron`: `npm install node-cron`
2. Add to `server.ts`:

```typescript
import cron from 'node-cron';

// Run every day at 1 AM
cron.schedule('0 1 * * *', async () => {
  console.log('[Scheduler] Starting autonomous crawl...');
  // Implement the crawl logic here or call the internal API
});
```

## Hybrid Logic Summary

1. **Supervisor** monitors Gemini usage.
2. If Gemini is available, it uses **Gemini 3 Flash** for high-accuracy discovery and metadata.
3. If Gemini is exhausted (429), it automatically switches to the **Free Agent Pipeline**:
   - **Scraper:** Cheerio-based crawler.
   - **Metadata:** PDF text extraction + Heuristic parsing.
4. All data is deduplicated against **Supabase** before storage.
```
