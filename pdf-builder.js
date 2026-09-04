/* ============================================================
   SHARED ORDER-PDF BUILDER
   ============================================================
   Used by app.js (building a NEW order's PDF from the live cart)
   and admin.html (regenerating an EXISTING order's PDF from what
   was saved in the database). Both paths assemble an `order`
   object first, then hand it to renderOrderPDF() below, so the
   PDF always looks identical regardless of where it came from.

   Expected `order` shape:
   {
     orderNo: string,
     customerName: string,
     customerPhone: string,
     items: [{ name, brand, qty, price (number|null), lineTotal (number|null) }],
     total: number,
     hasUnpriced: boolean,
     date: Date,
   }
   Depends on the global CONFIG (config.js) and, optionally,
   LOGO_BASE64 (logo-data.js) if it's loaded on the page.
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

// Formats a rupee amount for the PDF specifically. The default PDF font
// can't render the ₹ glyph correctly (it prints as a broken character),
// so PDFs use "Rs." instead — the website itself still shows ₹ everywhere.
function formatPriceForPDF(price) {
  if (price === null || price === undefined) return "—";
  const hasCents = Math.round(price * 100) % 100 !== 0;
  return "Rs. " + price.toLocaleString("en-IN", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
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

// Renders the order PDF in a compact, print-friendly A4 layout designed to
// fit at least 32 product rows on a single page. Returns { doc, filename }
// without saving the file. Does NOT touch the cart, Firestore, or generate
// an order number — the caller supplies all of that in `order`.
function renderOrderPDF(order) {
  const { orderNo, shopName, customerName, customerPhone, customerAddress, items, total, hasUnpriced, date } = order;

  if (!window.jspdf) {
    alert("The PDF tool didn't load. Please check your internet connection and try again.");
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = date || new Date();

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

  // ---- Compact customer/order info block (page 1 only) ----
  // Grows by a few mm if a Shop Name and/or Address are present, so both
  // fit without crowding the fixed Order Information column.
  function drawCustomerInfo(y) {
    const halfW = contentWidth / 2;
    const headRowH = 5.5;
    const lineStep = 4.2;

    let leftLines = [`Customer: ${customerName || "—"}`, `Contact: ${customerPhone || "—"}`];
    if (shopName) leftLines.unshift(`Shop Name: ${shopName}`);

    // Address wraps within the left column's width, up to 2 lines.
    let addressLines = [];
    if (customerAddress) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      addressLines = doc.splitTextToSize(`Address: ${customerAddress}`, halfW - 4).slice(0, 2);
    }

    const rightLines = [`Bill/Order No.: ${orderNo}`, `Date: ${now.toLocaleDateString("en-IN")}`, `Time: ${now.toLocaleTimeString("en-IN")}`];

    const bodyLineCount = Math.max(leftLines.length + addressLines.length, rightLines.length);
    const boxH = headRowH + bodyLineCount * lineStep + 2;

    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, boxH);
    doc.line(marginX + halfW, y, marginX + halfW, y + boxH);
    doc.line(marginX, y + headRowH, marginX + contentWidth, y + headRowH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Customer Information", marginX + 2, y + 3.9);
    doc.text("Order Information", marginX + halfW + 2, y + 3.9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    let ly = y + headRowH + lineStep;
    leftLines.forEach((line) => {
      doc.text(line, marginX + 2, ly);
      ly += lineStep;
    });
    addressLines.forEach((line) => {
      doc.text(line, marginX + 2, ly);
      ly += lineStep;
    });

    let ry = y + headRowH + lineStep;
    rightLines.forEach((line) => {
      doc.text(line, marginX + halfW + 2, ry);
      ry += lineStep;
    });

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
    doc.text(item.brand || "—", colX.brand + 1.5, midY);
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

  // ---- Totals ----
  const halfW = contentWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const totalText = `Estimated Total: ${formatPriceForPDF(total)}${hasUnpriced ? " + quote" : ""}`;
  doc.text(totalText, marginX + contentWidth, y, { align: "right" });
  y += 6;

  // ---- Amount in words ----
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

  // ---- Disclaimer ----
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  const note = doc.splitTextToSize(
    "This is a customer-generated order request, not a confirmed invoice. Prices and stock are subject to the shop's confirmation.",
    contentWidth
  );
  doc.text(note, marginX, y);
  y += note.length * 3.3 + 3;

  // ---- Signatures ----
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
  return { doc, filename };
}

/* ============================================================
   PAYMENT RECEIPT — generated/regenerated by the Admin panel once
   an order has been processed. Unlike renderOrderPDF() (the
   customer-generated "ORDER REQUEST" at checkout, which never
   changes), this always reflects the latest saved, admin-modified
   order data, and shows the full financial picture: Previous
   Balance + Current Order Total = Total, less Payment Received =
   Balance Remaining.

   Expected `order` shape:
   {
     orderNo, shopName, customerName, customerPhone, customerAddress,
     items: [{ name, qty, price (number|null), lineTotal (number|null) }],
     previousBalance, currentOrderTotal, total, paymentReceived,
     balanceRemaining, paymentStatus, date,
   }
   ============================================================ */
