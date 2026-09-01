/* ============================================================
   BABA ELECTRONICS & ELECTRICALS — STARTER PRODUCT CATALOG
   ============================================================
   Once your database (Firebase) is set up, products are managed
   from the Admin panel (admin.html) — add, edit, delete, and
   upload photos right there, no code needed.

   This file now serves two purposes:
   1. A fallback catalog so the shop page still shows products
      even before the database is connected.
   2. A one-click "Import starter catalog" button in the admin
      panel, to load these items into the database as a starting
      point. After that, edit them normally in the admin panel —
      this file no longer needs to be touched.
   ============================================================ */

const STARTER_PRODUCTS = [

  // ---------------- LIGHTING ----------------
  { id: "led-bulb-9w",     name: "LED Bulb 9W",              brand: "Orient",   category: "lighting", unit: "piece", price: 89,   tag: "Best seller" },
  { id: "led-bulb-12w",    name: "LED Bulb 12W",             brand: "CG",       category: "lighting", unit: "piece", price: 119,  tag: "" },
  { id: "tube-light-20w",  name: "LED Tube Light 20W",       brand: "Crompton", category: "lighting", unit: "piece", price: 210,  tag: "" },
  { id: "panel-light-18w", name: "LED Panel Light 18W",      brand: "Nippo",    category: "lighting", unit: "piece", price: 340,  tag: "New stock" },
  { id: "decorative-string",name:"Decorative LED String Light", brand:"Fortuner",category:"lighting", unit: "piece", price: null, tag: "" },

  // ---------------- FANS & APPLIANCES ----------------
  { id: "fan-baba-ceiling", name: "BABA Ceiling Fan 1200mm", brand: "BABA",     category: "fans", unit: "piece", price: null, tag: "Manufactured by BABA" },
  { id: "fan-sac-ceiling",  name: "SAC Ceiling Fan 1200mm",  brand: "SAC",      category: "fans", unit: "piece", price: null, tag: "Manufactured by SAC" },
  { id: "fan-ssc-ceiling",  name: "SSC Ceiling Fan 1200mm",  brand: "SSC",      category: "fans", unit: "piece", price: null, tag: "Manufactured by SSC" },
  { id: "fan-table",        name: "Table Fan 16 inch",       brand: "Kenstar",  category: "fans", unit: "piece", price: 1450, tag: "" },
  { id: "fan-exhaust",      name: "Exhaust Fan 8 inch",      brand: "Crompton", category: "fans", unit: "piece", price: 690,  tag: "" },

  // ---------------- WIRES, CABLES & PVC ----------------
  { id: "wire-1.5sqmm",    name: "Copper Wire 1.5 sq mm",    brand: "Paras",    category: "cables", unit: "roll (90m)", price: 1650, tag: "" },
  { id: "wire-2.5sqmm",    name: "Copper Wire 2.5 sq mm",    brand: "Paras",    category: "cables", unit: "roll (90m)", price: 2450, tag: "Wholesale rate" },
  { id: "pvc-conduit-20mm",name: "PVC Conduit Pipe 20mm",    brand: "KVI",      category: "cables", unit: "piece (3m)", price: 95,   tag: "" },
  { id: "flexible-cable",  name: "Flexible Cable 4 sq mm",   brand: "Altek",    category: "cables", unit: "meter", price: 42, tag: "" },

  // ---------------- TOOLS, HARDWARE & MCBs ----------------
  { id: "mcb-single-16a",  name: "MCB Single Pole 16A",      brand: "CG",       category: "tools", unit: "piece", price: 145, tag: "" },
  { id: "mcb-double-32a",  name: "MCB Double Pole 32A",      brand: "CG",       category: "tools", unit: "piece", price: 320, tag: "" },
  { id: "screwdriver-set", name: "Insulated Screwdriver Set",brand: "Nippo",    category: "tools", unit: "set", price: 260, tag: "" },
  { id: "tester-pen",      name: "Line Tester Pen",          brand: "Nippo",    category: "tools", unit: "piece", price: 40, tag: "" },

];

/* Category display info — edit labels here if you rename categories above.
   Used by the shop page and the admin panel's "Add product" form. */
const CATEGORIES = [
  { id: "lighting", label: "Bulbs & Lighting" },
  { id: "fans",     label: "Fans & Appliances" },
  { id: "cables",   label: "Wires, Cables & PVC" },
  { id: "tools",    label: "Tools, Hardware & MCBs" },
];
