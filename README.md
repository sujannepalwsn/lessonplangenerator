<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3cec993d-cf18-4981-8160-c809796940a4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Install backend dependencies and set environment variables:
   `cd server && npm install`
   Create `server/.env` with `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Run the components (in separate terminals):
   `npm run dev` (Frontend)
   `npm run server` (Backend Agents)

## Hybrid Ingestion System

The app now includes an autonomous PDF ingestion pipeline:
- **Primary:** Gemini 1.5 Flash for intelligent scraping and metadata extraction.
- **Fallback:** Playwright (for bot detection) and Ollama (local LLM) for cost-efficient processing when credits are exhausted.
- **Dashboard:** Real-time tracking of discovery, extraction, and upload progress.
