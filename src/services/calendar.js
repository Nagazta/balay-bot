const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Attempt to load credentials
const credPath1 = path.join(__dirname, '../../balay-bot.json');
const credPath2 = path.join(__dirname, '../../google-credentials.json');
const credPath3 = path.join(__dirname, '../../balay-bot-f82f3d8db039.json');
const credPath4 = '/etc/secrets/balay-bot.json'; // Render specific
let credentialsPath = null;
if (fs.existsSync(credPath1)) credentialsPath = credPath1;
else if (fs.existsSync(credPath2)) credentialsPath = credPath2;
else if (fs.existsSync(credPath3)) credentialsPath = credPath3;
else if (fs.existsSync(credPath4)) credentialsPath = credPath4;

let sheetsAPI = null;
if (credentialsPath) {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  sheetsAPI = google.sheets({ version: 'v4', auth });
} else {
  console.warn("⚠️ Google Sheets credentials not found! Calendar availability checks will fail.");
}

require('dotenv').config();

const SHEET_IDS = {
  firstFloor: process.env.SHEET_ID_FIRST_FLOOR,
  secondFloor: process.env.SHEET_ID_SECOND_FLOOR
};

/**
 * Parses a date string into a Date object at midnight local time.
 */
function parseDate(dateStr) {
  const parsed = new Date(dateStr);
  if (isNaN(parsed)) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

/**
 * Returns true if a color is considered "occupied".
 * Based on user feedback: "if theres colors means its occupied"
 * We treat white or very light beige/yellow (often used as default grid color) as available.
 */
function isColorOccupied(color) {
  if (!color) return false; // No color = available
  const r = color.red || 0;
  const g = color.green || 0;
  const b = color.blue || 0;
  
  // White
  if (r === 1 && g === 1 && b === 1) return false;
  
  // Very light yellow/beige (R: 1, G: ~0.95, B: ~0.8) often used as background
  if (r > 0.9 && g > 0.9 && b > 0.7) return false;

  // Anything else (blue, orange, etc.) is occupied
  return true;
}

/**
 * Checks availability for a range of dates.
 * Returns { available: boolean, reason?: string }
 */
async function checkAvailability(floorKey, checkInStr, checkOutStr) {
  if (!sheetsAPI) {
    return { available: false, reason: "Calendar system is currently offline." };
  }

  const checkIn = parseDate(checkInStr);
  const checkOut = parseDate(checkOutStr);

  if (!checkIn || !checkOut || checkIn >= checkOut) {
    return { available: false, reason: "Invalid dates provided." };
  }

  const spreadsheetId = SHEET_IDS[floorKey];
  if (!spreadsheetId) {
    return { available: false, reason: "Invalid floor selection." };
  }

  try {
    // We fetch the first sheet in the document with cell formatting included
    const response = await sheetsAPI.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
    });

    const sheet = response.data.sheets[0];
    const gridData = sheet.data[0];
    const rowData = gridData.rowData || [];

    // Build a map of dates to their cell colors
    const dateColorMap = new Map();

    for (let r = 0; r < rowData.length; r++) {
      const row = rowData[r];
      const values = row.values || [];
      for (let c = 0; c < values.length; c++) {
        const cell = values[c];
        if (!cell || !cell.effectiveValue) continue;

        // Effective value number format is a Google Sheets serial date (days since Dec 30, 1899)
        // However, cell.formattedValue is usually safer if the user types it as text OR date.
        let cellDate = null;
        if (cell.formattedValue) {
          const parsed = parseDate(cell.formattedValue);
          if (parsed && !isNaN(parsed)) {
            cellDate = parsed.getTime();
          }
        }

        if (cellDate) {
          const bgColor = cell.effectiveFormat?.backgroundColor || null;
          dateColorMap.set(cellDate, bgColor);
        }
      }
    }

    // Now check all dates between checkIn and checkOut (exclusive of checkOut day itself)
    // Actually, hotels usually charge per night. If you check in May 1, out May 3. You stay nights of May 1 and May 2.
    // So we check May 1 and May 2.
    let currentDate = new Date(checkIn);
    while (currentDate < checkOut) {
      const time = currentDate.getTime();
      
      // If the date is completely missing from the sheet, we assume it's NOT available (or we can assume it IS available)
      // Since it's a visual calendar, if they forgot to add a month, we should probably reject it to be safe, or just assume available.
      // Let's assume available if missing to prevent breaking the flow if they haven't made the calendar yet.
      // Actually, safest is to assume available if missing, but occupied if color is found.
      if (dateColorMap.has(time)) {
        const color = dateColorMap.get(time);
        if (isColorOccupied(color)) {
          return { 
            available: false, 
            reason: `Sorry, ${currentDate.toDateString()} is fully booked or pending. Please try different dates!` 
          };
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { available: true };

  } catch (error) {
    console.error("Error checking Google Sheets:", error.message);
    return { available: false, reason: "Could not connect to the booking calendar. Please try again later." };
  }
}

module.exports = { checkAvailability };
