import { GoogleGenAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import axios from 'axios';

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const groqApiKey = process.env.GROQ_API_KEY || "";
const huggingFaceToken = process.env.HF_TOKEN || "";

const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

export type AgentType = 'gemini' | 'groq' | 'huggingface' | 'ollama';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function callAgent(
  agentType: AgentType,
  prompt: string,
  systemInstruction?: string,
  jsonMode: boolean = false,
  userKeys: any = {}
): Promise<string> {
  switch (agentType) {
    case 'gemini':
      return callGemini(prompt, systemInstruction, jsonMode, userKeys.gemini);
    case 'groq':
      return callGroq(prompt, systemInstruction, jsonMode, userKeys.groq);
    case 'huggingface':
      return callHuggingFace(prompt, systemInstruction, userKeys.huggingface);
    case 'ollama':
      return callOllama(prompt, systemInstruction, jsonMode, userKeys.ollama_url, userKeys.ollama_model);
    default:
      return callGemini(prompt, systemInstruction, jsonMode, userKeys.gemini);
  }
}

async function callGemini(prompt: string, system?: string, jsonMode?: boolean, customKey?: string): Promise<string> {
  const activeAI = customKey ? new GoogleGenAI(customKey) : genAI;
  const model = activeAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: system
  });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    if (jsonMode) {
      // Robust JSON extraction
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        text = jsonMatch[0];
      } else {
        text = text.replace(/```json\n?|```/g, '').trim();
      }
    }
    return text;
  } catch (err: any) {
    console.error("Gemini Error:", err);
    // Standardize error message for frontend
    if (err.message?.includes("404") || err.message?.includes("not found")) {
      throw new Error("Gemini 1.5 Flash model not found or unsupported in this region/version.");
    }
    throw err;
  }
}

async function callGroq(prompt: string, system?: string, jsonMode?: boolean, customKey?: string): Promise<string> {
  const activeGroq = customKey ? new Groq({ apiKey: customKey }) : groq;
  if (!activeGroq) throw new Error("Groq API key not configured");

  const messages: any[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const completion = await activeGroq.chat.completions.create({
    messages,
    model: "llama-3.3-70b-versatile",
    response_format: jsonMode ? { type: "json_object" } : undefined,
  });

  return completion.choices[0]?.message?.content || "";
}

async function callHuggingFace(prompt: string, system?: string, customKey?: string): Promise<string> {
  const fullPrompt = system ? `${system}\n\nUser: ${prompt}` : prompt;
  const activeToken = customKey || huggingFaceToken;

  const response = await axios.post(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    { inputs: fullPrompt },
    { headers: { Authorization: `Bearer ${activeToken}` } }
  );

  return response.data[0]?.generated_text || "";
}

async function callOllama(prompt: string, system?: string, jsonMode?: boolean, customUrl?: string, customModel?: string): Promise<string> {
  const ollamaUrl = customUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  const response = await axios.post(`${ollamaUrl}/api/generate`, {
    model: customModel || process.env.OLLAMA_MODEL || 'llama3',
    prompt: fullPrompt,
    stream: false,
    format: jsonMode ? 'json' : undefined
  });

  return response.data.response;
}
