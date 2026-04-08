-- Books Table
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  class TEXT,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unified Book Contents Table
CREATE TABLE IF NOT EXISTS book_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  unit TEXT,
  chapter TEXT,
  lesson TEXT,
  topic TEXT,
  sub_topic TEXT,
  content TEXT, -- Summary for lesson planning
  full_content TEXT, -- Detailed content for reader
  goals TEXT,
  key_points JSONB,
  examples JSONB,
  formulas JSONB,
  page_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lesson Plans Table
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_content_id UUID REFERENCES book_contents(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  subject TEXT,
  class TEXT,
  unit TEXT,
  chapter TEXT,
  period TEXT,
  lesson_topic TEXT,
  date TEXT,
  learning_outcomes TEXT,
  warm_up_review TEXT,
  teaching_activities JSONB,
  evaluation JSONB,
  class_work JSONB,
  home_assignment JSONB,
  remarks TEXT,
  principal_remarks TEXT,
  center_id UUID,
  teacher_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDC Specification Grids
CREATE TABLE IF NOT EXISTS cdc_grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  class TEXT,
  file_path TEXT,
  analyzed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question Samples
CREATE TABLE IF NOT EXISTS question_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  class TEXT,
  file_path TEXT,
  analyzed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions Pool (MCQs and others)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  book_content_id UUID REFERENCES book_contents(id) ON DELETE CASCADE,
  type TEXT, -- mcq, short, long, fill_in_the_blanks
  question_text TEXT NOT NULL,
  options JSONB, -- For MCQs
  correct_answer TEXT,
  difficulty TEXT, -- easy, medium, hard
  bloom_level TEXT, -- knowledge, understanding, application, etc.
  marks INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Papers
CREATE TABLE IF NOT EXISTS exam_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  class TEXT,
  duration_minutes INTEGER,
  total_marks INTEGER,
  format_settings JSONB,
  questions JSONB, -- Ordered list of question IDs or full question data
  file_path TEXT, -- Optional stored PDF
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to books" ON books FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE book_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to book_contents" ON book_contents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to lesson_plans" ON lesson_plans FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE cdc_grids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to cdc_grids" ON cdc_grids FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE question_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to question_samples" ON question_samples FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to questions" ON questions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to exam_papers" ON exam_papers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scraping_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to scraping_queue" ON scraping_queue FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to agent_logs" ON agent_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE iteration_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to iteration_status" ON iteration_status FOR ALL USING (true) WITH CHECK (true);
