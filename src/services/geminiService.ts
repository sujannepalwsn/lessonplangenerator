import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, BookContent, BookReaderContent } from "../types";

// Use import.meta.env for Vite/Vercel deployments, fallback to process.env for AI Studio environment
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

function getBackendUrl() {
  const savedKeysRaw = localStorage.getItem('ai_api_keys');
  if (savedKeysRaw) {
    const keys = JSON.parse(savedKeysRaw);
    if (keys.backend_url) return keys.backend_url;
  }
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
}

/**
 * Helper function to call either Gemini directly (if gemini selected)
 * or proxy through the backend for other agents.
 */
async function callAgentAPI(params: {
  prompt: string,
  system?: string,
  agent?: string,
  jsonMode?: boolean,
  pdfBase64?: string,
  pdfPath?: string
}): Promise<any> {
  const agent = params.agent || 'gemini';

  // Get keys from localStorage
  const savedKeysRaw = localStorage.getItem('ai_api_keys');
  const userKeys = savedKeysRaw ? JSON.parse(savedKeysRaw) : {};

  // If it's gemini and we have a user key, or it's standard call without PDF
  if (agent === 'gemini' && !params.pdfBase64) {
    const geminiKey = userKeys.gemini || apiKey;
    const userAI = new GoogleGenAI(geminiKey);
    const model = userAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: params.system
    });
    const result = await model.generateContent(params.prompt);
    return result.response;
  }

  // Inject user keys into params for backend proxy
  const paramsWithKeys = {
    ...params,
    userKeys: {
      gemini: userKeys.gemini,
      groq: userKeys.groq,
      huggingface: userKeys.huggingface,
      ollama_url: userKeys.ollama_url,
      ollama_model: userKeys.ollama_model
    }
  };

  // Otherwise, call the backend proxy
  try {
    const response = await fetch(`${getBackendUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paramsWithKeys)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to call agent');
    }
    const data = await response.json();
    return { text: () => data.response };
  } catch (err: any) {
    if (err.message.includes('Failed to fetch') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
       throw new Error(`Connection to AI Agent failed. Please ensure the backend server is running at ${getBackendUrl()} or check your Settings.`);
    }
    throw err;
  }
}

/**
 * Helper function to call Gemini with retry logic for rate limits (429 errors)
 */
async function callGeminiWithRetry(params: any, maxRetries = 3): Promise<any> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Compatibility with old calls
      if (params.model?.includes('gemini-3')) {
         params.model = 'gemini-1.5-pro';
      }
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
 * First step: Extract the Table of Contents from the PDF
 */
export async function extractTOC(pdfBase64: string, pdfPath?: string): Promise<any[]> {
  const response = await callAgentAPI({
    agent: "gemini", // Extraction usually needs multimodal
    pdfBase64: pdfPath ? undefined : pdfBase64,
    pdfPath: pdfPath,
    jsonMode: true,
    prompt: `Extract the Table of Contents from this textbook PDF.
            Identify every Unit, Chapter, and Lesson.
            Include page numbers if available.
            
            Return a JSON array of objects with these keys:
            - unit, chapter, lesson, topic, page_number`
  });

  try {
    return JSON.parse(response.text() || "[]");
  } catch (e) {
    console.error("Failed to parse TOC response", e);
    return [];
  }
}

/**
 * Unified extraction for both Lesson Planning and Reader
 * Processes the book in chunks based on TOC to ensure no topic is missed.
 */
export async function unifiedBookExtraction(pdfBase64: string, tocItem: any, pdfPath?: string): Promise<Partial<BookContent>> {
  const response = await callAgentAPI({
    agent: "gemini",
    pdfBase64: pdfPath ? undefined : pdfBase64,
    pdfPath: pdfPath,
    jsonMode: true,
    prompt: `You are an expert academic analyzer. Extract detailed content for the following section from this textbook.
            
            SECTION TO EXTRACT:
            Unit: ${tocItem.unit}
            Chapter: ${tocItem.chapter || 'N/A'}
            Lesson/Topic: ${tocItem.topic}
            Expected Page: ${tocItem.page_number || 'Unknown'}
            
            REQUIREMENTS:
            1. Detect language and ensure proper Unicode encoding.
            2. Extract EVERYTHING related to this section. Do not summarize briefly.
            3. full_content: Capture the entire detailed text, including all academic nuances and explanations.
            4. content: A pedagogical summary for lesson planning.
            5. goals: Specific learning outcomes.
            6. key_points: Array of critical takeaways.
            7. examples: Array of illustrative examples found in the text.
            8. formulas: Array of mathematical or scientific formulas found in the text.
            
            Return a JSON object with these keys:
            - unit, chapter, lesson, topic, sub_topic, content, full_content, goals, key_points, examples, formulas, page_number`
  });

  try {
    return JSON.parse(response.text() || "{}");
  } catch (e) {
    console.error("Failed to parse unified extraction response", e);
    return { ...tocItem, content: "Failed to extract", full_content: "Failed to extract", goals: "N/A" };
  }
}

/**
 * Compatibility wrappers for existing code
 */
export async function parseBookPDF(pdfBase64: string, pdfPath?: string): Promise<Partial<BookContent>[]> {
  // Legacy support - but we'll use the new unified method
  const toc = await extractTOC(pdfBase64, pdfPath);
  const results: Partial<BookContent>[] = [];

  // Process every item from the TOC to ensure nothing is missed
  for (const item of toc) {
    const details = await unifiedBookExtraction(pdfBase64, item, pdfPath);
    results.push(details);
  }
  return results;
}

export async function extractFullBookReaderContent(pdfBase64: string): Promise<Partial<BookReaderContent>[]> {
  // Now returns the same unified data
  return parseBookPDF(pdfBase64) as Promise<Partial<BookReaderContent>[]>;
}

export async function identifyBookMetadata(filename: string, pdfBase64?: string): Promise<{ title: string, subject: string, class: string }> {
  const response = await callAgentAPI({
    agent: "gemini",
    pdfBase64: pdfBase64,
    jsonMode: true,
    prompt: `Identify the Grade/Class, Subject, and a clean Title for this textbook.
      
      Filename: ${filename}
      
      Return a JSON object with:
      - title: Clean book title
      - subject: The subject (e.g., Mathematics, Science, Nepali)
      - class: The grade or class level (e.g., 10, 12, Grade 5)
      
      If you can't identify one, use "General" for class and "Unknown" for subject.`
  });

  try {
    return JSON.parse(response.text() || '{"title": "", "subject": "Unknown", "class": "General"}');
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
  targetLanguage: string = 'English',
  agent: string = 'gemini'
): Promise<string> {
  const context = bookContents.map(c => `Unit: ${c.unit}, Topic: ${c.topic}, Content: ${c.content}`).join('\n\n');
  
  const response = await callAgentAPI({
    agent,
    prompt: `You are an expert educational assistant. Answer the following question based on the provided textbook content.
        
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
        4. Keep the answer clear, concise, and educational.`
  });

  return response.text() || "I'm sorry, I couldn't generate an answer.";
}

