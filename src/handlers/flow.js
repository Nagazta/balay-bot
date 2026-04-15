// =============================================
// CONVERSATION FLOW HANDLER
// Routes each user step to the right response
// =============================================

const { sendText, sendQuickReplies, sendCard } = require("../services/messenger");
const { getSession, resetSession, setStep }    = require("../services/session");
const { PRICES, PAYMENT }                      = require("../config/prices");

// ── Entry point for text messages ───────────────
async function handleMessage(senderId, message) {
  const session = getSession(senderId);

  // If a human agent has taken over, stop the bot
  if (session.humanHandoff) return;

  // Quick reply buttons arrive as messages with a quick_reply payload — route them like postbacks
  if (message.quick_reply?.payload) {
    return handlePostback(senderId, { payload: message.quick_reply.payload });
  }

  const text = (message.text ?? "").trim().toLowerCase();

  // Allow "restart" anywhere in the flow
  if (text === "restart" || text === "start over") {
    resetSession(senderId);
    return greet(senderId);
  }

  switch (session.step) {
    case "start":
      return greet(senderId);

    case "ask_checkin":
      return handleCheckIn(senderId, message.text?.trim());

    case "ask_checkout":
      return handleCheckOut(senderId, message.text?.trim());

    case "ask_name":
      return handleName(senderId, message.text?.trim());

    default:
      return sendText(
        senderId,
        "I didn't quite catch that. Type \"restart\" to start over, or choose an option from the menu. 😊"
      );
  }
}

// ── Entry point for postback / quick-reply ──────
async function handlePostback(senderId, postback) {
  const session = getSession(senderId);
  if (session.humanHandoff) return;

  const payload = postback.payload ?? "";

  // ── Top-level menu ──────────────────────────
  if (payload === "GET_STARTED" || payload === "MENU") {
    return greet(senderId);
  }

  if (payload === "CHAT_BOT") {
    return showMenu(senderId);
  }

  if (payload === "CHAT_HUMAN") {
    session.humanHandoff = true;
    setStep(senderId, "humanHandoff");
    return sendText(
      senderId,
      "👋 Sure! A member of our team will be with you shortly.\n\nYou can also reach us directly on our Facebook page. We'll get back to you as soon as possible! 😊"
    );
  }

  if (payload === "BOOK_NOW") {
    return askAccommodation(senderId);
  }

  if (payload === "FAQ") {
    return showFaq(senderId);
  }

  if (payload === "FAQ_LOCATION") {
    return sendLocation(senderId);
  }

  if (payload === "FAQ_FLOOR1") {
    return sendFloor1Photos(senderId);
  }

  if (payload === "FAQ_FLOOR2") {
    return sendFloor2Photos(senderId);
  }

  if (payload === "FAQ_HUMAN") {
    session.humanHandoff = true;
    setStep(senderId, "humanHandoff");
    return sendText(
      senderId,
      "👋 Sure! A member of our team will get back to you shortly. You can also reach us directly on our Facebook page. 😊"
    );
  }

  if (payload === "VIEW_PRICES") {
    return showPrices(senderId);
  }

  // ── Accommodation ────────────────────────────
  if (payload === "ACCOM_FIRST" || payload === "ACCOM_SECOND" || payload === "ACCOM_NONE") {
    session.booking.accommodation = payload;
    return askAccommodationType(senderId, payload);
  }

  if (["TYPE_REGULAR", "TYPE_UPGRADE", "TYPE_BARKADA"].includes(payload)) {
    session.booking.accommodationType = payload;
    return askServices(senderId);
  }

  // ── Add-on services ──────────────────────────
  if (payload === "ADD_ISLAND") {
    return askIslandHopping(senderId);
  }

  if (["IH_ONE", "IH_DOUBLE", "IH_TRI"].includes(payload)) {
    session.booking.islandHoppingType = payload;
    if (!session.booking.services.includes("islandHopping")) {
      session.booking.services.push("islandHopping");
    }
    return askMoreServices(senderId);
  }

  if (payload === "ADD_MOTO") {
    return askMotorcycle(senderId);
  }

  if (["MOTO_REGULAR", "MOTO_UPGRADE"].includes(payload)) {
    session.booking.motorcycleType = payload;
    if (!session.booking.services.includes("motorcycle")) {
      session.booking.services.push("motorcycle");
    }
    return askMoreServices(senderId);
  }

  if (payload === "ADD_LANDTOUR") {
    return askLandTour(senderId);
  }

  if (["LT_SANTAFE", "LT_BANTAYAN"].includes(payload)) {
    session.booking.landTourType = payload;
    if (!session.booking.services.includes("landTour")) {
      session.booking.services.push("landTour");
    }
    return askMoreServices(senderId);
  }

  if (payload === "ADD_PHOTOS") {
    session.booking.photosVideos = true;
    return askMoreServices(senderId);
  }

  if (payload === "SERVICES_DONE") {
    return askCheckIn(senderId);
  }

  // ── Confirm / restart ────────────────────────
  if (payload === "CONFIRM_BOOKING") {
    return confirmBooking(senderId);
  }

  if (payload === "RESTART") {
    resetSession(senderId);
    return greet(senderId);
  }
}

