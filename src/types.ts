export interface Book {
  id?: string;
  title: string;
  subject: string;
  class: string;
  file_path?: string;
  created_at?: string;
}

export interface BookContent {
  id?: string;
  book_id: string;
  unit: string;
  chapter?: string;
  lesson: string;
  topic: string;
  sub_topic?: string;
  content: string;
  goals: string;
  created_at?: string;
}

export interface LessonPlan {
  id?: string;
  center_id?: string;
  teacher_id?: string;
  book_content_id?: string;
  class: string;
  section?: string;
  subject: string;
  topic: string;
  chapter?: string;
  objectives?: string;
  content?: string;
  planned_date?: string;
  status?: string;
  grade?: string;
  lesson_date?: string;
  lesson_file_url?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
  period?: string;
  warm_up_review?: string;
  learning_activities?: string[];
  evaluation_activities?: string[];
  class_work?: string;
  home_assignment?: string;
  principal_remarks?: string;
  approved_by?: string;
  approval_date?: string;
  admin_notes?: string;
  title?: string;
  description?: string;
  submitted_at?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}
