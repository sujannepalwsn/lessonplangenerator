import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import axios from 'axios';

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const groqApiKey = process.env.GROQ_API_KEY || "";
const huggingFaceToken = process.env.HF_TOKEN || "";

const genAI = new GoogleGenAI(geminiApiKey);
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
  jsonMode: boolean = false
): Promise<string> {
  switch (agentType) {
    case 'gemini':
      return callGemini(prompt, systemInstruction, jsonMode);
    case 'groq':
      return callGroq(prompt, systemInstruction, jsonMode);
    case 'huggingface':
      return callHuggingFace(prompt, systemInstruction);
    case 'ollama':
      return callOllama(prompt, systemInstruction, jsonMode);
    default:
      return callGemini(prompt, systemInstruction, jsonMode);
  }
}

async function callGemini(prompt: string, system?: string, jsonMode?: boolean): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: system
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  if (jsonMode) {
     text = text.replace(/```json\n?|```/g, '').trim();
  }
  return text;
}

async function callGroq(prompt: string, system?: string, jsonMode?: boolean): Promise<string> {
  if (!groq) throw new Error("Groq API key not configured");

  const messages: any[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const completion = await groq.chat.completions.create({
    messages,
    model: "llama-3.3-70b-versatile",
    response_format: jsonMode ? { type: "json_object" } : undefined,
  });

  return completion.choices[0]?.message?.content || "";
}

async function callHuggingFace(prompt: string, system?: string): Promise<string> {
  const fullPrompt = system ? `${system}\n\nUser: ${prompt}` : prompt;

  const response = await axios.post(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    { inputs: fullPrompt },
    { headers: { Authorization: `Bearer ${huggingFaceToken}` } }
  );

  return response.data[0]?.generated_text || "";
}

async function callOllama(prompt: string, system?: string, jsonMode?: boolean): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  const response = await axios.post(`${ollamaUrl}/api/generate`, {
    model: process.env.OLLAMA_MODEL || 'llama3',
    prompt: fullPrompt,
    stream: false,
    format: jsonMode ? 'json' : undefined
  });

  return response.data.response;
}
