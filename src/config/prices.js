// =============================================
// BALAY SANTA FE - PRICING CONFIGURATION
// Edit prices here when client confirms them
// =============================================

const PRICES = {
  firstFloor: {
    label: "First Floor",
    options: {
      regular:       { label: "Regular",       price: 500 },
      upgrade:       { label: "Upgrade",        price: 800 },
      barkada:       { label: "Barkada Bundle", price: 1500 },
    }
  },
  secondFloor: {
    label: "Second Floor",
    options: {
      regular:       { label: "Regular",       price: 600 },
      upgrade:       { label: "Upgrade",        price: 1000 },
      barkada:       { label: "Barkada Bundle", price: 1800 },
    }
  },
  islandHopping: {
    label: "Island Hopping",
    options: {
      one:    { label: "One Island",   price: 300 },
      double: { label: "Double Island", price: 500 },
      tri:    { label: "Tri-Island",   price: 700 },
    }
  },
  motorcycle: {
    label: "Motorcycle Rental",
    options: {
      regular: { label: "Regular (Beatstreet / Mio i125s)", price: 300 },
      upgrade: { label: "Upgrade (Click125 / Genio)",      price: 350 },
    }
  },
  landTour: {
    label: "Land Tour",
    options: {
      santafe:   { label: "Santa Fe Only",         price: 400 },
      bantayan:  { label: "Santa Fe + Bantayan",   price: 600 },
    }
  },
  addOns: {
    photosVideos: { label: "Photos & Videos", price: 200 },
  }
};

// GCash payment details
const PAYMENT = {
  gcashNumber: "09XX-XXX-XXXX",   // Replace with actual GCash number
  gcashName:   "Balay Santa Fe",
  qrImageUrl:  null,               // Replace with actual QR image URL later
};

module.exports = { PRICES, PAYMENT };