// =============================================
// BALAY SANTA FE - PRICING CONFIGURATION
// Edit prices here when client confirms them
// =============================================

const PRICES = {
  firstFloor: {
    label: "First Floor",
    options: {
      regular: { label: "Regular Rates", price: 4199 },
      upgrade: { label: "Upgrade Package", price: 4599 },
      barkada: { label: "Barkada Package", price: 999 },
      premiumBarkada: { label: "Premium Barkada", price: 1299 },
    }
  },
  secondFloor: {
    label: "Second Floor",
    options: {
      regular: { label: "Regular Rates", price: 4599 },
      upgrade: { label: "Upgrade Rates", price: 5299 },
      barkada: { label: "Barkada Package", price: 999 },
      premiumBarkada: { label: "Premium Barkada", price: 1299 },
    }
  },
  islandHopping: {
    label: "Island Hopping",
    options: {
      one: { label: "Single Island (per head)", price: 480 },
      double: { label: "Two Islands (per head)", price: 550 },
      tri: { label: "Tri-Island (per head)", price: 650 },
    }
  },
  motorcycle: {
    label: "Motorcycle Rental",
    options: {
      regular: { label: "Regular (Beatstreet / Mio i125s)", price: 300 },
      upgrade: { label: "Upgrade (Click125 / Genio)", price: 350 },
    }
  },
  landTour: {
    label: "Land Tour",
    options: {
      santafe: { label: "Santa Fe Only", price: 400 },
      bantayan: { label: "Santa Fe + Bantayan", price: 600 },
    }
  },
};

// GCash payment details
const PAYMENT = {
  gcashNumber: "09XX-XXX-XXXX",   // Replace with actual GCash number
  gcashName: "Balay Santa Fe",
  qrImageUrl: null,               // Replace with actual QR image URL later
};

module.exports = { PRICES, PAYMENT };