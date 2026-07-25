import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Load service account credentials
const credFile = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../snappy-weft-495610-h3-64a26970a00a.json"), 'utf-8'
));

async function testAI() {
  console.log("Testing Vertex AI (with explicit credentials)...");
  try {
    const vertexAI = new GoogleGenAI({
      vertexai: true,
      project: "snappy-weft-495610-h3",
      location: "us-central1",
      googleAuthOptions: {
        credentials: credFile,
      },
    });
    
    const res = await vertexAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say hello world!",
    });
    console.log("✅ Vertex AI Success:", res.text);
  } catch (err) {
    console.error("❌ Vertex AI Error:", err.message);
  }
}

testAI();
