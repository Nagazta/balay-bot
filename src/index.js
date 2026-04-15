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
          await handleMessage(senderId, event.message);
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