export async function generatePlanFromContent(content: BookContent, subject: string, className: string, targetLanguage: string = 'English', agent: string = 'gemini'): Promise<LessonPlan> {
  const response = await callAgentAPI({
    agent,
    jsonMode: true,
    prompt: `Based on the following textbook content, generate a detailed lesson plan.
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

        Return as a JSON object with these keys:
        subject, class, chapter, unit, period, lesson_topic, objectives, learning_outcomes, warm_up_review, teaching_activities, learning_activities, evaluation, evaluation_activities, class_work, home_assignment, remarks, principal_remarks`
  });

  try {
    const plan = JSON.parse(response.text() || "{}");
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

export async function generatePlanFromPDFAndTopic(pdfBase64: string, content: BookContent, subject: string, className: string, targetLanguage: string = 'English', agent: string = 'gemini'): Promise<LessonPlan> {
  const response = await callAgentAPI({
    agent,
    pdfBase64,
    jsonMode: true,
    prompt: `Study the provided textbook PDF and generate a detailed lesson plan for the specific topic below.
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
            
            Generate a lesson plan as a JSON object with these keys:
            subject, class, chapter, unit, period, lesson_topic, objectives, learning_outcomes, warm_up_review, teaching_activities, learning_activities, evaluation, evaluation_activities, class_work, home_assignment, remarks, principal_remarks`
  });

  try {
    const plan = JSON.parse(response.text() || "{}");
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

export async function generateMCQs(content: BookContent, count: number = 5, agent: string = 'gemini'): Promise<any[]> {
  const response = await callAgentAPI({
    agent,
    jsonMode: true,
    prompt: `Based on the following textbook content, generate ${count} high-quality Multiple Choice Questions (MCQs).

        TOPIC: ${content.topic}
        CONTENT: ${content.content}
        FULL TEXT: ${content.full_content || ''}

        For each MCQ:
        1. Provide a clear question.
        2. Provide 4 distinct options (A, B, C, D).
        3. Identify the correct answer.
        4. Assign a difficulty (easy, medium, hard).

        Return a JSON array of objects with these keys:
        question_text, options, correct_answer, difficulty`
  });

  try {
    return JSON.parse(response.text() || "[]");
  } catch (e) {
    console.error("Failed to parse MCQs", e);
    return [];
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
