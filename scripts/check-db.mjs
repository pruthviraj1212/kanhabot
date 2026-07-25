import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function checkDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Define minimal schema just to query
  const messageSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    role: String,
    content: String,
  }, { timestamps: true });
  
  const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
  
  const userSchema = new mongoose.Schema({
    phoneNumber: String,
    name: String
  });
  const User = mongoose.models.User || mongoose.model("User", userSchema);

  const users = await User.find({ phoneNumber: { $exists: true } });
  console.log("Users with phone numbers:", users.map(u => ({ id: u._id, phone: u.phoneNumber, name: u.name })));

  const latestMessages = await Message.find().sort({ createdAt: -1 }).limit(5);
  console.log("\nLatest 5 messages in DB:");
  latestMessages.forEach(m => {
    console.log(`[${m.role}] ${m.content} (Time: ${m.createdAt})`);
  });

  mongoose.disconnect();
}

checkDB().catch(console.error);
