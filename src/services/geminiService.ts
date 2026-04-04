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
            text: `Analyze this textbook PDF. Detect the language of the text (e.g., Nepali, English, etc.) and perform all extractions in that SAME language.
            
            Extract every Unit, Lesson, and Topic. 
            For each topic, provide a summary of the content and the primary goal/objective.
            If this is a Mathematics book, ensure the content summary includes key formulas or concepts covered.
            
            Return a JSON array of objects with these keys:
            - unit: The unit name or number
            - lesson: The lesson name or number
            - topic: The specific topic name
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
            lesson: { type: Type.STRING },
            topic: { type: Type.STRING },
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

export async function generatePlanFromContent(content: BookContent, subject: string, className: string): Promise<LessonPlan> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `Based on the following textbook content, generate a detailed lesson plan.
        IMPORTANT: Use the SAME language as the provided content (e.g., if content is in Nepali, generate the plan in Nepali).
        
        SUBJECT: ${subject}
        CLASS: ${className}
        UNIT: ${content.unit}
        LESSON: ${content.lesson}
        TOPIC: ${content.topic}
        CONTENT SUMMARY: ${content.content}
        GOALS: ${content.goals}

        Generate a lesson plan with:
        - Period (40-45 mins)
        - Learning Outcomes
        - Warm up & Review
        - Teaching Learning Activities (at least 4 steps. For Mathematics, include specific problem-solving steps or examples)
        - Class Review / Evaluation (at least 4 items. For Mathematics, include practice problems)
        - Class Work
        - Home Assignment
        - Remarks

        Return as a JSON object matching the LessonPlan schema.`,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
    },
  });

  try {
    const plan = JSON.parse(response.text || "{}");
    return { ...plan, book_content_id: content.id };
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to generate lesson plan");
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
