// =============================================
// SESSION MANAGER
// Tracks each user's conversation state
// in memory (no database needed)
// =============================================

const sessions = {};

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      step: "start",
      booking: {
        accommodation: null,     // firstFloor / secondFloor / none
        accommodationType: null, // regular / upgrade / barkada
        services: [],            // islandHopping, motorcycle, landTour
        islandHoppingType: null,
        motorcycleType: null,
        landTourType: null,
        photosVideos: false,
        checkIn: null,
        checkOut: null,
        total: 0,
        name: null,
      },
      humanHandoff: false,       // true = stop bot, human takes over
    };
  }
  return sessions[userId];
}

function resetSession(userId) {
  sessions[userId] = null;
  return getSession(userId);
}

function setStep(userId, step) {
  const session = getSession(userId);
  session.step = step;
}

module.exports = { getSession, resetSession, setStep };