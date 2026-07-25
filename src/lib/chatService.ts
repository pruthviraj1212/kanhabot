import { GoogleGenAI, Type } from "@google/genai";
import connectToDatabase from "@/lib/db";
import { User } from "@/models/User";
import { Message } from "@/models/Message";
import { MenuItem } from "@/models/MenuItem";
import fs from "fs";

// Load service account credentials for Vertex AI
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let googleAuthOptions = {};
if (credentialsPath && fs.existsSync(credentialsPath)) {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  googleAuthOptions = { credentials };
}

// Primary: Vertex AI client
const aiVertexAI = new GoogleGenAI({
  vertexai: true,
  project: "snappy-weft-495610-h3",
  location: "us-central1",
  googleAuthOptions,
});

// Fallback: Gemini API Key client (separate quota)
const geminiApiKey = process.env.GEMINI_API_KEY;
const aiFallback = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Helper: call generateContent with retry + fallback
async function generateWithRetry(config: any, maxRetries = 2): Promise<any> {
  let lastError: any;

  // Try Vertex AI first
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await aiVertexAI.models.generateContent(config);
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 2000; // 2s, 4s
        console.log(`Vertex AI 429, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (error?.status === 429 && aiFallback) {
        // Vertex AI exhausted all retries, try fallback
        console.log("Vertex AI exhausted, switching to Gemini API key fallback...");
        break;
      } else {
        throw error;
      }
    }
  }

  // Fallback to Gemini API Key
  if (aiFallback) {
    try {
      return await aiFallback.models.generateContent(config);
    } catch (fallbackError: any) {
      console.error("Fallback Gemini API also failed:", fallbackError?.message);
      throw fallbackError;
    }
  }

  throw lastError;
}

export interface ProcessChatParams {
  userId?: string;
  phoneNumber?: string;
  message?: string;
  image?: string;
}

export async function processChatMessage({ userId, phoneNumber, message, image }: ProcessChatParams) {
  if (!message && !image) {
    throw new Error("Message or image is required");
  }

  await connectToDatabase();

  // 1. Get or Create User
  let user = null;
  if (userId) {
    user = await User.findById(userId);
  } else if (phoneNumber) {
    user = await User.findOne({ phoneNumber });
  }

  if (!user) {
    user = await User.create({
      name: "Guest",
      phoneNumber,
      healthGoals: [],
      medicalConditions: [],
      foodPreferences: [],
      tastePreferences: [],
      favoriteFoods: [],
    });
  }

  // 2. Save user message
  const messageContent = image
    ? `${message || ""} [User uploaded an image/medical report]`.trim()
    : message;
  await Message.create({
    userId: user._id,
    role: "user",
    content: messageContent,
  });

  // 3. Fetch chat history (latest 20, then reverse to chronological order)
  const recentMessages = await Message.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  const history = recentMessages.reverse();

  // 4. Fetch Restaurant Menu
  const menu = await MenuItem.find({});
  const menuString = menu.map((m) =>
    `- ${m.name} (₹${m.price}) [${m.category}]: ${m.description} | ${m.calories} kcal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat, Sugar: ${m.sugar} | Dietary: ${m.dietaryFlags.join(", ")} | Customizations: ${m.customizationsSupported.join(", ")}`
  ).join("\n");

  // 5. Build user profile summary for context
  const profileFields = {
    name: user.name && user.name !== "Guest" ? user.name : null,
    height: user.height || null,
    weight: user.weight || null,
    age: user.age || null,
    gender: user.gender || null,
    healthGoals: user.healthGoals?.length > 0 ? user.healthGoals : null,
    medicalConditions: user.medicalConditions?.length > 0 ? user.medicalConditions : null,
    foodPreferences: user.foodPreferences?.length > 0 ? user.foodPreferences : null,
    tastePreferences: user.tastePreferences?.length > 0 ? user.tastePreferences : null,
    medicalReportData: user.medicalReportData || null,
  };

  const collectedFields = Object.entries(profileFields)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);
  const missingFields = Object.entries(profileFields)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  const profileSummary = `
- Name: ${profileFields.name || "Not provided"}
- Height: ${profileFields.height ? profileFields.height + " cm" : "Not provided"}
- Weight: ${profileFields.weight ? profileFields.weight + " kg" : "Not provided"}
- Age: ${profileFields.age || "Not provided"}
- Gender: ${profileFields.gender || "Not provided"}
- Health Goals: ${profileFields.healthGoals ? profileFields.healthGoals.join(", ") : "Not specified"}
- Medical Conditions: ${profileFields.medicalConditions ? profileFields.medicalConditions.join(", ") : "None specified"}
- Food Preferences: ${profileFields.foodPreferences ? profileFields.foodPreferences.join(", ") : "Not specified"}
- Taste Preferences: ${profileFields.tastePreferences ? profileFields.tastePreferences.join(", ") : "Not specified"}
- Medical Report Data: ${profileFields.medicalReportData ? JSON.stringify(profileFields.medicalReportData) : "None provided"}

ALREADY COLLECTED: ${collectedFields.length > 0 ? collectedFields.join(", ") : "Nothing yet"}
STILL MISSING: ${missingFields.length > 0 ? missingFields.join(", ") : "All info collected! Ready to recommend a meal."}
`.trim();

  // 6. Construct System Prompt with multi-step conversation flow
  const systemPrompt = `You are "Kanha AI" — a friendly, caring AI nutrition assistant for Kanha Restaurant.
You speak warmly and use simple English. You act as a personal nutrition coach who genuinely cares about the customer's health.

## YOUR CONVERSATION FLOW:

### CRITICAL RULE — CHECK THE PROFILE FIRST:
Before asking ANY question, ALWAYS check the "CURRENT USER PROFILE" section below.
- If a field is ALREADY COLLECTED (listed under "ALREADY COLLECTED"), DO NOT ask about it again. Acknowledge it and move on.
- ONLY ask about fields listed under "STILL MISSING".
- If ALL info is collected (STILL MISSING says "All info collected"), skip straight to STEP 3 and recommend a meal.
- NEVER repeat a question the user has already answered, even if they send "hi" or "hii" again.

### STEP 1 — First message (when user profile is mostly empty):
Warmly greet the customer and ask: "Would you like me to create a custom healthy meal just for you, based on your body and health?"
If they say NO or just want to order, help them browse the menu normally.
If the user is RETURNING (profile has some data), welcome them back and summarize what you know, then ask about the NEXT missing field.

### STEP 2 — If they say YES, collect ONLY MISSING details ONE AT A TIME:
Ask ONLY about fields that are STILL MISSING. Skip any that are already in the profile:
1. "What is your age?" → SKIP if age is already in profile
2. "What is your height and weight?" → SKIP if height/weight already in profile
3. "Do you have any health conditions?" → SKIP if medicalConditions already in profile
4. "Do you have any recent medical reports?" → SKIP if medicalReportData already in profile
5. "What foods do you NOT eat?" → SKIP if foodPreferences already in profile
6. "What kind of taste do you prefer?" → SKIP if tastePreferences already in profile
7. "Any health goals?" → SKIP if healthGoals already in profile

### IMAGE/REPORT UPLOAD:
If the user uploads a photo of a medical report, carefully read ALL the values from the image.
Extract and save: sugar levels, HbA1c, cholesterol (total, HDL, LDL), blood pressure, vitamin D, iron, hemoglobin, or any other health markers visible.
Acknowledge what you read from the report and ask if the values are correct.

### STEP 3 — After collecting enough info:
Create a PERSONALIZED MEAL RECOMMENDATION from the menu below. Include:
- 2-4 items that form a complete meal (dal/sabji + roti/rice + side)
- Why each item is good for THEM specifically
- What to AVOID from the menu based on their conditions
- Total approximate calories and price

## IMPORTANT RULES:
- ONLY recommend items from the restaurant menu below. Never invent items.
- Always include the base unit price (₹) for each item.
- Do NOT output duplicate items in the meal recommendation array. If you recommend multiple quantities of an item (like 2 rotis), set the 'quantity' field to 2, but only include the item once in the array.
- If someone has diabetes, avoid high-sugar items and recommend methi paratha, dal palak, etc.
- If someone has BP, recommend low-salt, light items like arhar dal, plain roti, salads.
- If someone wants weight loss, recommend low-calorie, high-protein options.
- If someone has cholesterol issues, avoid cream/butter-heavy items.
- Be conversational and warm, not clinical.
- Keep responses concise — don't write essays.
- You might be talking to the user via WhatsApp, so use short lines and appropriate emojis!

## CURRENT USER PROFILE:
${profileSummary}

## RESTAURANT MENU (Kanha):
${menuString || "No items available."}

## OUTPUT FORMAT:
Always respond in the exact JSON schema provided. The "reply" field is your conversational message to the user.
Use "profileUpdates" to save any new information the user shares (height, weight, conditions, preferences).
Use "mealRecommendation" ONLY when you are ready to recommend a complete meal (Step 3).
`;

  // 7. Build conversation history for Gemini
  const contents = history.map((msg) => ({
    role: msg.role === "system" ? "user" : msg.role,
    parts: [{ text: msg.content }]
  }));

  // 7b. If current message has an image, add it as inline data to the last user message
  if (image) {
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (matches && contents.length > 0) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      const lastContent = contents[contents.length - 1];
      if (lastContent.role === "user") {
        lastContent.parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          }
        } as any);
      }
    }
  }

  // 8. Call Gemini with structured output (with retry + fallback)
  const response = await generateWithRetry({
    model: "gemini-2.5-flash",
    contents: contents,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: "Your conversational reply to the user. Be warm and friendly.",
          },
          profileUpdates: {
            type: Type.OBJECT,
            description: "Any new profile information extracted from the user's message. Only include fields that the user explicitly mentioned.",
            properties: {
              name: { type: Type.STRING, description: "User's name if they share it." },
              height: { type: Type.NUMBER, description: "Height in cm if mentioned." },
              weight: { type: Type.NUMBER, description: "Weight in kg if mentioned." },
              age: { type: Type.NUMBER, description: "Age if mentioned." },
              gender: { type: Type.STRING, description: "Gender if mentioned." },
              newHealthGoals: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "New health goals.",
              },
              newMedicalConditions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "New medical conditions.",
              },
              newFoodPreferences: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "New food preferences or restrictions.",
              },
              newTastePreferences: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "New taste preferences.",
              },
              medicalReportData: {
                type: Type.OBJECT,
                description: "Any medical report data shared by the user.",
                properties: {
                  hba1c: { type: Type.STRING },
                  sugar: { type: Type.STRING },
                  cholesterol: { type: Type.STRING },
                  bloodPressure: { type: Type.STRING },
                  vitaminD: { type: Type.STRING },
                  iron: { type: Type.STRING },
                },
              },
            },
          },
          mealRecommendation: {
            type: Type.ARRAY,
            description: "Recommended meal items from the menu. Only include when making a final meal recommendation (Step 3). Leave empty during info gathering.",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Exact menu item name." },
                price: { type: Type.NUMBER, description: "Base unit price in rupees." },
                quantity: { type: Type.NUMBER, description: "Number of servings/items recommended (e.g., 2 for two rotis)." },
                reason: { type: Type.STRING, description: "Why this item is good for this specific user." },
                category: { type: Type.STRING, description: "Item category from menu." },
              },
              required: ["name", "price", "quantity", "reason"],
            },
          },
        },
        required: ["reply", "profileUpdates", "mealRecommendation"],
      },
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  const result = JSON.parse(text);

  // 9. Save model's response
  await Message.create({
    userId: user._id,
    role: "model",
    content: result.reply,
  });

  // 10. Update User Profile with any new data from AI extraction
  let profileUpdated = false;
  const updates = result.profileUpdates || {};

  if (updates.name && updates.name !== "Guest") {
    user.name = updates.name;
    profileUpdated = true;
  }
  if (updates.height && updates.height > 0) {
    user.height = updates.height;
    profileUpdated = true;
  }
  if (updates.weight && updates.weight > 0) {
    user.weight = updates.weight;
    profileUpdated = true;
  }
  if (updates.age && updates.age > 0) {
    user.age = updates.age;
    profileUpdated = true;
  }
  if (updates.gender) {
    user.gender = updates.gender;
    profileUpdated = true;
  }
  if (updates.newHealthGoals && updates.newHealthGoals.length > 0) {
    user.healthGoals = Array.from(new Set([...user.healthGoals, ...updates.newHealthGoals]));
    profileUpdated = true;
  }
  if (updates.newMedicalConditions && updates.newMedicalConditions.length > 0) {
    user.medicalConditions = Array.from(new Set([...user.medicalConditions, ...updates.newMedicalConditions]));
    profileUpdated = true;
  }
  if (updates.newFoodPreferences && updates.newFoodPreferences.length > 0) {
    user.foodPreferences = Array.from(new Set([...user.foodPreferences, ...updates.newFoodPreferences]));
    profileUpdated = true;
  }
  if (updates.newTastePreferences && updates.newTastePreferences.length > 0) {
    user.tastePreferences = Array.from(new Set([...user.tastePreferences, ...updates.newTastePreferences]));
    profileUpdated = true;
  }
  if (updates.medicalReportData) {
    const report = updates.medicalReportData;
    if (!user.medicalReportData) user.medicalReportData = {};
    if (report.hba1c) user.medicalReportData.hba1c = report.hba1c;
    if (report.sugar) user.medicalReportData.sugar = report.sugar;
    if (report.cholesterol) user.medicalReportData.cholesterol = report.cholesterol;
    if (report.bloodPressure) user.medicalReportData.bloodPressure = report.bloodPressure;
    if (report.vitaminD) user.medicalReportData.vitaminD = report.vitaminD;
    if (report.iron) user.medicalReportData.iron = report.iron;
    user.markModified("medicalReportData");
    profileUpdated = true;
  }

  if (profileUpdated) {
    await user.save();
  }

  // 10.5 Deduplicate meal recommendations
  let finalMealRecommendations = result.mealRecommendation || [];
  if (finalMealRecommendations.length > 0) {
    const seenItems = new Set();
    finalMealRecommendations = finalMealRecommendations.filter((item: any) => {
      if (seenItems.has(item.name)) return false;
      seenItems.add(item.name);
      return true;
    });
  }

  // 11. Return response with full user profile and meal recommendations
  return {
    reply: result.reply,
    mealRecommendation: finalMealRecommendations,
    user: {
      id: user._id,
      name: user.name,
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      healthGoals: user.healthGoals,
      medicalConditions: user.medicalConditions,
      foodPreferences: user.foodPreferences,
      tastePreferences: user.tastePreferences,
      medicalReportData: user.medicalReportData,
    }
  };
}
