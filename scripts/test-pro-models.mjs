import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const credFile = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../snappy-weft-495610-h3-64a26970a00a.json"), 'utf-8'
));

const modelsToTest = [
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

async function testModel(model) {
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
      model: model,
      contents: "Say hello in one word",
    });
    console.log(`✅ ${model}: ${res.text?.trim()}`);
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("404")) {
      console.log(`❌ ${model}: NOT FOUND in region`);
    } else if (msg.includes("403")) {
      console.log(`❌ ${model}: PERMISSION DENIED — ${msg.substring(0, 200)}`);
    } else {
      console.log(`❌ ${model}: ${msg.substring(0, 200)}`);
    }
  }
}

async function main() {
  console.log("Testing all Pro/newer models on Vertex AI (us-central1)...\n");
  for (const model of modelsToTest) {
    await testModel(model);
  }
}

main();
