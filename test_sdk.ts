import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey });

async function test() {
  try {
    console.log("Testing generateContent call...");
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: 'user', parts: [{ text: 'Hello, are you there?' }] }]
    });
    console.log("Success! Response:", result.text);
  } catch (err) {
    console.error("Failed with models.generateContent:", err.message);
    try {
      console.log("Trying getGenerativeModel fallback...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("Hello?");
      console.log("Success with getGenerativeModel! Response:", result.response.text());
    } catch (err2) {
      console.error("Both failed.", err2.message);
    }
  }
}
test();
