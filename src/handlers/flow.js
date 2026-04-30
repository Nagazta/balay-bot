// =============================================
// CONVERSATION FLOW HANDLER
// Routes each user step to the right response
// =============================================

const { sendText, sendQuickReplies, sendImage, sendCarousel } = require("../services/messenger");
const { getSession, resetSession, setStep, markHandoff, unmarkHandoff } = require("../services/session");
const { PRICES, PAYMENT } = require("../config/prices");

// ── Entry point for text messages ───────────────
async function handleMessage(senderId, message) {
  const session = getSession(senderId);

  // If a human agent has taken over, handle it gracefully
  if (session.humanHandoff) {
    if (message.quick_reply?.payload === "RESUME_BOT") {
      unmarkHandoff(senderId);
      resetSession(senderId);
      return greet(senderId);
    }
    if (message.quick_reply?.payload === "STAY_HUMAN") {
      session.lastHandoffPrompt = Date.now();
      return;
    }

    const now = Date.now();
    // Prompt if they typed something text-based and it's been at least 1 hour since the last prompt/interaction
    if (!session.lastHandoffPrompt || (now - session.lastHandoffPrompt > 60 * 60 * 1000)) {
      session.lastHandoffPrompt = now;
      const userName = session.booking?.name ? session.booking.name : "there";
      return sendQuickReplies(
        senderId,
        `Hi ${userName} again! Would you like to chat with our bot or wait for a human agent?`,
        [
          { title: "🤖 Chat with Bot", payload: "RESUME_BOT" },
          { title: "👤 Wait for Human", payload: "STAY_HUMAN" },
        ]
      );
    }
    return;
  }

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
  if (payload === "GET_STARTED") {
    return greet(senderId);
  }

  if (payload === "MENU") {
    return showMenu(senderId);
  }

  if (payload === "CHAT_BOT") {
    return showMenu(senderId);
  }

  if (payload === "CHAT_HUMAN") {
    markHandoff(senderId);
    session.lastHandoffPrompt = Date.now();
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
    markHandoff(senderId);
    session.lastHandoffPrompt = Date.now();
    setStep(senderId, "humanHandoff");
    return sendText(
      senderId,
      "👋 Sure! A member of our team will get back to you shortly. You can also reach us from this number: 0915 687 7635 😊"
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

  if (["TYPE_REGULAR", "TYPE_UPGRADE", "TYPE_BARKADA", "TYPE_PREMIUM_BARKADA"].includes(payload)) {
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
    { title: "🤖 Chat with Bot", payload: "CHAT_BOT" },
    { title: "👤 Talk to Human", payload: "CHAT_HUMAN" },
  ]);
}

async function showMenu(senderId) {
  setStep(senderId, "menu");
  return sendQuickReplies(senderId, "How can we help you today?", [
    { title: "📅 Book Now", payload: "BOOK_NOW" },
    { title: "💰 View Prices", payload: "VIEW_PRICES" },
    { title: "❓ FAQ", payload: "FAQ" },
  ]);
}

// ── FAQ ─────────────────────────────────────────

async function showFaq(senderId) {
  setStep(senderId, "faq");
  await sendText(senderId, "❓ *Frequently Asked Questions*\n\nWhat would you like to know?");
  return sendQuickReplies(senderId, "Choose a topic:", [
    { title: "📍 Location", payload: "FAQ_LOCATION" },
    { title: "🛏️ 1st Floor Photos", payload: "FAQ_FLOOR1" },
    { title: "🛏️ 2nd Floor Photos", payload: "FAQ_FLOOR2" },
    { title: "👤 Talk to Human", payload: "FAQ_HUMAN" },
    { title: "⬅️ Main Menu", payload: "MENU" },
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
    { title: "⬅️ Back to FAQ", payload: "FAQ" },
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
  ];

  await sendText(senderId, "🛏️ *First Floor — Balay Santa Fe*");
  for (const url of photos) {
    await sendImage(senderId, url);
  }
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "🛏️ 2nd Floor Photos", payload: "FAQ_FLOOR2" },
    { title: "📅 Book Now", payload: "BOOK_NOW" },
    { title: "⬅️ Back to FAQ", payload: "FAQ" },
  ]);
}

