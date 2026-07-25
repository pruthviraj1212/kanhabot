import { NextRequest, NextResponse } from 'next/server';
import { processChatMessage } from '@/lib/chatService';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'my_super_secret_verify_token_123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// --- Deduplication: track processed WhatsApp message IDs ---
const processedMessageIds = new Set<string>();
const MESSAGE_ID_TTL_MS = 5 * 60 * 1000; // 5 minutes

function markMessageProcessed(messageId: string) {
  processedMessageIds.add(messageId);
  setTimeout(() => processedMessageIds.delete(messageId), MESSAGE_ID_TTL_MS);
}

// --- Per-user sequential queue to prevent race conditions ---
const userQueues = new Map<string, Promise<void>>();

function enqueueForUser(userId: string, task: () => Promise<void>): void {
  const currentQueue = userQueues.get(userId) || Promise.resolve();
  const newQueue = currentQueue.then(task).catch(console.error);
  userQueues.set(userId, newQueue);
  // Cleanup the map entry when the queue is empty
  newQueue.then(() => {
    if (userQueues.get(userId) === newQueue) {
      userQueues.delete(userId);
    }
  });
}

// Helper function to process AI logic in the background
async function processAndReply(from: string, msg_body: string) {
  try {
    // Process message through Kanha AI
    const aiResponse = await processChatMessage({
      phoneNumber: from,
      message: msg_body
    });

    let replyText = aiResponse.reply;

    // If there are meal recommendations, append them to the reply text nicely
    if (aiResponse.mealRecommendation && aiResponse.mealRecommendation.length > 0) {
      replyText += "\n\n*Here is what I recommend for you:*\n";
      aiResponse.mealRecommendation.forEach((item: any) => {
        replyText += `\n🍲 *${item.name}* (₹${item.price})\n_Why:_ ${item.reason}\n`;
      });
    }

    // Send reply back to WhatsApp
    if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
      const fbResponse = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: replyText }
        })
      });
      
      const responseBody = await fbResponse.text();
      if (!fbResponse.ok) {
        console.error("Facebook API Error:", fbResponse.status, responseBody);
        const fs = require('fs');
        fs.appendFileSync('webhook-logs.txt', new Date().toISOString() + '\\nFB ERROR:\\n' + responseBody + '\\n\\n');
      } else {
        console.log("Reply sent successfully to WhatsApp.");
        const fs = require('fs');
        fs.appendFileSync('webhook-logs.txt', new Date().toISOString() + '\\nFB SUCCESS:\\n' + responseBody + '\\n\\n');
      }
    } else {
      console.error("Missing WhatsApp credentials in environment variables.");
    }
  } catch (error: any) {
    console.error("Error in background processing:", error);
    const fs = require('fs');
    fs.appendFileSync('webhook-logs.txt', new Date().toISOString() + '\\nAI PROCESSING ERROR:\\n' + error.message + '\\n\\n');
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("=== INCOMING WEBHOOK ===");
    console.log(JSON.stringify(body, null, 2));

    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const messageId = message.id;
        const from = message.from;
        const msg_body = message.text?.body;

        // Deduplicate: skip if we've already processed this message ID
        if (messageId && processedMessageIds.has(messageId)) {
          console.log(`Skipping duplicate message: ${messageId}`);
          return new NextResponse('EVENT_RECEIVED', { status: 200 });
        }

        if (messageId) {
          markMessageProcessed(messageId);
        }

        if (msg_body) {
          console.log(`Extracted message from ${from}: ${msg_body}`);

          // Enqueue per-user so messages are processed sequentially (no race conditions)
          enqueueForUser(from, () => processAndReply(from, msg_body));
        }
      }
      // Return 200 OK immediately so Facebook knows we received it
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } else {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
