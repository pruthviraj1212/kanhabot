#!/usr/bin/env node

/**
 * Dev script that starts:
 * 1. Next.js dev server on port 3000
 * 2. Cloudflare quick tunnel pointing to port 3000
 * 3. Auto-updates the WhatsApp webhook URL via Facebook Graph API
 */

import { spawn } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

const WHATSAPP_APP_ID = process.env.WHATSAPP_APP_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "my_super_secret_verify_token_123";
const PORT = 3000;

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function log(prefix, color, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

// --- Step 1: Kill any existing processes on port 3000 ---
function killPort(port) {
  return new Promise((resolve) => {
    const kill = spawn("sh", ["-c", `lsof -ti :${port} 2>/dev/null | xargs kill -9 2>/dev/null`], { cwd: projectRoot });
    kill.on("close", () => {
      setTimeout(resolve, 500);
    });
  });
}

// --- Step 2: Start Next.js dev server ---
function startNextDev() {
  return new Promise((resolve) => {
    log("NEXT", colors.cyan, "Starting Next.js dev server...");
    const next = spawn("npx", ["next", "dev", "--port", String(PORT)], {
      cwd: projectRoot,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    next.stdout.on("data", (data) => {
      const text = data.toString();
      process.stdout.write(`${colors.dim}[NEXT]${colors.reset} ${text}`);
      if (text.includes("Ready in")) {
        resolve(next);
      }
    });

    next.stderr.on("data", (data) => {
      process.stderr.write(`${colors.dim}[NEXT]${colors.reset} ${data.toString()}`);
    });

    next.on("close", (code) => {
      log("NEXT", colors.red, `Process exited with code ${code}`);
      process.exit(code || 1);
    });

    // Resolve after 10s even if we didn't see "Ready in" (fallback)
    setTimeout(() => resolve(next), 10000);
  });
}

// --- Step 3: Start Cloudflare tunnel ---
function startTunnel() {
  return new Promise((resolve, reject) => {
    log("TUNNEL", colors.yellow, "Starting Cloudflare tunnel...");
    const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
      cwd: projectRoot,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let tunnelUrl = null;

    // cloudflared outputs the URL to stderr
    tunnel.stderr.on("data", (data) => {
      const text = data.toString();

      // Extract the tunnel URL
      const urlMatch = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (urlMatch && !tunnelUrl) {
        tunnelUrl = urlMatch[0];
        log("TUNNEL", colors.green, `${colors.bold}✅ Tunnel URL: ${tunnelUrl}${colors.reset}`);
        log("TUNNEL", colors.green, `${colors.bold}📱 Webhook URL: ${tunnelUrl}/api/webhook${colors.reset}`);
        resolve(tunnelUrl);
      }

      // Only log important tunnel messages
      if (text.includes("ERR") || text.includes("error") || text.includes("failed")) {
        log("TUNNEL", colors.red, text.trim());
      }
    });

    tunnel.on("close", (code) => {
      log("TUNNEL", colors.red, `Tunnel exited with code ${code}`);
      if (!tunnelUrl) reject(new Error("Tunnel failed to start"));
    });

    // Timeout after 15s
    setTimeout(() => {
      if (!tunnelUrl) {
        log("TUNNEL", colors.red, "Timeout waiting for tunnel URL");
        reject(new Error("Tunnel URL not found within 15s"));
      }
    }, 15000);
  });
}

// --- Step 4: Update WhatsApp webhook URL via Facebook API ---
async function updateWhatsAppWebhook(tunnelUrl) {
  const webhookUrl = `${tunnelUrl}/api/webhook`;

  if (!WHATSAPP_APP_ID || !WHATSAPP_ACCESS_TOKEN) {
    log("WEBHOOK", colors.yellow, "⚠️  Missing WHATSAPP_APP_ID or WHATSAPP_ACCESS_TOKEN — skipping auto-update");
    log("WEBHOOK", colors.yellow, `   Manually set your webhook URL to: ${webhookUrl}`);
    return;
  }

  try {
    log("WEBHOOK", colors.cyan, "Updating WhatsApp webhook URL...");

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_APP_ID}/subscriptions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: webhookUrl,
          verify_token: WHATSAPP_VERIFY_TOKEN,
          fields: "messages",
          access_token: WHATSAPP_ACCESS_TOKEN,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      log("WEBHOOK", colors.green, `${colors.bold}✅ WhatsApp webhook updated successfully!${colors.reset}`);
      log("WEBHOOK", colors.green, `   URL: ${webhookUrl}`);
    } else {
      log("WEBHOOK", colors.yellow, `⚠️  Webhook update response: ${JSON.stringify(data)}`);
      log("WEBHOOK", colors.yellow, `   You may need to manually update the webhook URL to: ${webhookUrl}`);
    }
  } catch (error) {
    log("WEBHOOK", colors.red, `❌ Failed to update webhook: ${error.message}`);
    log("WEBHOOK", colors.yellow, `   Manually set your webhook URL to: ${webhookUrl}`);
  }
}

// --- Main ---
async function main() {
  console.log(`\n${colors.bold}${colors.cyan}🚀 Kanha Dev Server + Cloudflare Tunnel${colors.reset}\n`);

  // Kill existing processes on port
  await killPort(PORT);

  // Start Next.js and tunnel in parallel
  const [nextProcess, tunnelUrl] = await Promise.all([
    startNextDev(),
    startTunnel(),
  ]);

  // Auto-update WhatsApp webhook
  await updateWhatsAppWebhook(tunnelUrl);

  console.log(`\n${colors.bold}${colors.green}✅ Everything is running!${colors.reset}`);
  console.log(`${colors.cyan}   Local:   http://localhost:${PORT}${colors.reset}`);
  console.log(`${colors.cyan}   Public:  ${tunnelUrl}${colors.reset}`);
  console.log(`${colors.cyan}   Webhook: ${tunnelUrl}/api/webhook${colors.reset}\n`);

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("DEV", colors.yellow, "Shutting down...");
    nextProcess.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  log("DEV", colors.red, `Fatal error: ${err.message}`);
  process.exit(1);
});
