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
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
];

const locationsToTest = ["us-central1", "global"];

async function testModel(model, location) {
  try {
    const vertexAI = new GoogleGenAI({
      vertexai: true,
      project: "snappy-weft-495610-h3",
      location: location,
      googleAuthOptions: {
        credentials: credFile,
      },
    });
    
    const res = await vertexAI.models.generateContent({
      model: model,
      contents: "Say hello in one word",
    });
    console.log(`  ✅ ${model} @ ${location}: ${res.text?.trim()}`);
    return true;
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("404")) {
      console.log(`  ❌ ${model} @ ${location}: NOT FOUND`);
    } else if (msg.includes("403")) {
      console.log(`  ❌ ${model} @ ${location}: PERMISSION DENIED`);
    } else {
      console.log(`  ❌ ${model} @ ${location}: ${msg.substring(0, 120)}`);
    }
    return false;
  }
}

async function main() {
  console.log("Testing Vertex AI models across locations...\n");
  for (const location of locationsToTest) {
    console.log(`--- Location: ${location} ---`);
    for (const model of modelsToTest) {
      const success = await testModel(model, location);
      if (success) break; // found a working combo, no need to test more in this location
    }
    console.log();
  }
}

main();
