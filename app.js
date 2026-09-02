/* ============================================================
   SITE CONFIG — edit these two lines when things change
   ============================================================ */
const CONFIG = {
  // Shop's WhatsApp number, country code first, digits only.
  // Example for India: 91 followed by the 10-digit number.
  whatsappNumber: "918210063770",
  shopName: "Baba Electronics & Electricals",
  shopAddress: "Panna Market, Siwan, Bihar – 841226",
};

/* ============================================================
   STATE
   ============================================================ */
let activeCategory = "all";
let searchQuery = "";
let cart = loadCart(); // { productId: quantity }
let pendingQty = {}; // { productId: quantity chosen on the card, before "Add to cart" }
let PRODUCTS = []; // populated by loadProductCatalog() before first render

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

// PDF-only price formatter. jsPDF's built-in "helvetica" font only supports
// the standard WinAnsi character set, which does not include the ₹ (Rupee)
// glyph — using formatPrice()'s ₹ inside the PDF renders as a stray garbled
// character instead of the symbol. "Rs." is plain ASCII and always renders
// correctly without needing to embed a custom Unicode font.
function formatPriceForPDF(price) {
  if (price === null || price === undefined) return "Contact for price";
  return "Rs. " + price.toLocaleString("en-IN");
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
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
      <div class="product-image" aria-hidden="true">
        ${
          p.image
            ? `<img src="${p.image}" alt="${p.name}" class="product-photo" />`
            : `<span class="product-initial">${p.name.charAt(0)}</span>`
        }
        ${p.tag ? `<span class="product-badge">${p.tag}</span>` : ""}
      </div>
      <div class="product-body">
        <p class="product-brand">${p.brand}</p>
        <h3 class="product-name">${p.name}</h3>
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
   CART
   ============================================================ */
function addToCart(id, qty = 1) {
  cart[id] = (cart[id] || 0) + qty;
  saveCart();
  renderCartBadge();
  renderCartPanel();
  flashCartIcon();
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
// Turns a rupee amount into words, Indian numbering (lakh/crore), e.g.
// 37149 -> "Thirty Seven Thousand One Hundred and Forty Nine Rupees only"
function amountInWords(amount) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function threeDigits(n) {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + twoDigits(n % 100) : "");
  }

  let n = Math.round(amount);
  if (n === 0) return "Zero Rupees only";

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  let parts = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(threeDigits(lakh) + " Lakh");
  if (thousand) parts.push(threeDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(" ") + " Rupees only";
}

// Gets the next order number from a shared counter in Firestore, so numbers
// are short and sequential like a real receipt book (e.g. 3756, 3757 ...).
// Falls back to a timestamp-based number if Firebase isn't set up yet.
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
function sanitizeFilenamePart(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "");
}

