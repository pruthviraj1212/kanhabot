import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function debugVertexAI() {
  // 1. Check if credentials file exists
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log("=== CREDENTIAL DEBUG ===");
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", credPath);
  console.log("File exists:", credPath ? fs.existsSync(credPath) : "N/A");
  
  if (credPath && fs.existsSync(credPath)) {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    console.log("Project ID from creds:", creds.project_id);
    console.log("Client email:", creds.client_email);
    console.log("Type:", creds.type);
  }

  // 2. Try with explicit credentials via googleAuthOptions
  console.log("\n=== TEST 1: Vertex AI with explicit credentials ===");
  try {
    const credFile = JSON.parse(fs.readFileSync(
      path.join(__dirname, "../snappy-weft-495610-h3-64a26970a00a.json"), 'utf-8'
    ));
    
    const vertexAI = new GoogleGenAI({
      vertexai: true,
      project: "snappy-weft-495610-h3",
      location: "us-central1",
      googleAuthOptions: {
        credentials: credFile,
      },
    });
    
    const res = await vertexAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say hello world in one sentence!",
    });
    console.log("✅ Success:", res.text);
  } catch (err) {
    console.error("❌ Error:", err.message?.substring(0, 500));
  }

  // 3. Try with ADC (GOOGLE_APPLICATION_CREDENTIALS env var)
  console.log("\n=== TEST 2: Vertex AI with ADC env var ===");
  try {
    const vertexAI = new GoogleGenAI({
      vertexai: true,
      project: "snappy-weft-495610-h3",
      location: "us-central1",
    });
    
    const res = await vertexAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say hello world in one sentence!",
    });
    console.log("✅ Success:", res.text);
  } catch (err) {
    console.error("❌ Error:", err.message?.substring(0, 500));
  }

  // 4. Try the old nested config style  
  console.log("\n=== TEST 3: Vertex AI with nested vertexai config ===");
  try {
    const vertexAI = new GoogleGenAI({
      vertexai: {
        project: "snappy-weft-495610-h3",
        location: "us-central1",
      },
    });
    
    const res = await vertexAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say hello world in one sentence!",
    });
    console.log("✅ Success:", res.text);
  } catch (err) {
    console.error("❌ Error:", err.message?.substring(0, 500));
  }
}

debugVertexAI();