function renderPaymentReceiptPDF(order) {
  const {
    orderNo,
    shopName,
    customerName,
    customerPhone,
    customerAddress,
    items,
    previousBalance,
    currentOrderTotal,
    total,
    paymentReceived,
    balanceRemaining,
    paymentStatus,
    date,
  } = order;

  if (!window.jspdf) {
    alert("The PDF tool didn't load. Please check your internet connection and try again.");
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = date || new Date();

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const marginTop = 10;
  const marginBottom = 12;
  const contentWidth = pageWidth - marginX * 2;
  const footerReserve = 5;
  const maxItemY = pageHeight - marginBottom - footerReserve;

  // ---- Table columns: S.No / Product / Qty / Unit Price / Amount ----
  const colW = {
    sno: contentWidth * 0.08,
    desc: contentWidth * 0.46,
    qty: contentWidth * 0.1,
    price: contentWidth * 0.18,
    amount: contentWidth * 0.18,
  };
  const colX = {};
  let cx = marginX;
  ["sno", "desc", "qty", "price", "amount"].forEach((key) => {
    colX[key] = cx;
    cx += colW[key];
  });
  const colBoundaries = [marginX, colX.desc, colX.qty, colX.price, colX.amount, marginX + contentWidth];

  const rowHeight = 6.5;
  const headerRowHeight = 7.5;

  function drawPageHeader(isFirstPage) {
    let y = marginTop;
    if (isFirstPage) {
      const logoSize = 16;
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
      doc.setFontSize(14);
      doc.text("PAYMENT RECEIPT", pageWidth - marginX, y + 6, { align: "right" });

      y += 17;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(CONFIG.shopName, marginX, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Receipt No: ${orderNo} (contd.)`, pageWidth - marginX, y + 3, { align: "right" });
      y += 6;
    }
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    return y + 4;
  }

  function drawCustomerInfo(y) {
    const halfW = contentWidth / 2;
    const headRowH = 5.5;
    const lineStep = 4.2;

    let leftLines = [`Customer: ${customerName || "—"}`, `Contact: ${customerPhone || "—"}`];
    if (shopName) leftLines.unshift(`Shop Name: ${shopName}`);

    let addressLines = [];
    if (customerAddress) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      addressLines = doc.splitTextToSize(`Address: ${customerAddress}`, halfW - 4).slice(0, 2);
    }

    const rightLines = [`Receipt/Order ID: ${orderNo}`, `Order Date: ${now.toLocaleDateString("en-IN")}`];

    const bodyLineCount = Math.max(leftLines.length + addressLines.length, rightLines.length);
    const boxH = headRowH + bodyLineCount * lineStep + 2;

    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, boxH);
    doc.line(marginX + halfW, y, marginX + halfW, y + boxH);
    doc.line(marginX, y + headRowH, marginX + contentWidth, y + headRowH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Customer / Shop Information", marginX + 2, y + 3.9);
    doc.text("Order Information", marginX + halfW + 2, y + 3.9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    let ly = y + headRowH + lineStep;
    leftLines.forEach((line) => {
      doc.text(line, marginX + 2, ly);
      ly += lineStep;
    });
    addressLines.forEach((line) => {
      doc.text(line, marginX + 2, ly);
      ly += lineStep;
    });

    let ry = y + headRowH + lineStep;
    rightLines.forEach((line) => {
      doc.text(line, marginX + halfW + 2, ry);
      ry += lineStep;
    });

    return y + boxH + 4;
  }

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
    doc.text("Product", colX.desc + 1.5, textY);
    doc.text("Qty", colX.qty + colW.qty / 2, textY, { align: "center" });
    doc.text("Unit Price", colX.price + colW.price - 1.5, textY, { align: "right" });
    doc.text("Amount", colX.amount + colW.amount - 1.5, textY, { align: "right" });
    return y + headerRowHeight;
  }

  function fitDescription(text, maxWidth) {
    let fontSize = 8.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(text, maxWidth);
    if (lines.length <= 1) return { lines, fontSize };
    fontSize = 7.5;
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
    doc.setFontSize(8.5);
    doc.text(String(sno), colX.sno + colW.sno - 1.5, midY, { align: "right" });

    doc.setFontSize(descFontSize);
    if (descLines.length > 1) {
      const blockH = descLines.length * lineStepMm;
      let startY = y + rowH / 2 - blockH / 2 + lineStepMm * 0.75;
      descLines.forEach((line, i) => doc.text(line, colX.desc + 1.5, startY + i * lineStepMm));
    } else {
      doc.text(descLines[0], colX.desc + 1.5, midY);
    }

    doc.setFontSize(8.5);
    doc.text(String(item.qty), colX.qty + colW.qty / 2, midY, { align: "center" });
    doc.text(item.price === null ? "—" : formatPriceForPDF(item.price), colX.price + colW.price - 1.5, midY, { align: "right" });
    doc.text(item.lineTotal === null ? "Quote" : formatPriceForPDF(item.lineTotal), colX.amount + colW.amount - 1.5, midY, {
      align: "right",
    });

    return rowH;
  }

  // ---- Page 1 layout ----
  let y = drawPageHeader(true);
  y = drawCustomerInfo(y);
  y = drawTableHeader(y);

  items.forEach((item, idx) => {
    if (y + rowHeight > maxItemY) {
      doc.addPage();
      y = drawPageHeader(false);
      y = drawTableHeader(y);
    }
    y += drawItemRow(y, item, idx + 1);
  });

  // ---- Financial summary block: Previous Balance, Current Order Total,
  // Total, Payment Received, Balance Remaining, Payment Status ----
  const summaryRows = [
    ["Previous Balance", formatPriceForPDF(previousBalance)],
    ["Current Order Total", formatPriceForPDF(currentOrderTotal)],
    ["Total", formatPriceForPDF(total)],
    ["Payment Received", formatPriceForPDF(paymentReceived)],
    ["Balance Remaining", formatPriceForPDF(Math.abs(balanceRemaining)) + (balanceRemaining < 0 ? " (Advance)" : "")],
  ];
  const summaryRowH = 6;
  const summaryBoxH = summaryRows.length * summaryRowH + 3;
  const wordsBlockHeight = total > 0 ? 9 : 0;
  const statusBlockHeight = 6;
  const disclaimerHeight = 7;
  const signatureHeight = 10;
  const bottomBlockHeight = summaryBoxH + wordsBlockHeight + statusBlockHeight + disclaimerHeight + signatureHeight;

  if (y + bottomBlockHeight > maxItemY) {
    doc.addPage();
    y = drawPageHeader(false);
    y += 4;
  } else {
    y += 4;
  }

  // Summary box: label left, amount right, "Total" row bolded/boxed to stand out.
  const summaryW = contentWidth * 0.55;
  const summaryX = marginX + contentWidth - summaryW;
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.rect(summaryX, y, summaryW, summaryBoxH);
  let sy = y + summaryRowH - 1.5;
  summaryRows.forEach(([label, value], i) => {
    if (label === "Total") {
      doc.setFillColor(245, 245, 240);
      doc.rect(summaryX, y + i * summaryRowH, summaryW, summaryRowH, "F");
      doc.setDrawColor(180);
      doc.rect(summaryX, y + i * summaryRowH, summaryW, summaryRowH);
    }
    doc.setFont("helvetica", label === "Total" ? "bold" : "normal");
    doc.setFontSize(label === "Total" ? 10 : 9);
    doc.text(label, summaryX + 3, sy);
    doc.text(value, summaryX + summaryW - 3, sy, { align: "right" });
    sy += summaryRowH;
  });
  y += summaryBoxH + 4;

  // Payment status badge-style line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Payment Status: ${paymentStatusLabel(paymentStatus)}`, marginX, y);
  y += 6;

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

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  const note = doc.splitTextToSize(
    "This is a formal payment receipt reflecting the latest saved order data. Please retain this document for your records.",
    contentWidth
  );
  doc.text(note, marginX, y);
  y += note.length * 3.3 + 3;

  const halfW = contentWidth / 2;
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

  const filename = "Receipt_" + buildOrderFilename(customerName, orderNo, now);
  return { doc, filename };
}
