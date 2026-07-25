import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

async function testWhatsAppConnection() {
  console.log('Testing WhatsApp Cloud API Connection...');
  
  if (!TOKEN || !PHONE_NUMBER_ID || !WABA_ID) {
    console.error('❌ Missing required environment variables. Please check .env.local');
    return;
  }
  
  try {
    // 1. Verify connection by fetching Business Account details
    const wabaResponse = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}?fields=name,timezone_id,currency`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    const wabaData = await wabaResponse.json();

    if (wabaResponse.ok) {
      console.log('✅ Successfully connected to WhatsApp Business Account!');
      console.log('Business Account Data:', wabaData);
    } else {
      console.error('❌ Failed to fetch Business Account:', wabaData);
    }

    console.log('\n---');
    
    // 2. Fetch Phone Number details
    const phoneResponse = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}?fields=display_phone_number,name_status,quality_rating`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    const phoneData = await phoneResponse.json();

    if (phoneResponse.ok) {
      console.log('✅ Successfully fetched Phone Number details!');
      console.log('Phone Number Data:', phoneData);
    } else {
      console.error('❌ Failed to fetch Phone Number:', phoneData);
    }

  } catch (error) {
    console.error('Error connecting to WhatsApp:', error);
  }
}

testWhatsAppConnection();
