import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  role: "system" | "user" | "model";
  content: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["system", "user", "model"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
