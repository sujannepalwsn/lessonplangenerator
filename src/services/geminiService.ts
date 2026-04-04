import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, BookContent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function parseBookPDF(pdfBase64: string): Promise<Partial<BookContent>[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `Analyze this textbook PDF. 
            
            1. Detect the primary language of the text. 
            2. If the text is in English, perform all extractions in English. 
            3. If the text is in Nepali but uses legacy font encodings (like Preeti, where "PsfO" = "इकाई"), decode it to proper UNICODE NEPALI.
            4. If the text is in standard Unicode Nepali, keep it in Unicode Nepali.
            
            Strictly extract the hierarchy: Unit -> Chapter -> Lesson -> Topic -> Sub-topic.
            Ensure you capture every level available in the book.
            
            For each specific topic/sub-topic, provide a summary of the content and the primary goal/objective.
            If this is a Mathematics book, ensure the content summary includes key formulas or concepts covered.
            
            Return a JSON array of objects with these keys:
            - unit: The unit name/number
            - chapter: The chapter name/number (if applicable)
            - lesson: The lesson name/number
            - topic: The specific topic name
            - sub_topic: The sub-topic name (if applicable)
            - content: A detailed summary of the content for this topic (in the detected language)
            - goals: The learning objectives for this topic (in the detected language)`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            unit: { type: Type.STRING },
            chapter: { type: Type.STRING },
            lesson: { type: Type.STRING },
            topic: { type: Type.STRING },
            sub_topic: { type: Type.STRING },
            content: { type: Type.STRING },
            goals: { type: Type.STRING }
          },
          required: ["unit", "lesson", "topic", "content", "goals"]
        }
      }
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}

export async function generatePlanFromContent(content: BookContent, subject: string, className: string, targetLanguage: string = 'English'): Promise<LessonPlan> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `Based on the following textbook content, generate a detailed lesson plan.
        IMPORTANT: Generate the entire lesson plan in ${targetLanguage}. 
        If the source content is in another language, translate the concepts accurately into ${targetLanguage}.
        
        SUBJECT: ${subject}
        CLASS: ${className}
        UNIT: ${content.unit}
        CHAPTER: ${content.chapter || ''}
        LESSON: ${content.lesson}
        TOPIC: ${content.topic}
        CONTENT SUMMARY: ${content.content}
        GOALS: ${content.goals}

        Generate a lesson plan with:
        - Period (40-45 mins)
        - Objectives (Learning Outcomes)
        - Warm up & Review
        - Teaching Activities (at least 5 steps)
        - Evaluation (at least 5 items)
        - Class Work (list of tasks)
        - Home Assignment (list of tasks)
        - Remarks (any additional teacher notes)
        - Principal Remarks (leave empty or generic)

        Return as a JSON object matching this schema:
        {
          "subject": string,
          "class": string,
          "chapter": string,
          "unit": string,
          "period": string,
          "lesson_topic": string,
          "objectives": string,
          "learning_outcomes": string,
          "warm_up_review": string,
          "teaching_activities": string[],
          "learning_activities": string[],
          "evaluation": string[],
          "evaluation_activities": string[],
          "class_work": string[],
          "home_assignment": string[],
          "remarks": string,
          "principal_remarks": string
        }`,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          class: { type: Type.STRING },
          chapter: { type: Type.STRING },
          unit: { type: Type.STRING },
          period: { type: Type.STRING },
          lesson_topic: { type: Type.STRING },
          objectives: { type: Type.STRING },
          learning_outcomes: { type: Type.STRING },
          warm_up_review: { type: Type.STRING },
          teaching_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          learning_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          evaluation: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          evaluation_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          class_work: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          home_assignment: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          remarks: { type: Type.STRING },
          principal_remarks: { type: Type.STRING }
        },
        required: [
          "subject", "class", "lesson_topic", "objectives", "warm_up_review", 
          "teaching_activities", "evaluation", "class_work", "home_assignment"
        ]
      }
    },
  });

  try {
    const plan = JSON.parse(response.text || "{}");
    return { 
      ...plan, 
      book_content_id: content.id,
      center_id: '00000000-0000-0000-0000-000000000000', // Placeholder
      teacher_id: '00000000-0000-0000-0000-000000000000', // Placeholder
    };
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to generate lesson plan");
  }
}

