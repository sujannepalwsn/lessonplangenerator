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

export interface BookReaderContent {
  id?: string;
  book_id: string;
  unit: string;
  chapter?: string;
  lesson: string;
  topic: string;
  sub_topic?: string;
  full_content: string; // High-fidelity content for the reader
  key_points: string[];
  examples: string[];
  formulas?: string[];
  created_at?: string;
}

export interface LessonPlan {
  id?: string;
  book_content_id?: string;
  subject: string;
  class: string;
  unit?: string;
  period?: string;
  lesson_topic: string;
  date?: string;
  learning_outcomes?: string;
  warm_up_review?: string;
  teaching_activities?: string[];
  evaluation?: string[];
  class_work?: string[];
  home_assignment?: string[];
  remarks?: string;
  created_at?: string;
  center_id?: string;
  teacher_id?: string;
  objectives?: string;
  learning_activities?: string[];
  evaluation_activities?: string[];
  principal_remarks?: string;
  chapter?: string;
}