async function sendFloor2Photos(senderId) {
  const BASE = process.env.BASE_URL || "https://balay-bot.onrender.com";
  const photos = [
    `${BASE}/images/2.1.jpg`,
    `${BASE}/images/2.2.jpg`,
    `${BASE}/images/2.3.jpg`,
    `${BASE}/images/2.4.jpg`,
    `${BASE}/images/2.5.jpg`,
    `${BASE}/images/2.6.jpg`,
  ];

  await sendText(
    senderId,
    "🛏️ *Second Floor — Balay Santa Fe*\n\n" +
    "📌 *3 Bedrooms*\n" +
    "  • Room 1 — Queen-size bed\n" +
    "  • Room 2 — Queen-size bed\n" +
    "  • Room 3 — 2 Double-size beds, toilet & bath, and a balcony\n" +
    "  • All rooms with split-type AC\n\n" +
    "✅ Smart TV\n" +
    "✅ Refrigerator\n" +
    "✅ Induction Cooker\n" +
    "✅ Rice Cooker\n" +
    "✅ Water Heater\n" +
    "✅ Shared Toilet\n" +
    "✅ WiFi\n" +
    "✅ Kitchen Utensils\n" +
    "✅ Dining Area\n" +
    "✅ Living Area\n" +
    "✅ Potable Water\n" +
    "✅ Kitchen Area\n\n" +
    "📍 Location: Poblacion, Sta Fe\n" +
    "📞 0926-262-9934\n" +
    "📧 balaystafe@gmail.com\n\n" +
    "⚠️ Rates may vary during peak or holiday seasons."
  );

  for (const url of photos) {
    await sendImage(senderId, url);
  }
  return sendQuickReplies(senderId, "Anything else?", [
    { title: "🛏️ 1st Floor Photos", payload: "FAQ_FLOOR1" },
    { title: "📅 Book Now", payload: "BOOK_NOW" },
    { title: "⬅️ Back to FAQ", payload: "FAQ" },
  ]);
}

async function showPrices(senderId) {
  setStep(senderId, "menu");
  const msg =
    "💰 *BALAY SANTA FE — RATES*\n\n" +
    "🛏️ First Floor\n" +
    "  • Barkada Package — ₱999/pax\n  • Upgrade Package — ₱4,599\n  • Regular Rates — ₱4,199\n  • Premium Barkada — ₱1,299/pax\n\n" +
    "🛏️ Second Floor\n" +
    "  • Regular Rates — ₱4,599\n  • Upgrade Rates — ₱5,299\n  • Barkada Package — ₱999/pax\n  • Premium Barkada — ₱1,299/pax\n\n" +
    "🏝️ Island Hopping (Min. 5 Pax)\n" +
    "  Price per head:\n" +
    "  • Single Island — ₱480\n  • Two Islands — ₱550\n  • Tri-Island — ₱650\n" +
    "  *(Incl. boat fee & pickup/drop-off. Entrance/eco fees excluded)*\n\n" +
    "🛵 Motorcycle Rental\n" +
    "  Upgrade:  Honda Click125 / Honda Genio — ₱350\n" +
    "  Regular: Honda Beatstreet / Yamaha Mio i125s — ₱300\n\n" +
    "🗺️ Land Tour\n" +
    "  • Santa Fe Only         — ₱400\n  • Santa Fe + Bantayan — ₱600\n\n" +
    "📸 Photos & Videos — ₱200\n\n" +
    "Ready to book?";

  await sendText(senderId, msg);
  return sendQuickReplies(senderId, "What would you like to do?", [
    { title: "📅 Book Now", payload: "BOOK_NOW" },
    { title: "⬅️ Main Menu", payload: "MENU" },
  ]);
}

async function askAccommodation(senderId) {
  setStep(senderId, "ask_accommodation");
  return sendQuickReplies(senderId, "🛏️ Which accommodation would you like?", [
    { title: "First Floor", payload: "ACCOM_FIRST" },
    { title: "Second Floor", payload: "ACCOM_SECOND" },
    { title: "No Room Needed", payload: "ACCOM_NONE" },
  ]);
}