// ── Helpers ─────────────────────────────────────

async function greet(senderId) {
  setStep(senderId, "welcome");
  await sendText(
    senderId,
    "🏠 Welcome to Balay Santa Fe — Bantayan Island!\n\nWould you like to chat with our bot or talk to a human agent?"
  );
  return sendQuickReplies(senderId, "Please choose:", [
    { title: "🤖 Chat with Bot",  payload: "CHAT_BOT"   },
    { title: "👤 Talk to Human", payload: "CHAT_HUMAN" },
  ]);
}

async function showMenu(senderId) {
  setStep(senderId, "menu");
  return sendQuickReplies(senderId, "How can we help you today?", [
    { title: "📅 Book Now",    payload: "BOOK_NOW"    },
    { title: "💰 View Prices", payload: "VIEW_PRICES" },
    { title: "❓ FAQ",         payload: "FAQ"         },
  ]);
}

// ── FAQ ─────────────────────────────────────────

async function showFaq(senderId) {
  setStep(senderId, "faq");
  await sendText(senderId, "❓ *Frequently Asked Questions*\n\nWhat would you like to know?");
  return sendQuickReplies(senderId, "Choose a topic:", [
    { title: "📍 Location",          payload: "FAQ_LOCATION" },
    { title: "🛏️ 1st Floor Photos",  payload: "FAQ_FLOOR1"   },
    { title: "🛏️ 2nd Floor Photos",  payload: "FAQ_FLOOR2"   },
    { title: "👤 Talk to Human",     payload: "FAQ_HUMAN"    },
    { title: "⬅️ Main Menu",         payload: "CHAT_BOT"     },
  ]);
}

async function sendLocation(senderId) {
  await sendText(
    senderId,
    "📍 *Balay Santa Fe Location*\n\n" +
    "Balay Santa Fe is located in Santa Fe, Bantayan Island, Cebu, Philippines.\n\n" +
    "🗺️ Google Maps:\n" +
    "https://maps.google.com/?q=Santa+Fe+Bantayan+Island+Cebu+Philippines"
  );
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "🛏️ 1st Floor Photos", payload: "FAQ_FLOOR1" },
    { title: "🛏️ 2nd Floor Photos", payload: "FAQ_FLOOR2" },
    { title: "⬅️ Back to FAQ",      payload: "FAQ"        },
  ]);
}

async function sendFloor1Photos(senderId) {
  const BASE = process.env.BASE_URL || "https://balay-bot.onrender.com";
  const photos = [
    `${BASE}/images/1.jpg`,
    `${BASE}/images/2.jpg`,
    `${BASE}/images/3.jpg`,
    `${BASE}/images/4.jpg`,
    `${BASE}/images/5.jpg`,
    `${BASE}/images/6.jpg`,
    `${BASE}/images/7.jpg`,
    `${BASE}/images/8.jpg`,
    `${BASE}/images/9.jpg`,
  ];

  await sendText(senderId, "🛏️ *First Floor — Balay Santa Fe*");
  for (const url of photos) {
    await sendImage(senderId, url);
  }
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "🛏️ 2nd Floor Photos", payload: "FAQ_FLOOR2" },
    { title: "📅 Book Now",         payload: "BOOK_NOW"   },
    { title: "⬅️ Back to FAQ",      payload: "FAQ"        },
  ]);
}

async function sendFloor2Photos(senderId) {
  const BASE = process.env.BASE_URL || "https://balay-bot.onrender.com";
  const photos = [
    `${BASE}/images/2.1.jpg`,
    `${BASE}/images/2.2.jpg`,
    `${BASE}/images/2.3.jpg`,
    `${BASE}/images/2.4.jpg`,
  ];

  await sendText(senderId, "🛏️ *Second Floor — Balay Santa Fe*");
  for (const url of photos) {
    await sendImage(senderId, url);
  }
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "🛏️ 1st Floor Photos", payload: "FAQ_FLOOR1" },
    { title: "📅 Book Now",         payload: "BOOK_NOW"   },
    { title: "⬅️ Back to FAQ",      payload: "FAQ"        },
  ]);
}

