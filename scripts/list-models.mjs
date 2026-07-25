import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function listModels() {
  const aiStudio = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
  
  try {
    const response = await aiStudio.models.list();
    for await (const model of response) {
      console.log(model.name);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

listModels();