async function askAccommodationType(senderId, accommodation) {
  if (accommodation === "ACCOM_NONE") {
    return askServices(senderId);
  }
  setStep(senderId, "ask_accom_type");
  const BASE = process.env.BASE_URL || "https://balay-bot.onrender.com";

  let elements = [];
  if (accommodation === "ACCOM_FIRST") {
    elements = [
      {
        title: "Barkada Package - ₱999/pax",
        subtitle: "Min 7pax. Bedrm, Land Tour, Wifi, Beach Access, Breakfast in Bilao.",
        image_url: `${BASE}/images/BarkadaPackage-first.png`,
        buttons: [{ title: "Select Barkada", payload: "TYPE_BARKADA" }]
      },
      {
        title: "Upgrade Package - ₱4,599",
        subtitle: "Min 7pax (Extra: ₱599/pax). Bedrm, Land Tour, Wifi, Beach, Breakfast.",
        image_url: `${BASE}/images/UpgradePackage-first.png`,
        buttons: [{ title: "Select Upgrade", payload: "TYPE_UPGRADE" }]
      },
      {
        title: "Regular Rates - ₱4,199",
        subtitle: "Min 7pax (Extra: ₱499/pax). Whole House, Wifi, Beach Access, Kitchen.",
        image_url: `${BASE}/images/RegularRates-first.png`,
        buttons: [{ title: "Select Regular", payload: "TYPE_REGULAR" }]
      },
      {
        title: "Premium Barkada - ₱1299/pax",
        subtitle: "Min 7pax. 3-Bedrm, Land Tour, Wifi, Island Hopping, Breakfast.",
        image_url: `${BASE}/images/PremiumBarkada-first.png`,
        buttons: [{ title: "Select Premium", payload: "TYPE_PREMIUM_BARKADA" }]
      }
    ];
  } else {
    // ACCOM_SECOND
    elements = [
      {
        title: "Barkada Package - ₱999/pax",
        subtitle: "Min 8pax. 3-Bedrm, Land Tour, Wifi, Beach Access, Breakfast in Bilao.",
        image_url: `${BASE}/images/BarkadaPackage-Second.png`,
        buttons: [{ title: "Select Barkada", payload: "TYPE_BARKADA" }]
      },
      {
        title: "Upgrade Rates - ₱5,299",
        subtitle: "Min 8pax (Extra: ₱599/pax). Whole House, Wifi, Beach, Breakfast.",
        image_url: `${BASE}/images/UpgradeRates - Second.png`,
        buttons: [{ title: "Select Upgrade", payload: "TYPE_UPGRADE" }]
      },
      {
        title: "Regular Rates - ₱4,599",
        subtitle: "Min 8pax (Extra: ₱499/pax). Whole House, Wifi, Beach Access, Kitchen.",
        image_url: `${BASE}/images/RegularRates-Second.png`,
        buttons: [{ title: "Select Regular", payload: "TYPE_REGULAR" }]
      },
      {
        title: "Premium Barkada - ₱1299/pax",
        subtitle: "Min 8pax. 3-Bedrm, Land Tour, Wifi, Island Hopping, Breakfast.",
        image_url: `${BASE}/images/PremiumBarkada-Second.png`,
        buttons: [{ title: "Select Premium", payload: "TYPE_PREMIUM_BARKADA" }]
      }
    ];
  }

  await sendText(senderId, "Here are our packages! Swipe left to see more options:");
  return sendCarousel(senderId, elements);
}

async function askServices(senderId) {
  setStep(senderId, "ask_services");
  return sendQuickReplies(senderId, "🏝️ Add-on services (choose all that apply):", [
    { title: "Island Hopping", payload: "ADD_ISLAND" },
    { title: "Motorcycle Rental", payload: "ADD_MOTO" },
    { title: "Land Tour", payload: "ADD_LANDTOUR" },
    { title: "Photos & Videos", payload: "ADD_PHOTOS" },
    { title: "✅ Done", payload: "SERVICES_DONE" },
  ]);
}

async function askMoreServices(senderId) {
  const session = getSession(senderId);
  const selected = session.booking.services
    .map((s) => ({ islandHopping: "🏝️ Island Hopping", motorcycle: "🛵 Motorcycle", landTour: "🗺️ Land Tour" }[s]))
    .filter(Boolean);

  const photosLabel = session.booking.photosVideos ? "\n📸 Photos & Videos" : "";
  const summary = selected.length
    ? `\nSelected so far: ${selected.join(", ")}${photosLabel}`
    : "";

  return sendQuickReplies(senderId, `Anything else?${summary}`, [
    { title: "Island Hopping", payload: "ADD_ISLAND" },
    { title: "Motorcycle Rental", payload: "ADD_MOTO" },
    { title: "Land Tour", payload: "ADD_LANDTOUR" },
    { title: "Photos & Videos", payload: "ADD_PHOTOS" },
    { title: "✅ Done", payload: "SERVICES_DONE" },
  ]);
}

