import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let googleAuthOptions = {};
if (credentialsPath && fs.existsSync(credentialsPath)) {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  googleAuthOptions = { credentials };
}

const ai = new GoogleGenAI({ vertexai: true, project: "snappy-weft-495610-h3", location: "us-central1", googleAuthOptions });

async function test(model) {
  try {
    console.log(`Testing ${model}...`);
    const res = await ai.models.generateContent({ model, contents: "Hello" });
    console.log(`✅ ${model} works!`);
  } catch (e) {
    console.log(`❌ ${model} failed: ${e.message}`);
  }
}

async function run() {
  await test("gemini-1.5-flash-002");
  await test("gemini-1.5-pro-002");
  await test("gemini-1.5-flash-8b-001");
}
run();