// Builds "CustomerName_BillNo_DD-MM-YYYY.pdf", e.g.
// "Hareram_Tiwari_3005_01-09-2026.pdf".
function buildOrderFilename(customerName, orderNo, date) {
  const namePart = sanitizeFilenamePart(customerName) || "Customer";
  const billPart = sanitizeFilenamePart(orderNo) || "Order";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${namePart}_${billPart}_${dd}-${mm}-${yyyy}.pdf`;
}

// Builds the order PDF in a compact, print-friendly A4 layout designed to
// fit at least 32 product rows on a single page. Returns
// { doc, orderNo, total, hasUnpriced, filename } without saving the file.
async function buildOrderPDF(customerName, customerPhone) {
  const ids = Object.keys(cart);
  if (ids.length === 0) return null;
  if (!window.jspdf) {
    alert("The PDF tool didn't load. Please check your internet connection and try again.");
    return null;
  }

  const orderNo = await generateOrderNumber();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();

  // ---- Page geometry ----
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const marginTop = 10;
  const marginBottom = 12;
  const contentWidth = pageWidth - marginX * 2; // 186mm
  const footerReserve = 5; // space kept clear above marginBottom for the footer
  const maxItemY = pageHeight - marginBottom - footerReserve;

  // ---- Table column geometry (S.No 7% / Desc 42% / Brand 15% / Qty 7% / Price 14% / Subtotal 15%) ----
  const colW = {
    sno: contentWidth * 0.07,
    desc: contentWidth * 0.42,
    brand: contentWidth * 0.15,
    qty: contentWidth * 0.07,
    price: contentWidth * 0.14,
    subtotal: contentWidth * 0.15,
  };
  const colX = {};
  let cx = marginX;
  ["sno", "desc", "brand", "qty", "price", "subtotal"].forEach((key) => {
    colX[key] = cx;
    cx += colW[key];
  });
  const colBoundaries = [
    marginX,
    colX.desc,
    colX.brand,
    colX.qty,
    colX.price,
    colX.subtotal,
    marginX + contentWidth,
  ];

  const rowHeight = 6; // mm, target compact row height (spec range: 6-7mm)
  const headerRowHeight = 7.5;

  // ---- Compute totals up front ----
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

  // ---- Compact page header (shop block + title) ----
  // Full version on page 1 (~21mm incl. divider); a slimmer version repeats
  // on continuation pages so item rows keep most of the vertical space.
  function drawPageHeader(isFirstPage) {
    let y = marginTop;
    if (isFirstPage) {
      const logoSize = 16; // mm, compact square — fits inside the ~17mm header block
      let textX = marginX;
      if (typeof LOGO_BASE64 !== "undefined" && LOGO_BASE64) {
        try {
          doc.addImage(LOGO_BASE64, "PNG", marginX, y, logoSize, logoSize);
          textX = marginX + logoSize + 4;
        } catch (err) {
          console.error("Could not add logo to PDF:", err);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(CONFIG.shopName, textX, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(CONFIG.shopAddress, textX, y + 8.5);
      doc.text(`Phone: +${CONFIG.whatsappNumber.slice(0, 2)} ${CONFIG.whatsappNumber.slice(2)}`, textX, y + 12.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("ORDER REQUEST", pageWidth - marginX, y + 6, { align: "right" });

      y += 17;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(CONFIG.shopName, marginX, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Order No: ${orderNo} (contd.)`, pageWidth - marginX, y + 3, { align: "right" });
      y += 6;
    }
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    return y + 4;
  }

  // ---- Compact customer/order info block (page 1 only, ~19mm) ----
  function drawCustomerInfo(y) {
    const boxH = 19;
    const halfW = contentWidth / 2;
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, boxH);
    doc.line(marginX + halfW, y, marginX + halfW, y + boxH);
    const headRowH = 5.5;
    doc.line(marginX, y + headRowH, marginX + contentWidth, y + headRowH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Customer Information", marginX + 2, y + 3.9);
    doc.text("Order Information", marginX + halfW + 2, y + 3.9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    let ly = y + headRowH + 4.2;
    doc.text(`Customer: ${customerName || "—"}`, marginX + 2, ly);
    doc.text(`Bill/Order No.: ${orderNo}`, marginX + halfW + 2, ly);
    ly += 4.2;
    doc.text(`Contact: ${customerPhone || "—"}`, marginX + 2, ly);
    doc.text(`Date: ${now.toLocaleDateString("en-IN")}`, marginX + halfW + 2, ly);
    ly += 4.2;
    doc.text(`Time: ${now.toLocaleTimeString("en-IN")}`, marginX + halfW + 2, ly);

    return y + boxH + 4;
  }

  // ---- Product table header row (repeated on every page) ----
  function drawTableHeader(y) {
    doc.setFillColor(235, 235, 235);
    doc.rect(marginX, y, contentWidth, headerRowHeight, "F");
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, headerRowHeight);
    colBoundaries.forEach((x) => doc.line(x, y, x, y + headerRowHeight));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const textY = y + headerRowHeight / 2 + 1.2;
    doc.text("S.No.", colX.sno + colW.sno - 1.5, textY, { align: "right" });
    doc.text("Product Description", colX.desc + 1.5, textY);
    doc.text("Brand", colX.brand + 1.5, textY);
    doc.text("Qty", colX.qty + colW.qty / 2, textY, { align: "center" });
    doc.text("Unit Price", colX.price + colW.price - 1.5, textY, { align: "right" });
    doc.text("Subtotal", colX.subtotal + colW.subtotal - 1.5, textY, { align: "right" });
    return y + headerRowHeight;
  }

  // ---- Fit a (possibly long) product name into the description column ----
  // Tries one line at the normal size, then a smaller size, then finally
  // allows up to 2 lines with an ellipsis rather than overflowing the row
  // or bleeding into the next column.
  function fitDescription(text, maxWidth) {
    let fontSize = 8.3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(text, maxWidth);
    if (lines.length <= 1) return { lines, fontSize };

    fontSize = 7.3;
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(text, maxWidth);
    if (lines.length <= 1) return { lines, fontSize };

    if (lines.length > 2) {
      lines = lines.slice(0, 2);
      let last = lines[1];
      while (last.length > 1 && doc.getTextWidth(last + "…") > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[1] = last + "…";
    }
    return { lines, fontSize };
  }

  // ---- Draw one compact item row; returns the row's actual height used ----
  function drawItemRow(y, item, sno) {
    const { lines: descLines, fontSize: descFontSize } = fitDescription(item.name, colW.desc - 3);
    const lineStepMm = descFontSize * 0.42;
    const rowH = descLines.length > 1 ? Math.max(rowHeight, descLines.length * lineStepMm + 2.5) : rowHeight;

    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    colBoundaries.forEach((x) => doc.line(x, y, x, y + rowH));
    doc.line(marginX, y + rowH, marginX + contentWidth, y + rowH);

    const midY = y + rowH / 2 + 1.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    doc.text(String(sno), colX.sno + colW.sno - 1.5, midY, { align: "right" });

    doc.setFontSize(descFontSize);
    if (descLines.length > 1) {
      const blockH = descLines.length * lineStepMm;
      let startY = y + rowH / 2 - blockH / 2 + lineStepMm * 0.75;
      descLines.forEach((line, i) => doc.text(line, colX.desc + 1.5, startY + i * lineStepMm));
    } else {
      doc.text(descLines[0], colX.desc + 1.5, midY);
    }

    doc.setFontSize(8.3);
    doc.text(item.brand, colX.brand + 1.5, midY);
    doc.text(String(item.qty), colX.qty + colW.qty / 2, midY, { align: "center" });
    doc.text(item.price === null ? "—" : formatPriceForPDF(item.price), colX.price + colW.price - 1.5, midY, { align: "right" });
    doc.text(item.lineTotal === null ? "Quote" : formatPriceForPDF(item.lineTotal), colX.subtotal + colW.subtotal - 1.5, midY, {
      align: "right",
    });

    return rowH;
  }

  // ---- Lay out page 1: header, customer info, table header, then rows ----
  let y = drawPageHeader(true);
  y = drawCustomerInfo(y);
  y = drawTableHeader(y);

  items.forEach((item, idx) => {
    const projectedHeight = rowHeight; // conservative estimate for the page-break check
    if (y + projectedHeight > maxItemY) {
      doc.addPage();
      y = drawPageHeader(false);
      y = drawTableHeader(y);
    }
    y += drawItemRow(y, item, idx + 1);
  });

  // ---- Reserve space for totals / words / disclaimer / signatures ----
  // Kept intentionally tight (~28mm) so that an order with exactly 32 short
  // item rows still has a realistic chance of finishing on page 1, per the
  // "single A4 page for 32 items" preference — while the ≥32-rows-per-page
  // requirement above is met unconditionally regardless of this block.
  const totalsBlockHeight = 5;
  const wordsBlockHeight = total > 0 ? 5 : 0;
  const disclaimerHeight = 7;
  const signatureHeight = 6;
  const bottomBlockHeight = totalsBlockHeight + wordsBlockHeight + disclaimerHeight + signatureHeight;

  if (y + bottomBlockHeight > maxItemY) {
    doc.addPage();
    y = drawPageHeader(false);
    y += 4;
  } else {
    y += 4;
  }

  // ---- Totals (single combined text block — label and amount together,
  // not split into two separately-aligned pieces) ----
  const halfW = contentWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const totalText = `Estimated Total: ${formatPriceForPDF(total)}${hasUnpriced ? " + quote" : ""}`;
  doc.text(totalText, marginX + contentWidth, y, { align: "right" });
  y += 6;

  // ---- Amount in words (compact, wraps only if genuinely needed) ----
  if (total > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Amount in Words:", marginX, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth("Amount in Words: ") + 1.5;
    const wordsLines = doc.splitTextToSize(amountInWords(total), contentWidth - labelWidth);
    doc.text(wordsLines[0], marginX + labelWidth, y);
    y += 4.2;
    if (wordsLines.length > 1) {
      doc.text(wordsLines.slice(1), marginX, y);
      y += (wordsLines.length - 1) * 4.2;
    }
    y += 1.8;
  }

  // ---- Disclaimer (small italic notice, no boxed area) ----
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  const note = doc.splitTextToSize(
    "This is a customer-generated order request, not a confirmed invoice. Prices and stock are subject to the shop's confirmation.",
    contentWidth
  );
  doc.text(note, marginX, y);
  y += note.length * 3.3 + 3;

  // ---- Signatures (compact two-column, minimal signing gap) ----
  const rightColX = marginX + halfW;
  y += 4;
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + 60, y);
  doc.line(rightColX, y, rightColX + 60, y);
  y += 3.3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Authorized Signatory", marginX, y);
  doc.text("Customer Signature", rightColX, y);

  // ---- Footer with page numbers on every page ----
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    doc.line(marginX, pageHeight - marginBottom - 3, marginX + contentWidth, pageHeight - marginBottom - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${CONFIG.shopName} | ${CONFIG.shopAddress}`, marginX, pageHeight - marginBottom);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - marginBottom, { align: "right" });
  }

  const filename = buildOrderFilename(customerName, orderNo, now);
  return { doc, orderNo, total, hasUnpriced, filename };
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

  // Product grid clicks (event delegation: qty stepper + add to cart)
  document.getElementById("product-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
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
