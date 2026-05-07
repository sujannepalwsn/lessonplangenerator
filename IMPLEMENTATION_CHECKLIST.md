# Implementation Checklist: Hybrid PDF Ingestion Pipeline

## 1. Discovery Agent (Scraping)
- [ ] Implement `SupervisorAgent` to monitor Gemini usage. (Done)
- [ ] Implement `FreeAgentScraper` (using `cheerio` + `axios` for basic scraping).
- [ ] Integrate fallback logic in discovery service.
- [ ] Implement rate limiting (1-3 sec).

## 2. Metadata Agent (Identification)
- [x] Implement `FreeAgentMetadataExtractor` (using `pdf-parse` + rule-based extraction). (Done)
- [x] Ensure JSON output matches DB schema `{title, grade, subject}`. (Done)
- [x] Integrate fallback logic in metadata service. (Done)

## 3. Storage & Database Integration
- [ ] Update upload service to handle fallback metadata.
- [ ] Ensure deduplication works in fallback mode.
- [ ] Implement logging for success/failure.

## 4. Orchestration & Automation
- [x] Implement `SupervisorAgent` logic for switching. (Done)
- [ ] Automatic switch to free agents if credits exhausted
- [ ] Maintain role sequence: `Crawler → PDF Extractor → Metadata Extractor → Upload → Supervisor`
- [ ] Scheduler setup (cron / GitHub Actions)
- [ ] Error handling & retry logic

## 5. Final Testing & Validation
- [ ] Test multiple URLs in both Gemini & free-agent modes
- [ ] Verify PDFs discovered correctly
- [ ] Check metadata accuracy in Supabase DB
- [ ] Ensure deduplication works
- [ ] Confirm PDFs uploaded correctly to storage
- [ ] Monitor fallback switching works automatically