export async function generatePlanFromPDFAndTopic(pdfBase64: string, content: BookContent, subject: string, className: string, targetLanguage: string = 'English'): Promise<LessonPlan> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `Study the provided textbook PDF and generate a detailed lesson plan for the specific topic below.
            IMPORTANT: Generate the entire lesson plan in ${targetLanguage}. 
            
            SUBJECT: ${subject}
            CLASS: ${className}
            UNIT: ${content.unit}
            CHAPTER: ${content.chapter || ''}
            LESSON: ${content.lesson}
            TOPIC: ${content.topic}
            
            Instructions:
            1. Find the relevant section in the PDF for this topic.
            2. Use the actual text, examples, and exercises from the PDF to create a high-quality lesson plan.
            3. If this is a Mathematics book, include specific practice problems and step-by-step solutions from the text.
            
            Generate a lesson plan with:
            - Period (40-45 mins)
            - Objectives (Learning Outcomes)
            - Warm up & Review
            - Teaching Activities (at least 5 steps)
            - Evaluation (at least 5 items)
            - Class Work (list of tasks)
            - Home Assignment (list of tasks)
            - Remarks (any additional teacher notes)
            - Principal Remarks (leave empty or generic)

            Return as a JSON object matching this schema:
            {
              "subject": string,
              "class": string,
              "chapter": string,
              "unit": string,
              "period": string,
              "lesson_topic": string,
              "objectives": string,
              "learning_outcomes": string,
              "warm_up_review": string,
              "teaching_activities": string[],
              "learning_activities": string[],
              "evaluation": string[],
              "evaluation_activities": string[],
              "class_work": string[],
              "home_assignment": string[],
              "remarks": string,
              "principal_remarks": string
            }`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          class: { type: Type.STRING },
          chapter: { type: Type.STRING },
          unit: { type: Type.STRING },
          period: { type: Type.STRING },
          lesson_topic: { type: Type.STRING },
          objectives: { type: Type.STRING },
          learning_outcomes: { type: Type.STRING },
          warm_up_review: { type: Type.STRING },
          teaching_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          learning_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          evaluation: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          evaluation_activities: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          class_work: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          home_assignment: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          remarks: { type: Type.STRING },
          principal_remarks: { type: Type.STRING }
        },
        required: [
          "subject", "class", "lesson_topic", "objectives", "warm_up_review", 
          "teaching_activities", "evaluation", "class_work", "home_assignment"
        ]
      }
    },
  });

  try {
    const plan = JSON.parse(response.text || "{}");
    return { 
      ...plan, 
      book_content_id: content.id,
      center_id: '00000000-0000-0000-0000-000000000000', // Placeholder
      teacher_id: '00000000-0000-0000-0000-000000000000', // Placeholder
    };
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to generate lesson plan from PDF");
  }
}

export async function generateLessonPlansFromPDF(pdfBase64: string): Promise<LessonPlan[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `Analyze this textbook PDF and identify all distinct lessons or chapters. 
            For each lesson, generate a detailed lesson plan following this specific structure:
            - Subject
            - Class
            - Unit
            - Period (usually 40-45 mins)
            - Lesson Topic
            - Date (leave empty or use 'TBD')
            - Learning Outcomes (what students will achieve)
            - Warm up & Review (introductory activity)
            - Teaching Learning Activities (at least 4 steps)
            - Class Review / Evaluation (at least 4 questions or activities)
            - Assignments: Class Work (list of tasks)
            - Assignments: Home Assignment (list of tasks)
            - Remarks (any additional notes)

            Return the result as a JSON array of objects matching this schema:
            {
              "subject": string,
              "class": string,
              "unit": string,
              "period": string,
              "lesson_topic": string,
              "date": string,
              "learning_outcomes": string,
              "warm_up_review": string,
              "teaching_activities": string[],
              "evaluation": string[],
              "class_work": string[],
              "home_assignment": string[],
              "remarks": string
            }`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            class: { type: Type.STRING },
            unit: { type: Type.STRING },
            period: { type: Type.STRING },
            lesson_topic: { type: Type.STRING },
            date: { type: Type.STRING },
            learning_outcomes: { type: Type.STRING },
            warm_up_review: { type: Type.STRING },
            teaching_activities: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            evaluation: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            class_work: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            home_assignment: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            remarks: { type: Type.STRING }
          },
          required: [
            "subject", "class", "unit", "period", "lesson_topic", 
            "learning_outcomes", "warm_up_review", "teaching_activities", 
            "evaluation", "class_work", "home_assignment"
          ]
        }
      }
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}
