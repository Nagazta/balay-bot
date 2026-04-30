// =============================================
// BALAY SANTA FE BOT — ENTRY POINT
// Express server + Facebook Webhook
// =============================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const { handleMessage, handlePostback } = require("./handlers/flow");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ── Webhook Verification (GET) ──────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    return res.status(200).send(challenge);
  }

  console.warn("⚠️  Webhook verification failed.");
  res.sendStatus(403);
});

// ── Incoming Events (POST) ──────────────────────
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") {
    return res.sendStatus(404);
  }

  // Acknowledge immediately so Facebook won't retry
  res.sendStatus(200);

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      if (!senderId) continue;

      try {
        if (event.message) {
          if (event.message.is_echo) {
            // A message was sent by the page (staff or bot)
            // If it lacks an app_id, it was sent by a human staff using Business Suite Inbox.
            const isHuman = !event.message.app_id || (process.env.APP_ID && event.message.app_id.toString() !== process.env.APP_ID);
            
            if (isHuman) {
              const recipientId = event.recipient?.id;
              if (recipientId) {
                console.log("👤 Human staff reply detected! Disabling bot for user:", recipientId);
                require("./services/session").markHandoff(recipientId);
                const session = require("./services/session").getSession(recipientId);
                session.lastHandoffPrompt = Date.now();
              }
            }
          } else {
            await handleMessage(senderId, event.message);
          }
        } else if (event.postback) {
          await handlePostback(senderId, event.postback);
        }
      } catch (err) {
        console.error("❌ Error handling event:", err.message);
      }
    }
  }
});

// ── Health check ────────────────────────────────
app.get("/", (_req, res) => res.send("🏠 Balay Santa Fe Bot is running!"));

// ── Start ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
