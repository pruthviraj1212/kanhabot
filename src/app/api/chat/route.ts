import { NextRequest, NextResponse } from "next/server";
import { processChatMessage } from "@/lib/chatService";

export async function POST(req: NextRequest) {
  try {
    const { userId, message, image } = await req.json();

    const result = await processChatMessage({ userId, message, image });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to process chat", details: error.message },
      { status: error.message.includes("Message or image is required") ? 400 : 500 }
    );
  }
}
