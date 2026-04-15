// =============================================
// MESSENGER SERVICE
// Handles all API calls to Facebook Messenger
// =============================================

const axios = require("axios");
require("dotenv").config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FB_API = "https://graph.facebook.com/v19.0/me/messages";

// Send a plain text message
async function sendText(recipientId, text) {
  await callAPI({
    recipient: { id: recipientId },
    message: { text },
  });
}

// Send quick reply buttons
async function sendQuickReplies(recipientId, text, replies) {
  await callAPI({
    recipient: { id: recipientId },
    message: {
      text,
      quick_replies: replies.map((r) => ({
        content_type: "text",
        title: r.title,
        payload: r.payload,
      })),
    },
  });
}

// Send a generic card (image + title + buttons)
async function sendCard(recipientId, title, subtitle, buttons) {
  await callAPI({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title,
              subtitle,
              buttons: buttons.map((b) => ({
                type: "postback",
                title: b.title,
                payload: b.payload,
              })),
            },
          ],
        },
      },
    },
  });
}

// Send an image
async function sendImage(recipientId, imageUrl) {
  console.log("📸 Sending image:", imageUrl);
  await callAPI({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: true },
      },
    },
  });
}

// Internal - make the actual API call
async function callAPI(body) {
  try {
    await axios.post(FB_API, body, {
      params: { access_token: PAGE_ACCESS_TOKEN },
    });
  } catch (err) {
    const details = JSON.stringify(err.response?.data, null, 2) || err.message;
    console.error("❌ Messenger API Error:\n", details);
  }
}

module.exports = { sendText, sendQuickReplies, sendCard, sendImage };