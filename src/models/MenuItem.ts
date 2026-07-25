import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMenuItem extends Document {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: string;
  price: number;
  category: string;
  ingredients: string[];
  dietaryFlags: string[]; // e.g. "Vegetarian", "Jain", "Gluten Free"
  customizationsSupported: string[]; // e.g. "No Onion", "Less Oil", "Extra Protein"
}

const MenuItemSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fat: { type: Number, required: true },
  sugar: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  ingredients: [{ type: String }],
  dietaryFlags: [{ type: String }],
  customizationsSupported: [{ type: String }],
});

export const MenuItem: Model<IMenuItem> =
  mongoose.models.MenuItem || mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);

