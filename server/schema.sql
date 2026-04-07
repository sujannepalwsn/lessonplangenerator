-- Enable pgcrypto for generating UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Scraping Queue Table
CREATE TABLE IF NOT EXISTS scraping_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Logs Table for structured output
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  source_url TEXT,
  uploaded_url TEXT,
  status TEXT, -- success, failure, fallback_used
  agent_type TEXT, -- gemini, free-agent
  metadata JSONB,
  error_if_any TEXT,
  iteration_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Iteration Status Table to track overall autonomous runs
CREATE TABLE IF NOT EXISTS iteration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running', -- running, completed, interrupted
  logs JSONB DEFAULT '[]'::jsonb
);

-- RLS (Row Level Security) - Basic open policies for testing
-- In a real app, these should be restricted to authenticated users or a specific role
ALTER TABLE scraping_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to scraping_queue" ON scraping_queue FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to agent_logs" ON agent_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE iteration_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to iteration_status" ON iteration_status FOR ALL USING (true) WITH CHECK (true);
