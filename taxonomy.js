/* ============================================================
   CATEGORY / SUBCATEGORY / BRAND TAXONOMY
   ============================================================
   Shared by the shop page, the admin panel, and product filtering.
   This is a static starter list for now — a later admin-panel
   update will let you manage these from a screen instead of this
   file, but everything (product tagging, brand pages, category
   nav) already reads from here, so that upgrade won't need any
   other file to change.

   Editing this file:
   - Category/subcategory `id` values are what products' categoryId
     / subcategoryId fields point to (see products.js) — don't
     rename an id that's already in use without updating products
     to match, or products under it will stop showing there.
   - `displayOrder` controls left-to-right / top-to-bottom order
     everywhere these are listed. Lower numbers show first.
   - Setting `active: false` hides a category/subcategory/brand
     from the shop page without deleting any products — they just
     won't be filterable by it until it's turned back on.
   ============================================================ */

const CATEGORIES = [
  {
    id: "lighting",
    label: "Bulbs & Lighting",
    active: true,
    displayOrder: 1,
    subcategories: [],
  },
  {
    id: "fans",
    label: "Fans",
    active: true,
    displayOrder: 2,
    subcategories: [
      { id: "ceiling-fans", label: "Ceiling Fans", active: true, displayOrder: 1 },
      { id: "table-fans", label: "Table Fans", active: true, displayOrder: 2 },
      { id: "pedestal-fans", label: "Pedestal Fans", active: true, displayOrder: 3 },
      { id: "exhaust-fans", label: "Exhaust Fans", active: true, displayOrder: 4 },
      { id: "wall-fans", label: "Wall Fans", active: true, displayOrder: 5 },
      { id: "decorative-fans", label: "Decorative Fans", active: true, displayOrder: 6 },
      { id: "other-fans", label: "Other Fans & Fan Parts", active: true, displayOrder: 7 },
    ],
  },
  {
    id: "appliances",
    label: "Appliances",
    active: true,
    displayOrder: 3,
    subcategories: [
      { id: "coolers", label: "Air Coolers", active: true, displayOrder: 1 },
      { id: "irons", label: "Irons", active: true, displayOrder: 2 },
      { id: "heaters", label: "Heaters & Geysers", active: true, displayOrder: 3 },
      { id: "kitchen-appliances", label: "Kitchen Appliances", active: true, displayOrder: 4 },
      { id: "tv-electronics", label: "TVs & Electronics", active: true, displayOrder: 5 },
      { id: "other-appliances", label: "Other Appliances", active: true, displayOrder: 6 },
    ],
  },
  {
    id: "cables",
    label: "Wires, Cables & PVC",
    active: true,
    displayOrder: 4,
    subcategories: [],
  },
  {
    id: "tools",
    label: "Tools, Hardware & MCBs",
    active: true,
    displayOrder: 5,
    subcategories: [],
  },
  {
    id: "sound",
    label: "Woofer & Sound",
    active: true,
    displayOrder: 6,
    subcategories: [],
  },
  {
    id: "other",
    label: "Other / Misc",
    active: true,
    displayOrder: 7,
    subcategories: [],
  },
];

// Brand ids match brandSlug(brand text) used when products.js was migrated
// (lowercase, spaces/punctuation -> "-"), so existing product.brandId
// values line up with these without touching products.js again.
const BRANDS = [
  { id: "baba", name: "BABA", active: true, displayOrder: 1, logo: "" },
  { id: "sac", name: "SAC", active: true, displayOrder: 2, logo: "" },
  { id: "ssc", name: "SSC", active: true, displayOrder: 3, logo: "" },
  { id: "servokon", name: "SERVOKON", active: true, displayOrder: 4, logo: "" },
  { id: "ego", name: "EGO", active: true, displayOrder: 5, logo: "" },
  { id: "gratex", name: "Gratex", active: true, displayOrder: 6, logo: "" },
  { id: "zebronics", name: "Zebronics", active: true, displayOrder: 7, logo: "" },
  { id: "nippo", name: "Nippo", active: true, displayOrder: 8, logo: "" },
  { id: "orient", name: "Orient", active: true, displayOrder: 9, logo: "" },
  { id: "altek", name: "Altek", active: true, displayOrder: 10, logo: "" },
  { id: "fortuner", name: "Fortuner", active: true, displayOrder: 11, logo: "" },
  { id: "paras", name: "Paras", active: true, displayOrder: 12, logo: "" },
  { id: "cg", name: "CG", active: true, displayOrder: 13, logo: "" },
  { id: "crompton", name: "Crompton", active: true, displayOrder: 14, logo: "" },
  { id: "kenstar", name: "Kenstar", active: true, displayOrder: 15, logo: "" },
  { id: "kvi", name: "KVI", active: true, displayOrder: 16, logo: "" },
  { id: "havells", name: "Havells", active: true, displayOrder: 17, logo: "" },
  { id: "usha", name: "Usha", active: true, displayOrder: 18, logo: "" },
  { id: "whirlpool", name: "Whirlpool", active: true, displayOrder: 19, logo: "" },
  { id: "ceeje", name: "Ceeje", active: true, displayOrder: 20, logo: "" },
  { id: "kineto", name: "Kineto", active: true, displayOrder: 21, logo: "" },
  { id: "universal", name: "Universal", active: true, displayOrder: 22, logo: "" },
  { id: "rexolite", name: "Rexolite", active: true, displayOrder: 23, logo: "" },
  { id: "auxalite", name: "Auxalite", active: true, displayOrder: 24, logo: "" },
  // Catch-all for the ~1,860 starter-catalog items that were never tagged
  // with a real brand (imported as "Homegrown") — kept last and out of the
  // "Shop by Brand" strip by default so it doesn't crowd out real brands;
  // re-tag these with their actual brand from the admin panel over time.
  { id: "homegrown", name: "Other / Local Stock", active: false, displayOrder: 99, logo: "" },
];

/* ---- lookup helpers, used by app.js / admin.html ---- */
function findCategory(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || null;
}
function findSubcategory(categoryId, subcategoryId) {
  const cat = findCategory(categoryId);
  if (!cat || !subcategoryId) return null;
  return cat.subcategories.find((s) => s.id === subcategoryId) || null;
}
function categoryLabelFor(categoryId) {
  const c = findCategory(categoryId);
  return c ? c.label : categoryId;
}
function subcategoryLabelFor(categoryId, subcategoryId) {
  const s = findSubcategory(categoryId, subcategoryId);
  return s ? s.label : "";
}
function brandLabelFor(brandId) {
  const b = BRANDS.find((x) => x.id === brandId);
  return b ? b.name : brandId;
}
function activeBrandsSorted() {
  return BRANDS.filter((b) => b.active).sort((a, b) => a.displayOrder - b.displayOrder);
}
function activeCategoriesSorted() {
  return CATEGORIES.filter((c) => c.active).sort((a, b) => a.displayOrder - b.displayOrder);
}
function activeSubcategoriesSorted(categoryId) {
  const cat = findCategory(categoryId);
  if (!cat) return [];
  return cat.subcategories.filter((s) => s.active).sort((a, b) => a.displayOrder - b.displayOrder);
}
