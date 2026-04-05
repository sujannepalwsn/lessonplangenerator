import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, BookContent, BookReaderContent } from "../types";

// Use import.meta.env for Vite/Vercel deployments, fallback to process.env for AI Studio environment
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

/**
 * Helper function to call Gemini with retry logic for rate limits (429 errors)
 */
async function callGeminiWithRetry(params: any, maxRetries = 3): Promise<any> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      const isRateLimit = error?.status === "RESOURCE_EXHAUSTED" || 
                          error?.message?.includes("429") || 
                          error?.message?.includes("quota") ||
                          error?.message?.includes("RESOURCE_EXHAUSTED");
      
      if (isRateLimit && i < maxRetries - 1) {
        // Exponential backoff: 2s, 4s, 8s...
        const delay = Math.pow(2, i + 1) * 1000;
        console.warn(`Gemini rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Enhanced extraction for Lesson Plan Generator
 * Focuses on pedagogical structure and core concepts
 */
export async function parseBookPDF(pdfBase64: string): Promise<Partial<BookContent>[]> {
  const response = await callGeminiWithRetry({
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
            text: `Analyze this textbook PDF for academic-grade lesson planning. 
            
            1. Detect the primary language. 
            2. Decode legacy Nepali fonts (like Preeti) to UNICODE if necessary.
            
            Strictly extract the hierarchy: Unit -> Chapter -> Lesson -> Topic -> Sub-topic.
            
            For each topic/sub-topic, provide a HIGH-QUALITY, ACADEMIC-LEVEL extraction:
            - content: A detailed, pedagogical summary of the content. Include core theories, key definitions, and critical explanations. This must be thorough enough for a university-level instructor to build a lesson.
            - goals: Specific, measurable learning outcomes (Bloom's Taxonomy style).
            
            Return a JSON array of objects with these keys:
            - unit, chapter, lesson, topic, sub_topic, content, goals`,
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

/**
 * High-fidelity extraction for the Book Reader
 * Focuses on capturing the full academic value of the text
 */
export async function extractFullBookReaderContent(pdfBase64: string): Promise<Partial<BookReaderContent>[]> {
  const response = await callGeminiWithRetry({
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
            text: `Perform a high-fidelity academic extraction of this entire textbook PDF for a digital reader.
            
            1. Detect language and ensure proper Unicode encoding.
            2. Extract every Unit, Chapter, Lesson, and Topic.
            
            For each section, extract:
            - full_content: The most detailed version of the text possible, capturing all nuances, detailed explanations, and high-level academic concepts. 
            - key_points: A list of the most important takeaways.
            - examples: Any illustrative examples or case studies provided in the text.
            - formulas: Any mathematical or scientific formulas mentioned.
            
            Return a JSON array of objects with these keys:
            - unit, chapter, lesson, topic, sub_topic, full_content, key_points, examples, formulas`,
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
            full_content: { type: Type.STRING },
            key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            formulas: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["unit", "topic", "full_content", "key_points", "examples"]
        }
      }
    },
  });

  try {
    console.log('Gemini Reader Extraction Response:', response.text);
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}

export async function identifyBookMetadata(filename: string, pdfBase64?: string): Promise<{ title: string, subject: string, class: string }> {
  const parts: any[] = [
    {
      text: `Identify the Grade/Class, Subject, and a clean Title for this textbook.
      
      Filename: ${filename}
      
      Return a JSON object with:
      - title: Clean book title
      - subject: The subject (e.g., Mathematics, Science, Nepali)
      - class: The grade or class level (e.g., 10, 12, Grade 5)
      
      If you can't identify one, use "General" for class and "Unknown" for subject.`
    }
  ];

  if (pdfBase64) {
    parts.unshift({
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    });
  }

  const response = await callGeminiWithRetry({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subject: { type: Type.STRING },
          class: { type: Type.STRING }
        },
        required: ["title", "subject", "class"]
      }
    },
  });

  try {
    return JSON.parse(response.text || '{"title": "", "subject": "Unknown", "class": "General"}');
  } catch (e) {
    console.error("Failed to parse metadata identification", e);
    return { title: filename, subject: "Unknown", class: "General" };
  }
}

export async function searchBookContents(
  query: string,
  bookId: string,
  supabase: any
): Promise<BookContent[]> {
  // Simple text search using ilike on topic and content
  const { data, error } = await supabase
    .from('book_contents')
    .select('*')
    .eq('book_id', bookId)
    .or(`topic.ilike.%${query}%,content.ilike.%${query}%,unit.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}

export async function answerQuestionFromBook(
  question: string,
  bookTitle: string,
  bookContents: BookContent[],
  subject: string,
  className: string,
  targetLanguage: string = 'English'
): Promise<string> {
  const context = bookContents.map(c => `Unit: ${c.unit}, Topic: ${c.topic}, Content: ${c.content}`).join('\n\n');
  
  const response = await callGeminiWithRetry({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `You are an expert educational assistant. Answer the following question based on the provided textbook content.
        
        BOOK: ${bookTitle}
        SUBJECT: ${subject}
        CLASS: ${className}
        
        TEXTBOOK CONTENT SUMMARIES:
        ${context}
        
        QUESTION: ${question}
        
        INSTRUCTIONS:
        1. Answer the question accurately based ONLY on the provided content summaries.
        2. If the answer is not in the provided content, say "I'm sorry, but I couldn't find information about that in this specific book."
        3. Provide the answer in ${targetLanguage}.
        4. Keep the answer clear, concise, and educational.`,
      },
    ],
  });

  return response.text || "I'm sorry, I couldn't generate an answer.";
}

export async function generatePlanFromContent(content: BookContent, subject: string, className: string, targetLanguage: string = 'English'): Promise<LessonPlan> {
  const response = await callGeminiWithRetry({
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
  const response = await callGeminiWithRetry({
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
  const response = await callGeminiWithRetry({
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
