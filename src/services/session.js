// =============================================
// SESSION MANAGER
// Tracks each user's conversation state
// in memory, and persists human handoff state
// =============================================

const fs = require("fs");
const path = require("path");

const sessions = {};
const HANDOFF_FILE = path.join(__dirname, "../../handoff.json");

// Load persistent handoff list
let handoffList = new Set();
try {
  if (fs.existsSync(HANDOFF_FILE)) {
    const data = fs.readFileSync(HANDOFF_FILE, "utf8");
    handoffList = new Set(JSON.parse(data));
  }
} catch (err) {
  console.error("Error loading handoff file:", err);
}

function saveHandoff() {
  fs.writeFileSync(HANDOFF_FILE, JSON.stringify(Array.from(handoffList)), "utf8");
}

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      step: "start",
      booking: {
        accommodation: null,
        accommodationType: null,
        services: [],
        islandHoppingType: null,
        motorcycleType: null,
        landTourType: null,
        checkIn: null,
        checkOut: null,
        nights: null,
        pax: null,
        total: 0,
        name: null,
      },
    };
  }
  
  // Attach persistent handoff state
  sessions[userId].humanHandoff = handoffList.has(userId);
  return sessions[userId];
}

function markHandoff(userId) {
  handoffList.add(userId);
  saveHandoff();
  if (sessions[userId]) {
    sessions[userId].humanHandoff = true;
  }
}

function unmarkHandoff(userId) {
  handoffList.delete(userId);
  saveHandoff();
  if (sessions[userId]) {
    sessions[userId].humanHandoff = false;
  }
}

function resetSession(userId) {
  sessions[userId] = null;
  // Note: resetSession does NOT remove human handoff once set!
  return getSession(userId);
}

function setStep(userId, step) {
  const session = getSession(userId);
  session.step = step;
}

module.exports = { getSession, resetSession, setStep, markHandoff, unmarkHandoff };