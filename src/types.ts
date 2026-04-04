export interface Book {
  id?: string;
  title: string;
  subject: string;
  class: string;
  created_at?: string;
}

export interface BookContent {
  id?: string;
  book_id: string;
  unit: string;
  lesson: string;
  topic: string;
  content: string;
  goals: string;
  created_at?: string;
}

export interface LessonPlan {
  id?: string;
  book_content_id?: string;
  subject: string;
  class: string;
  unit: string;
  period: string;
  lesson_topic: string;
  date: string;
  learning_outcomes: string;
  warm_up_review: string;
  teaching_activities: string[];
  evaluation: string[];
  class_work: string[];
  home_assignment: string[];
  remarks: string;
  created_at?: string;
}