async function showPrices(senderId) {
  setStep(senderId, "menu");
  const msg =
    "💰 *BALAY SANTA FE — RATES*\n\n" +
    "🛏️ First Floor\n" +
    "  • Regular  — ₱500\n  • Upgrade  — ₱800\n  • Barkada  — ₱1,500\n\n" +
    "🛏️ Second Floor\n" +
    "  • Regular  — ₱600\n  • Upgrade  — ₱1,000\n  • Barkada  — ₱1,800\n\n" +
    "🏝️ Island Hopping\n" +
    "  • 1 Island  — ₱300\n  • 2 Islands — ₱500\n  • 3 Islands — ₱700\n\n" +
    "🛵 Motorcycle Rental\n" +
    "  • Regular — ₱200\n  • Upgrade  — ₱350\n\n" +
    "🗺️ Land Tour\n" +
    "  • Santa Fe Only         — ₱400\n  • Santa Fe + Bantayan — ₱600\n\n" +
    "📸 Photos & Videos — ₱200\n\n" +
    "Ready to book?";

  await sendText(senderId, msg);
  return sendQuickReplies(senderId, "What would you like to do?", [
    { title: "📅 Book Now", payload: "BOOK_NOW"  },
    { title: "⬅️ Main Menu", payload: "MENU"     },
  ]);
}

async function askAccommodation(senderId) {
  setStep(senderId, "ask_accommodation");
  return sendQuickReplies(senderId, "🛏️ Which accommodation would you like?", [
    { title: "First Floor",  payload: "ACCOM_FIRST"  },
    { title: "Second Floor", payload: "ACCOM_SECOND" },
    { title: "No Room Needed", payload: "ACCOM_NONE" },
  ]);
}

async function askAccommodationType(senderId, accommodation) {
  if (accommodation === "ACCOM_NONE") {
    return askServices(senderId);
  }
  setStep(senderId, "ask_accom_type");
  return sendQuickReplies(senderId, "Which package type?", [
    { title: "Regular",       payload: "TYPE_REGULAR" },
    { title: "Upgrade",       payload: "TYPE_UPGRADE" },
    { title: "Barkada Bundle", payload: "TYPE_BARKADA" },
  ]);
}

async function askServices(senderId) {
  setStep(senderId, "ask_services");
  return sendQuickReplies(senderId, "🏝️ Add-on services (choose all that apply):", [
    { title: "Island Hopping",     payload: "ADD_ISLAND"   },
    { title: "Motorcycle Rental",  payload: "ADD_MOTO"     },
    { title: "Land Tour",          payload: "ADD_LANDTOUR" },
    { title: "Photos & Videos",    payload: "ADD_PHOTOS"   },
    { title: "✅ Done",            payload: "SERVICES_DONE"},
  ]);
}

async function askMoreServices(senderId) {
  const session = getSession(senderId);
  const selected = session.booking.services
    .map((s) => ({ islandHopping: "🏝️ Island Hopping", motorcycle: "🛵 Motorcycle", landTour: "🗺️ Land Tour" }[s]))
    .filter(Boolean);

  const photosLabel = session.booking.photosVideos ? "\n📸 Photos & Videos" : "";
  const summary     = selected.length
    ? `\nSelected so far: ${selected.join(", ")}${photosLabel}`
    : "";

  return sendQuickReplies(senderId, `Anything else?${summary}`, [
    { title: "Island Hopping",    payload: "ADD_ISLAND"   },
    { title: "Motorcycle Rental", payload: "ADD_MOTO"     },
    { title: "Land Tour",         payload: "ADD_LANDTOUR" },
    { title: "Photos & Videos",   payload: "ADD_PHOTOS"   },
    { title: "✅ Done",           payload: "SERVICES_DONE"},
  ]);
}

async function askIslandHopping(senderId) {
  setStep(senderId, "ask_island");
  return sendQuickReplies(senderId, "🏝️ Which island hopping package?", [
    { title: "1 Island  — ₱300",  payload: "IH_ONE"    },
    { title: "2 Islands — ₱500",  payload: "IH_DOUBLE" },
    { title: "3 Islands — ₱700",  payload: "IH_TRI"    },
  ]);
}

async function askMotorcycle(senderId) {
  setStep(senderId, "ask_moto");
  return sendQuickReplies(senderId, "🛵 Which motorcycle package?", [
    { title: "Regular — ₱200", payload: "MOTO_REGULAR" },
    { title: "Upgrade — ₱350", payload: "MOTO_UPGRADE" },
  ]);
}

