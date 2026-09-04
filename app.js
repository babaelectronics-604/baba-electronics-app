/* CONFIG now lives in config.js (shared with admin.html) — loaded via a
   <script src="config.js"> tag before this file. */

/* ============================================================
   STATE
   ============================================================ */
let activeCategory = "all";
let searchQuery = "";
let cart = loadCart(); // { productId: quantity }
let pendingQty = {}; // { productId: quantity chosen on the card, before "Add to cart" }
let PRODUCTS = []; // populated by loadProductCatalog() before first render
let currentDetailProductId = null; // product currently shown in the detail modal, if any

/* ============================================================
   PRODUCT CATALOG — loaded from the database if it's set up,
   otherwise falls back to the starter list in products.js so
   the shop page still works before Firebase is connected.
   ============================================================ */
async function loadProductCatalog() {
  if (isFirebaseReady()) {
    try {
      const snap = await db.collection("products").orderBy("name").get();
      if (!snap.empty) {
        PRODUCTS = snap.docs.map((d) => d.data());
        return;
      }
    } catch (err) {
      console.error("Could not load products from the database, using the starter catalog instead:", err);
    }
  }
  PRODUCTS = STARTER_PRODUCTS;
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatPrice(price) {
  if (price === null || price === undefined) return "Contact for price";
  return "₹" + price.toLocaleString("en-IN");
}

// formatPriceForPDF() now lives in pdf-builder.js (shared with admin.html).

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function categoryLabelFor(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.label : id;
}

function loadCart() {
  try {
    const raw = localStorage.getItem("baba_cart");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem("baba_cart", JSON.stringify(cart));
  } catch (e) {
    /* ignore storage errors */
  }
}

function waLink(message) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/* ============================================================
   RENDER: PRODUCT GRID
   ============================================================ */
function getVisibleProducts() {
  return PRODUCTS.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("empty-state");
  const list = getVisibleProducts();

  grid.innerHTML = "";

  if (list.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.forEach((p) => {
    const qty = pendingQty[p.id] || 1;
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image" data-action="view" data-id="${p.id}" aria-hidden="true">
        ${
          p.image
            ? `<img src="${p.image}" alt="${p.name}" class="product-photo" />`
            : `<span class="product-initial">${p.name.charAt(0)}</span>`
        }
        ${p.tag ? `<span class="product-badge">${p.tag}</span>` : ""}
      </div>
      <div class="product-body">
        <div class="product-clickable" data-action="view" data-id="${p.id}">
          <p class="product-brand">${p.brand}</p>
          <h3 class="product-name">${p.name}</h3>
        </div>
        <p class="product-unit">per ${p.unit}</p>
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)}</span>
          <div class="qty-stepper">
            <button data-action="qty-dec" data-id="${p.id}" aria-label="Fewer">−</button>
            <span class="qty-value">${qty}</span>
            <button data-action="qty-inc" data-id="${p.id}" aria-label="More">+</button>
          </div>
        </div>
        <button class="btn-order btn-order-full" data-action="add" data-id="${p.id}">Add ${qty} to cart</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   RENDER: CATEGORY GRID (counts update live with search)
   ============================================================ */
function renderCategories() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";

  CATEGORIES.forEach((cat) => {
    const count = PRODUCTS.filter((p) => p.category === cat.id).length;
    const card = document.createElement("button");
    card.className = "category-card" + (activeCategory === cat.id ? " is-active" : "");
    card.dataset.category = cat.id;
    card.innerHTML = `
      <span class="category-name">${cat.label}</span>
      <span class="category-count">${count} items</span>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   PRODUCT DETAIL MODAL
   ============================================================ */
function openProductDetail(id) {
  const p = findProduct(id);
  if (!p) return;
  currentDetailProductId = id;
  renderProductDetail(p);

  const panel = document.getElementById("detail-panel");
  const overlay = document.getElementById("detail-overlay");
  panel.hidden = false;
  overlay.hidden = false;
  // Force reflow so the "is-open"/"is-visible" transition actually plays.
  void panel.offsetWidth;
  panel.classList.add("is-open");
  overlay.classList.add("is-visible");
  document.body.classList.add("modal-open");
}

function closeProductDetail() {
  const panel = document.getElementById("detail-panel");
  const overlay = document.getElementById("detail-overlay");
  panel.classList.remove("is-open");
  overlay.classList.remove("is-visible");
  document.body.classList.remove("modal-open");
  setTimeout(() => {
    panel.hidden = true;
    overlay.hidden = true;
  }, 200);
  currentDetailProductId = null;
}

function renderProductDetail(p) {
  const body = document.getElementById("detail-body");
  const qty = pendingQty[p.id] || 1;

  const images = p.images && p.images.length ? p.images : p.image ? [p.image] : [];
  const galleryHtml = images.length
    ? `<div class="detail-gallery">
         <div class="detail-main-image"><img src="${images[0]}" alt="${p.name}" id="detail-main-img" /></div>
         ${
           images.length > 1
             ? `<div class="detail-thumbs">${images
                 .map(
                   (img, i) =>
                     `<button class="detail-thumb${i === 0 ? " is-active" : ""}" data-img="${img}"><img src="${img}" alt="" /></button>`
                 )
                 .join("")}</div>`
             : ""
         }
       </div>`
    : `<div class="detail-main-image detail-placeholder"><span>${p.name.charAt(0)}</span></div>`;

  const showMrp = p.mrp && p.price !== null && p.mrp > p.price;
  const priceRow = `
    <div class="detail-price-row">
      <span class="detail-price">${formatPrice(p.price)}</span>
      ${showMrp ? `<span class="detail-mrp">₹${Number(p.mrp).toLocaleString("en-IN")}</span>` : ""}
    </div>`;

  const metaRows = [];
  if (p.sku) metaRows.push(`<div class="detail-meta-row"><span>SKU / Code</span><span>${p.sku}</span></div>`);
  metaRows.push(`<div class="detail-meta-row"><span>Brand</span><span>${p.brand}</span></div>`);
  metaRows.push(`<div class="detail-meta-row"><span>Category</span><span>${categoryLabelFor(p.category)}</span></div>`);
  metaRows.push(`<div class="detail-meta-row"><span>Unit</span><span>${p.unit}</span></div>`);
  if (p.stock !== undefined && p.stock !== null && p.stock !== "") {
    metaRows.push(`<div class="detail-meta-row"><span>In stock</span><span>${p.stock}</span></div>`);
  }

  body.innerHTML = `
    ${galleryHtml}
    <div class="detail-info">
      <p class="detail-brand">${p.brand}${p.tag ? ` · ${p.tag}` : ""}</p>
      <h2 class="detail-name">${p.name}</h2>
      ${priceRow}
      ${p.description ? `<p class="detail-description">${p.description}</p>` : ""}
      <div class="detail-meta">${metaRows.join("")}</div>
      <div class="detail-actions">
        <div class="qty-stepper">
          <button data-action="detail-qty-dec" aria-label="Fewer">−</button>
          <span class="qty-value">${qty}</span>
          <button data-action="detail-qty-inc" aria-label="More">+</button>
        </div>
        <button class="btn-order btn-order-full" data-action="detail-add" data-id="${p.id}">Add ${qty} to cart</button>
      </div>
    </div>
  `;
}

/* ============================================================
   TOAST — brief, non-blocking confirmation (~1s), never stacks
   ============================================================ */
let toastHideTimer = null;
let toastRemoveTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  clearTimeout(toastHideTimer);
  clearTimeout(toastRemoveTimer);
  toast.textContent = message;
  toast.hidden = false;
  // Restart the animation even if a toast is already showing (re-triggering
  // instead of stacking a second one).
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  toastHideTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    toastRemoveTimer = setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 1000);
}

/* ============================================================
   CART
   ============================================================ */
function addToCart(id, qty = 1) {
  cart[id] = (cart[id] || 0) + qty;
  saveCart();
  renderCartBadge();
  renderCartPanel();
  flashCartIcon();
  showToast("✓ Product added to cart");
}

function removeFromCart(id) {
  delete cart[id];
  saveCart();
  renderCartBadge();
  renderCartPanel();
}

function setQty(id, qty) {
  if (qty <= 0) {
    removeFromCart(id);
    return;
  }
  cart[id] = qty;
  saveCart();
  renderCartBadge();
  renderCartPanel();
}

function cartCount() {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

function cartTotal() {
  let total = 0;
  let hasUnpriced = false;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = findProduct(id);
    if (!p) return;
    if (p.price === null) {
      hasUnpriced = true;
    } else {
      total += p.price * qty;
    }
  });
  return { total, hasUnpriced };
}

function renderCartBadge() {
  const badge = document.getElementById("cart-count");
  const count = cartCount();
  badge.textContent = count;
  badge.hidden = count === 0;
}

function renderCartPanel() {
  const body = document.getElementById("cart-body");
  const footer = document.getElementById("cart-footer");
  const ids = Object.keys(cart);

  if (ids.length === 0) {
    body.innerHTML = `<p class="cart-empty">Your cart is empty. Browse products, pick a quantity, and tap “Add to cart”.</p>`;
    footer.hidden = true;
    return;
  }

  body.innerHTML = "";
  ids.forEach((id) => {
    const p = findProduct(id);
    if (!p) return;
    const qty = cart[id];
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="cart-row-info">
        <p class="cart-row-name">${p.name}</p>
        <p class="cart-row-price">${formatPrice(p.price)} · per ${p.unit}</p>
      </div>
      <div class="cart-row-qty">
        <button data-action="dec" data-id="${id}" aria-label="Decrease quantity">−</button>
        <span>${qty}</span>
        <button data-action="inc" data-id="${id}" aria-label="Increase quantity">+</button>
      </div>
      <button class="cart-row-remove" data-action="remove" data-id="${id}" aria-label="Remove ${p.name}">✕</button>
    `;
    body.appendChild(row);
  });

  const { total, hasUnpriced } = cartTotal();
  document.getElementById("cart-total").textContent =
    hasUnpriced ? `${formatPrice(total)}+ (some items need a quote)` : formatPrice(total);
  footer.hidden = false;
}

function flashCartIcon() {
  const btn = document.getElementById("cart-toggle");
  btn.classList.remove("flash");
  void btn.offsetWidth; // restart animation
  btn.classList.add("flash");
}

/* ============================================================
   ORDER — PDF shared straight to WhatsApp, with a manual fallback
   ============================================================ */
// amountInWords, formatPriceForPDF, sanitizeFilenamePart, buildOrderFilename,
// and the PDF rendering itself now live in pdf-builder.js (shared with
// admin.html, so a regenerated order PDF looks identical to the original).

async function generateOrderNumber() {
  if (!isFirebaseReady()) {
    const now = new Date();
    return `TEMP${now.getTime()}`;
  }
  const counterRef = db.collection("meta").doc("orderCounter");
  try {
    const nextNumber = await db.runTransaction(async (t) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? snap.data().value : 3006;
      const next = current + 1;
      t.set(counterRef, { value: next }, { merge: true });
      return next;
    });
    return String(nextNumber);
  } catch (err) {
    console.error("Could not generate a sequential order number, using a fallback:", err);
    const now = new Date();
    return `TEMP${now.getTime()}`;
  }
}

function getCustomerName() {
  const input = document.getElementById("customer-name");
  return input ? input.value.trim() : "";
}

function getCustomerPhone() {
  const input = document.getElementById("customer-phone");
  return input ? input.value.trim() : "";
}

// Saves the order to Firestore for order history + the admin panel.
// Silently skips if Firebase hasn't been configured yet (see firebase-config.js).
async function saveOrderToFirestore(orderNo, customerName, customerPhone, total, hasUnpriced) {
  if (!isFirebaseReady()) return;
  try {
    const items = Object.keys(cart).map((id) => {
      const p = findProduct(id);
      return {
        id,
        name: p ? p.name : id,
        brand: p ? p.brand : "",
        unit: p ? p.unit : "",
        price: p ? p.price : null,
        qty: cart[id],
      };
    });
    await db
      .collection("orders")
      .doc(orderNo)
      .set({
        orderNo,
        customerName: customerName || "",
        customerPhone: customerPhone || "",
        items,
        total,
        hasUnpriced,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error("Could not save order to Firestore:", err);
    // Don't block the customer's checkout just because the save failed.
  }
}

// Turns a name/order-no into a safe filename fragment: trims, swaps
// whitespace for underscores, and strips characters that aren't safe
// in filenames across OSes.

// Assembles a new order from the live cart (items, totals, a fresh
// sequential order number) and hands it to the shared PDF renderer.
// Returns { doc, orderNo, total, hasUnpriced, filename }.
async function buildOrderPDF(customerName, customerPhone) {
  const ids = Object.keys(cart);
  if (ids.length === 0) return null;
  if (!window.jspdf) {
    alert("The PDF tool didn't load. Please check your internet connection and try again.");
    return null;
  }

  const orderNo = await generateOrderNumber();
  const now = new Date();

  let total = 0;
  let hasUnpriced = false;
  const items = ids
    .map((id) => {
      const p = findProduct(id);
      if (!p) return null;
      const qty = cart[id];
      const lineTotal = p.price === null ? null : p.price * qty;
      if (lineTotal === null) hasUnpriced = true;
      else total += lineTotal;
      return { name: p.name, brand: p.brand || "—", qty, price: p.price, lineTotal };
    })
    .filter(Boolean);

  const result = renderOrderPDF({
    orderNo,
    customerName,
    customerPhone,
    items,
    total,
    hasUnpriced,
    date: now,
  });
  if (!result) return null;

  return { doc: result.doc, orderNo, total, hasUnpriced, filename: result.filename };
}

// Primary checkout action: tries to hand the PDF straight to WhatsApp via the
// device's native share sheet (works on most phones). If the browser can't
// do that (mainly desktop), it downloads the PDF and opens WhatsApp with a
// message asking the customer to attach the file that just downloaded.
async function shareOrderPDF() {
  const name = getCustomerName();
  const phone = getCustomerPhone();
  if (!name || !phone) {
    alert("Please enter your name and phone number so we can confirm your order.");
    return;
  }

  const built = await buildOrderPDF(name, phone);
  if (!built) return;
  const { doc, orderNo, total, hasUnpriced, filename } = built;
  const blob = doc.output("blob");

  await saveOrderToFirestore(orderNo, name, phone, total, hasUnpriced);

  const shareText =
    `Hello ${CONFIG.shopName}, here is my order request (ref ${orderNo}). ` +
    `Estimated total: ${formatPrice(total)}${hasUnpriced ? " + items needing a quote" : ""}. ` +
    `${name}, ${phone}.`;

  let sharedFile = false;
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Order ${orderNo}`,
        text: shareText,
      });
      sharedFile = true;
    }
  } catch (err) {
    // User cancelled the share sheet, or share failed — fall through to the download fallback below.
    if (err && err.name === "AbortError") {
      return; // they cancelled on purpose, don't force the fallback on them
    }
  }

  if (!sharedFile) {
    doc.save(filename);
    const fallbackMessage =
      `${shareText}\n\nI've just downloaded the order PDF (${filename}) — attaching it here now, ` +
      `or please confirm this order and I'll send the file separately.`;
    window.open(waLink(fallbackMessage), "_blank");
  }
}

async function downloadOrderPDF() {
  const name = getCustomerName();
  const phone = getCustomerPhone();
  if (!name || !phone) {
    alert("Please enter your name and phone number so we can confirm your order.");
    return;
  }
  const built = await buildOrderPDF(name, phone);
  if (!built) return;
  await saveOrderToFirestore(built.orderNo, name, phone, built.total, built.hasUnpriced);
  built.doc.save(built.filename);
}

function contactShop(topic) {
  const message = topic
    ? `Hello ${CONFIG.shopName}, I have a question about: ${topic}`
    : `Hello ${CONFIG.shopName}, I'd like some help.`;
  window.open(waLink(message), "_blank");
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await loadProductCatalog();
  renderCategories();
  renderProducts();
  renderCartBadge();
  renderCartPanel();

  // Search
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderProducts();
  });

  // Category grid clicks
  document.getElementById("category-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".category-card");
    if (!card) return;
    const cat = card.dataset.category;
    activeCategory = activeCategory === cat ? "all" : cat;
    renderCategories();
    renderProducts();
    document.getElementById("shop").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // "View all categories" clears filter
  document.getElementById("view-all-categories").addEventListener("click", () => {
    activeCategory = "all";
    searchQuery = "";
    searchInput.value = "";
    renderCategories();
    renderProducts();
  });

  // Product grid clicks (event delegation: qty stepper, add to cart, view detail)
  document.getElementById("product-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (btn) {
      const { action, id } = btn.dataset;
      if (action === "qty-inc") {
        pendingQty[id] = (pendingQty[id] || 1) + 1;
        renderProducts();
      }
      if (action === "qty-dec") {
        pendingQty[id] = Math.max(1, (pendingQty[id] || 1) - 1);
        renderProducts();
      }
      if (action === "add") {
        addToCart(id, pendingQty[id] || 1);
        pendingQty[id] = 1;
        renderProducts();
      }
      return;
    }
    const viewTarget = e.target.closest('[data-action="view"]');
    if (viewTarget) {
      openProductDetail(viewTarget.dataset.id);
    }
  });

  // Product detail modal: close, gallery thumbnails, its own qty stepper + add
  document.getElementById("detail-close").addEventListener("click", closeProductDetail);
  document.getElementById("detail-overlay").addEventListener("click", closeProductDetail);
  document.getElementById("detail-body").addEventListener("click", (e) => {
    const thumb = e.target.closest(".detail-thumb");
    if (thumb) {
      const mainImg = document.getElementById("detail-main-img");
      if (mainImg) mainImg.src = thumb.dataset.img;
      document.querySelectorAll(".detail-thumb").forEach((t) => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
      return;
    }
    const btn = e.target.closest("button[data-action]");
    if (!btn || !currentDetailProductId) return;
    const id = currentDetailProductId;
    if (btn.dataset.action === "detail-qty-inc") {
      pendingQty[id] = (pendingQty[id] || 1) + 1;
      renderProductDetail(findProduct(id));
    }
    if (btn.dataset.action === "detail-qty-dec") {
      pendingQty[id] = Math.max(1, (pendingQty[id] || 1) - 1);
      renderProductDetail(findProduct(id));
    }
    if (btn.dataset.action === "detail-add") {
      addToCart(id, pendingQty[id] || 1);
      pendingQty[id] = 1;
      closeProductDetail();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && currentDetailProductId) closeProductDetail();
  });

  // Cart panel open/close
  const cartPanel = document.getElementById("cart-panel");
  const overlay = document.getElementById("overlay-scrim");
  function openCart() {
    cartPanel.classList.add("is-open");
    overlay.classList.add("is-visible");
    overlay.hidden = false;
  }
  function closeCart() {
    cartPanel.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    setTimeout(() => (overlay.hidden = true), 200);
  }
  document.getElementById("cart-toggle").addEventListener("click", openCart);
  document.getElementById("cart-close").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);

  // Cart row qty / remove (event delegation)
  document.getElementById("cart-body").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "inc") setQty(id, (cart[id] || 0) + 1);
    if (action === "dec") setQty(id, (cart[id] || 0) - 1);
    if (action === "remove") removeFromCart(id);
  });

  // Checkout: share PDF straight to WhatsApp (primary), manual download (secondary)
  document.getElementById("checkout-pdf").addEventListener("click", shareOrderPDF);
  document.getElementById("checkout-whatsapp").addEventListener("click", downloadOrderPDF);

  // Header nav
  document.getElementById("nav-home").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("nav-categories").addEventListener("click", () => {
    document.getElementById("categories").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("nav-deals").addEventListener("click", () => {
    document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("nav-orders").addEventListener("click", () => {
    window.location.href = "orders.html";
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById("menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  menuToggle.addEventListener("click", () => {
    const isOpen = mobileNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Hero / footer CTA buttons that contact the shop directly
  document.querySelectorAll("[data-contact]").forEach((el) => {
    el.addEventListener("click", () => contactShop(el.dataset.contact || ""));
  });
});