async function askIslandHopping(senderId) {
  setStep(senderId, "ask_island");
  await sendText(
    senderId,
    "🏝️ *Island Hopping Rates*\n\n" +
    "📌 *Minimum of 5 Pax*\n" +
    "Price per head:\n" +
    "  • Single Island — ₱480\n" +
    "  • Two Islands — ₱550\n" +
    "  • Tri-Island — ₱650\n\n" +
    "✅ *Inclusions:*\n" +
    "  • Boat Fee\n" +
    "  • Drop-off & Pick-up ride from Sta Fe to the starting area\n\n" +
    "⚠️ *Note:* Entrances and ecological fees are excluded."
  );
  return sendQuickReplies(senderId, "Which package?", [
    { title: "Single — ₱480", payload: "IH_ONE" },
    { title: "Double — ₱550", payload: "IH_DOUBLE" },
    { title: "Tri-Island — ₱650", payload: "IH_TRI" },
  ]);
}

async function askMotorcycle(senderId) {
  setStep(senderId, "ask_moto");
  await sendText(
    senderId,
    "🛵 *Motorcycle Rental Rates*\n\n" +
    "📌 *Upgrade — ₱350/day*\n" +
    "  • Honda Click 125\n" +
    "  • Honda Genio\n\n" +
    "📌 *Regular — ₱300/day*\n" +
    "  • Honda Beatstreet\n" +
    "  • Yamaha Mio i125s"
  );
  return sendQuickReplies(senderId, "Which package?", [
    { title: "Upgrade — ₱350", payload: "MOTO_UPGRADE" },
    { title: "Regular — ₱300", payload: "MOTO_REGULAR" },
  ]);
}

async function askLandTour(senderId) {
  setStep(senderId, "ask_landtour");
  return sendQuickReplies(senderId, "🗺️ Which land tour package?", [
    { title: "Santa Fe Only — ₱400", payload: "LT_SANTAFE" },
    { title: "Santa Fe + Bantayan — ₱600", payload: "LT_BANTAYAN" },
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
  const b = session.booking;

  // ── Calculate total ──
  let total = 0;

  const accomKey = b.accommodation === "ACCOM_FIRST" ? "firstFloor"
    : b.accommodation === "ACCOM_SECOND" ? "secondFloor"
      : null;
  const typeKey = b.accommodationType === "TYPE_REGULAR" ? "regular"
    : b.accommodationType === "TYPE_UPGRADE" ? "upgrade"
      : b.accommodationType === "TYPE_BARKADA" ? "barkada"
        : b.accommodationType === "TYPE_PREMIUM_BARKADA" ? "premiumBarkada"
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

  const accomLabel = accomKey && typeKey
    ? `${PRICES[accomKey].label} (${PRICES[accomKey].options[typeKey].label})`
    : "No accommodation";
  const labelMap = { islandHopping: "🏝️ Island Hopping", motorcycle: "🛵 Motorcycle Rental", landTour: "🗺️ Land Tour" };
  const servicesList = b.services.length
    ? b.services.map((s) => labelMap[s] ?? s).join(", ")
    : "None";

  let note = "";
  if (b.accommodationType === "TYPE_BARKADA" || b.accommodationType === "TYPE_PREMIUM_BARKADA") {
    note += `*(Note: Accommodation price is per pax base rate. Min pax applies!)*\n`;
  }
  if (b.services.includes("islandHopping")) {
    note += "*(Note: Island Hopping total shown is per head, minimum 5 pax)*\n";
  }

  const summary =
    "📋 *BOOKING SUMMARY*\n\n" +
    `👤 Name:          ${b.name}\n` +
    `📅 Check-in:      ${b.checkIn}\n` +
    `📅 Check-out:     ${b.checkOut}\n` +
    `🛏️ Accommodation: ${accomLabel}\n` +
    `🏝️ Services:      ${servicesList}\n` +
    `📸 Photos/Videos: ${b.photosVideos ? "Yes" : "No"}\n\n` +
    `💰 *Estimated Total: ₱${total.toLocaleString()}*\n` +
    note + "\n" +
    `GCash: ${PAYMENT.gcashNumber} (${PAYMENT.gcashName})\n\n` +
    "Confirm your booking?";

  return sendQuickReplies(senderId, summary, [
    { title: "✅ Confirm", payload: "CONFIRM_BOOKING" },
    { title: "🔄 Start Over", payload: "RESTART" },
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
