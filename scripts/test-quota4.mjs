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

async function test(region, model) {
  const ai = new GoogleGenAI({ vertexai: true, project: "snappy-weft-495610-h3", location: region, googleAuthOptions });
  try {
    console.log(`Testing ${model} in ${region}...`);
    const res = await ai.models.generateContent({ model, contents: "Hello" });
    console.log(`✅ ${model} in ${region} works!`);
    return true;
  } catch (e) {
    console.log(`❌ ${model} in ${region} failed: ${e.message}`);
    return false;
  }
}

async function run() {
  const regions = ["us-east1", "us-east4", "europe-west4", "europe-west1", "asia-southeast1", "us-west1", "us-west4"];
  for (const region of regions) {
    const success = await test(region, "gemini-2.5-flash");
    if (success) break;
  }
}
run();
