import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  console.log("Using API Key length:", apiKey.length);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent("Hello, respond with 'SDK OK'");
    const response = await result.response;
    console.log("Response:", response.text());
  } catch (err) {
    console.error("Test Failed:", err.message);
  }
}
test();
