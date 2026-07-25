import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  phoneNumber?: string;
  age?: number;
  gender?: string;
  height?: number; // cm
  weight?: number; // kg
  activityLevel?: string;
  healthGoals: string[];
  medicalConditions: string[];
  foodPreferences: string[];
  tastePreferences: string[];
  favoriteFoods: string[];
  budget?: string;
  medicalReportData?: {
    hba1c?: string;
    sugar?: string;
    cholesterol?: string;
    bloodPressure?: string;
    vitaminD?: string;
    iron?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String, unique: true, sparse: true },
    age: { type: Number },
    gender: { type: String },
    height: { type: Number },
    weight: { type: Number },
    activityLevel: { type: String },
    healthGoals: [{ type: String }],
    medicalConditions: [{ type: String }],
    foodPreferences: [{ type: String }],
    tastePreferences: [{ type: String }],
    favoriteFoods: [{ type: String }],
    budget: { type: String },
    medicalReportData: {
      hba1c: String,
      sugar: String,
      cholesterol: String,
      bloodPressure: String,
      vitaminD: String,
      iron: String,
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
