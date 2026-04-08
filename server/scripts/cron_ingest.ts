import { runAutonomousIngestion } from '../services/orchestrator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error('Usage: tsx scripts/cron_ingest.ts <URL>');
    process.exit(1);
  }

  console.log(`Starting scheduled ingestion for: ${targetUrl}`);
  try {
    await runAutonomousIngestion(targetUrl);
    console.log('Scheduled ingestion completed.');
    process.exit(0);
  } catch (err) {
    console.error('Scheduled ingestion failed:', err);
    process.exit(1);
  }
}

run();
