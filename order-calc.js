/* ============================================================
   ORDER CALCULATION — single source of truth
   ============================================================
   Shared by app.js (new orders at checkout), admin.html (editing
   an existing order), pdf-builder.js (order PDF / payment receipt),
   and orders.html (customer order lookup). Loaded before all of
   those files.

   Nothing here talks to Firestore — it's pure calculation plus a
   few "read this field off an order, with a safe default for older
   records that don't have it yet" helpers, so every screen treats
   missing/legacy data the same way.
   ============================================================ */

const ORDER_STATUSES = ["pending", "confirmed", "fulfilled", "cancelled"];
const ORDER_STATUS_LABELS = {
  pending: "Order Placed",
  confirmed: "Processing",
  fulfilled: "Completed",
  cancelled: "Cancelled",
};
function orderStatusLabel(s) {
  return ORDER_STATUS_LABELS[s] || s;
}

// Payment status is never set directly by anyone — it's always derived from
// Payment Received vs Total (see computeOrderFinancials below), so an order
// can't get into an inconsistent "fully paid, ₹0 received" state.
const PAYMENT_STATUSES = ["pending", "partial", "paid"];
const PAYMENT_STATUS_LABELS = {
  pending: "Payment Pending",
  partial: "Partially Paid",
  paid: "Fully Paid",
};
function paymentStatusLabel(s) {
  return PAYMENT_STATUS_LABELS[s] || s;
}

/* ---- Safe field readers (defaults for orders saved before this feature) --- */
function getShopNameOf(order) {
  return (order && order.shopName) || "";
}
function getCustomerAddressOf(order) {
  return (order && order.customerAddress) || "";
}
function getPreviousBalanceOf(order) {
  return order && typeof order.previousBalance === "number" ? order.previousBalance : 0;
}
function getPaymentReceivedOf(order) {
  return order && typeof order.paymentReceived === "number" ? order.paymentReceived : 0;
}
function getDiscountOf(order) {
  return order && typeof order.discount === "number" ? order.discount : 0;
}
// Older orders don't have currentOrderTotal/total/balanceRemaining/paymentStatus
// saved at all — for those, `total` (the old field name) IS the current order
// total, previous balance is 0, and nothing has been paid yet.
function getCurrentOrderTotalOf(order) {
  if (order && typeof order.currentOrderTotal === "number") return order.currentOrderTotal;
  return (order && order.total) || 0;
}
function getOrderTotalOf(order) {
  if (order && typeof order.total === "number" && typeof order.previousBalance === "number") return order.total;
  // Legacy shape: `total` already equalled the current-order total with no previous balance concept.
  return (order && order.total) || 0;
}
function getBalanceRemainingOf(order) {
  if (order && typeof order.balanceRemaining === "number") return order.balanceRemaining;
  return getOrderTotalOf(order) - getPaymentReceivedOf(order);
}
function getPaymentStatusOf(order) {
  return (order && order.paymentStatus) || "pending";
}

/* ---- Money helpers (paise-safe, avoid float drift) ---- */
function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Sums an items array's line totals (unpriced items are skipped from the
// numeric total and flagged via hasUnpriced, same convention used
// throughout the site).
function computeItemsTotal(items) {
  let totalPaise = 0;
  let hasUnpriced = false;
  (items || []).forEach((it) => {
    if (it.price === null || it.price === undefined) {
      hasUnpriced = true;
      return;
    }
    const qty = Number(it.qty) || 0;
    totalPaise += Math.round(it.price * 100) * qty;
  });
  return { total: totalPaise / 100, hasUnpriced };
}

// THE single calculation model for the whole app:
//   Current Order Total = sum(item line totals) − discount   (floored at 0)
//   Total                = Previous Balance + Current Order Total
//   Balance Remaining    = Total − Payment Received
//   Payment Status       = derived from Payment Received vs Total
//
// Called every time items/previousBalance/paymentReceived/discount change —
// on the shop page when a new order is placed, and in the admin panel every
// time an admin edits an order — so Current Order Total / Total / Balance
// Remaining / Payment Status are always recalculated together and never
// hand-typed into more than one place.
function computeOrderFinancials({ items, previousBalance, paymentReceived, discount }) {
  const { total: itemsTotal, hasUnpriced } = computeItemsTotal(items);
  const disc = Math.max(0, discount || 0);
  const currentOrderTotal = Math.max(0, roundMoney(itemsTotal - disc));
  const prevBal = previousBalance || 0;
  const total = roundMoney(prevBal + currentOrderTotal);
  const received = Math.max(0, paymentReceived || 0);
  const balanceRemaining = roundMoney(total - received);

  let paymentStatus;
  if (received <= 0) paymentStatus = "pending";
  else if (received < total) paymentStatus = "partial";
  else paymentStatus = "paid"; // received === total, or overpaid

  return { currentOrderTotal, hasUnpriced, total, balanceRemaining, paymentStatus };
}

// Builds the audit-log entries for a save: one entry per field that actually
// changed, each recording who changed it, the field, old/new value, and a
// timestamp. Order Time is intentionally never one of these fields — it's
// never editable, so it's never part of a diff.
function buildAuditEntries(before, after, fieldLabels, editedBy) {
  const entries = [];
  const now = new Date().toISOString();
  Object.keys(fieldLabels).forEach((key) => {
    const oldVal = before[key];
    const newVal = after[key];
    const changed =
      typeof oldVal === "object" || typeof newVal === "object"
        ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
        : oldVal !== newVal;
    if (changed) {
      entries.push({
        field: fieldLabels[key],
        oldValue: oldVal === undefined || oldVal === null ? "" : String(oldVal),
        newValue: newVal === undefined || newVal === null ? "" : String(newVal),
        editedBy: editedBy || "admin",
        timestamp: now,
      });
    }
  });
  return entries;
}