async function askLandTour(senderId) {
  setStep(senderId, "ask_landtour");
  return sendQuickReplies(senderId, "🗺️ Which land tour package?", [
    { title: "Santa Fe Only — ₱400",          payload: "LT_SANTAFE"  },
    { title: "Santa Fe + Bantayan — ₱600",    payload: "LT_BANTAYAN" },
  ]);
}

async function askCheckIn(senderId) {
  setStep(senderId, "ask_checkin");
  return sendText(senderId, "📅 Please type your *check-in date* (e.g. May 1, 2025):");
}

async function handleCheckIn(senderId, date) {
  const session = getSession(senderId);
  session.booking.checkIn = date;
  setStep(senderId, "ask_checkout");
  return sendText(senderId, "📅 And your *check-out date*?");
}

async function handleCheckOut(senderId, date) {
  const session = getSession(senderId);
  session.booking.checkOut = date;
  setStep(senderId, "ask_name");
  return sendText(senderId, "👤 What's your full name for the booking?");
}

async function handleName(senderId, name) {
  const session = getSession(senderId);
  session.booking.name = name;
  setStep(senderId, "confirm");
  return showSummary(senderId);
}

async function showSummary(senderId) {
  const session = getSession(senderId);
  const b       = session.booking;

  // ── Calculate total ──
  let total = 0;

  const accomKey  = b.accommodation === "ACCOM_FIRST"  ? "firstFloor"
                  : b.accommodation === "ACCOM_SECOND" ? "secondFloor"
                  : null;
  const typeKey   = b.accommodationType === "TYPE_REGULAR" ? "regular"
                  : b.accommodationType === "TYPE_UPGRADE"  ? "upgrade"
                  : b.accommodationType === "TYPE_BARKADA"  ? "barkada"
                  : null;

  if (accomKey && typeKey) {
    total += PRICES[accomKey].options[typeKey].price;
  }

  if (b.services.includes("islandHopping") && b.islandHoppingType) {
    const ihKey = b.islandHoppingType === "IH_ONE" ? "one" : b.islandHoppingType === "IH_DOUBLE" ? "double" : "tri";
    total += PRICES.islandHopping.options[ihKey].price;
  }

  if (b.services.includes("motorcycle") && b.motorcycleType) {
    const mKey = b.motorcycleType === "MOTO_REGULAR" ? "regular" : "upgrade";
    total += PRICES.motorcycle.options[mKey].price;
  }

  if (b.services.includes("landTour") && b.landTourType) {
    const ltKey = b.landTourType === "LT_SANTAFE" ? "santafe" : "bantayan";
    total += PRICES.landTour.options[ltKey].price;
  }

  if (b.photosVideos) {
    total += PRICES.addOns.photosVideos.price;
  }

  b.total = total;

  const accomLabel   = accomKey && typeKey
    ? `${PRICES[accomKey].label} (${PRICES[accomKey].options[typeKey].label})`
    : "No accommodation";
  const servicesList = b.services.length ? b.services.join(", ") : "None";

  const summary =
    "📋 *BOOKING SUMMARY*\n\n" +
    `👤 Name:          ${b.name}\n` +
    `📅 Check-in:      ${b.checkIn}\n` +
    `📅 Check-out:     ${b.checkOut}\n` +
    `🛏️ Accommodation: ${accomLabel}\n` +
    `🏝️ Services:      ${servicesList}\n` +
    `📸 Photos/Videos: ${b.photosVideos ? "Yes" : "No"}\n\n` +
    `💰 *Estimated Total: ₱${total.toLocaleString()}*\n\n` +
    `GCash: ${PAYMENT.gcashNumber} (${PAYMENT.gcashName})\n\n` +
    "Confirm your booking?";

  return sendQuickReplies(senderId, summary, [
    { title: "✅ Confirm",    payload: "CONFIRM_BOOKING" },
    { title: "🔄 Start Over", payload: "RESTART"         },
  ]);
}

async function confirmBooking(senderId) {
  const session = getSession(senderId);
  setStep(senderId, "done");
  await sendText(
    senderId,
    `🎉 Thank you, ${session.booking.name}!\n\nYour booking request has been received. ` +
    `Please send your GCash payment of ₱${session.booking.total.toLocaleString()} to:\n\n` +
    `📱 ${PAYMENT.gcashNumber} (${PAYMENT.gcashName})\n\n` +
    "Once confirmed, we'll send your booking details. See you in Bantayan! 🏝️"
  );
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "⬅️ Main Menu", payload: "MENU" },
  ]);
}

module.exports = { handleMessage, handlePostback };
