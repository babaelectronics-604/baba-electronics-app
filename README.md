# Baba Electronics & Electricals — Website

A working store website: live search, category filtering, a cart with
adjustable quantities, order-slip PDF generation shared straight to
WhatsApp, customer order history, and a password-protected admin panel.

## What's in here
- `index.html` — the shop page
- `orders.html` — customer-facing "My Orders" lookup (by phone number)
- `admin.html` — password-protected admin panel: manage orders **and products**,
  search products, and regenerate any order's PDF
- `style.css` — all the visual styling, shared by all pages
- `products.js` — **starter catalog only** (see below) — after setup, manage
  products from the admin panel instead
- `config.js` — shop name, address, and WhatsApp number — shared by the shop
  page, the admin panel, and PDF generation
- `app.js` — the shop page's logic (search, cart, checkout, WhatsApp)
- `pdf-builder.js` — the order-PDF and payment-receipt layouts, shared by
  the shop page (new orders) and the admin panel (regenerating a past
  order's PDF or generating its payment receipt), so all of them always
  produce identical-looking documents
- `order-calc.js` — the single shared calculation model for order totals,
  balances, and payment status, used by the shop page, "My Orders", the
  admin panel, and PDF generation, so a total is never computed two
  different ways in two different places
- `firebase-config.js` — your database connection details (see setup below)
- `logo.png` / `logo-data.js` — your shop logo, shown on every page and
  printed on the order PDF (`logo-data.js` is just `logo.png` re-encoded
  as text, so the PDF tool can embed it directly)

## One-time setup: connecting the database (Firebase)

Order history and the admin panel need somewhere to store orders. This
uses **Firebase**, a free Google service — no credit card needed at this
scale. You do this once; I can't do it for you since it needs your own
Google account.

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and click **Add project**. Name it anything (e.g. `baba-electronics`).
   You can skip Google Analytics if asked.

2. Once the project opens, click the **`</>`** (web) icon on the project
   overview page to register a web app. Give it any nickname and click
   **Register app**. Firebase will show you a code block that looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "baba-electronics.firebaseapp.com",
     projectId: "baba-electronics",
     storageBucket: "baba-electronics.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   Copy those values into `firebase-config.js` in this folder, replacing
   the `"YOUR_..."` placeholders. Save the file.

3. In the left sidebar, go to **Build → Firestore Database → Create
   database**. Choose **Start in production mode**, pick a location close
   to India, and click **Enable**.

4. Still in Firestore, click the **Rules** tab and replace the contents
   with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /orders/{orderId} {
         allow create: if true;
         allow read: if true;
         allow update, delete: if request.auth != null;
       }
       match /products/{productId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       match /payments/{paymentId} {
         allow read, write: if request.auth != null;
       }
       match /meta/{docId} {
         allow read, write: if true;
       }
     }
   }
   ```
   Click **Publish**. (Note: this lets anyone who knows how to query the
   database read order and product data — acceptable for a small local
   shop, but not bank-grade privacy. *Writing* products or orders, and
   *reading or writing payments at all*, always requires being logged in
   as admin — payment records are never exposed publicly. When you're
   ready for the WhatsApp Business API phase, that's the natural point to
   lock this down further with a proper backend.)

5. In the left sidebar, go to **Build → Authentication → Get started**,
   enable the **Email/Password** sign-in method, then go to the **Users**
   tab and **Add user** — this is your admin login (whatever email and
   password you choose; you'll use these to log into `admin.html`).

That's it — reload any page of the site and order history + the admin
panel will start working.

## Updating your WhatsApp number later
Open `app.js`, and near the top change this line:
```js
whatsappNumber: "918210063770",
```
Replace the digits with your new number — country code first, no `+`, no spaces, no leading `0`. Save the file.

## Managing products (add, edit, photos, prices)
Once the database is set up (steps above), go to `admin.html`, log in, and
click the **Products** tab:
- **+ Add product** — fill in name, brand, category, unit, price (leave
  price blank to show "Contact for price" instead), an optional badge like
  "Best seller", and an optional photo. Photos are automatically resized
  and compressed in your browser before saving, so there's no file-size
  limit to worry about.
- **Search box** — filters the product list live by name, brand, or
  category as you type, so finding one item in a large catalog to fix a
  price or swap a photo doesn't mean scrolling through everything.
- Click **Edit** on any product to change it, or **Delete** to remove it.
  Changes appear on the shop page immediately — no re-deployment needed.
- The first time you set this up, click **Import starter catalog** (shown
  automatically while the product list is empty) to bring in the sample
  items from `products.js` as a starting point, then edit them from here.
- `products.js` itself only matters as that one-time starter list, and as
  a fallback catalog shown if the database is ever unreachable. You don't
  need to hand-edit it once you're managing products from the admin panel.

## Your logo
`logo.png` shows in the header of every page and is printed at the top of
every order PDF. To change it later, just replace `logo.png` with a new
image of the same name (square images work best) and re-upload it to
GitHub — then also regenerate `logo-data.js` (ask, and this can be done
for you) since the PDF reads from that file, not `logo.png` directly.

## How ordering works
- Each product card has a **quantity stepper** (− / +) so the customer picks
  how many they want before adding it.
- **Add to cart** puts that quantity into the cart (shown top-right, with a
  running count). From the cart, quantities can still be adjusted or items
  removed.
- Before checkout, the customer enters their **name and phone number** —
  this is what appears on the PDF and lets them look their order up later.
- **Send order PDF to WhatsApp** builds a receipt-style order slip (shop
  header, "Ordered By" details, a sequential order number, an itemized
  table, the total in words, a signature line), saves the order to the
  database, then:
  - **On a phone**, opens the native "Share" sheet with the PDF already
    attached — the customer taps WhatsApp and it lands directly in a chat
    with your number.
  - **On desktop**, downloads the PDF and opens WhatsApp with a message
    ready, asking the customer to attach the file — no website can
    auto-attach a file into WhatsApp on desktop.
- **Just download the PDF** skips WhatsApp entirely.
- The cart is remembered in the visitor's browser, so it survives a page
  reload.
- Order numbers are sequential (e.g. `3756`, `3757`...) via a shared
  counter in the database, starting from 3000.

## Order history & admin panel
- **`orders.html`** ("My Orders" in the nav) — a customer enters the phone
  number they used at checkout and sees every order placed with that
  number: reference, date, items, total, and status.
- **`admin.html`** ("Admin" link in the footer) — log in with the email/
  password you created in Firebase Authentication (step 5 above) to see
  every order from every customer, change an order's status (Pending →
  Confirmed → Fulfilled, or Cancelled), delete an order, or click **PDF**
  on any order to regenerate and download its order slip — useful if a
  customer lost their copy, since it's rebuilt from the same saved data
  and looks identical to the one they originally got.

## Product details view
Clicking a product's photo or name (on the shop page) opens a detail view
with a larger image (with a thumbnail gallery if you've uploaded more than
one photo for that product in the admin panel), full description, SKU,
price and MRP, stock, unit, and its own quantity selector and "Add to
cart" button. Works as a centered dialog on desktop and a full-screen
sheet on mobile.

Every time something is added to the cart — from the shop grid or from
this detail view — a small "✓ Product added to cart" notification appears
for about a second and disappears on its own.

## Customers & Payments (admin panel)
> **If your Firebase project is already set up from before:** the payments
> feature needs one new rule added to what you published earlier. Go to
> Firestore → **Rules**, and add this block inside `match /databases/...`
> alongside your existing `orders`/`products`/`meta` rules (the full
> updated rules are in the setup section above if you'd rather just
> replace the whole thing):
> ```
> match /payments/{paymentId} {
>   allow read, write: if request.auth != null;
> }
> ```
> Click **Publish**. Skip this if you're setting the project up fresh —
> it's already included in the rules above.

The **Customers & Payments** tab in `admin.html` turns your order history
into a running ledger per customer:

- **Summary cards** at the top show Total Sales, Total Payments Received,
  Total Outstanding/Due, Total Advance, and how many customers currently
  have a due or advance balance.
- **Customer list** — every phone number that's placed an order, with
  their total order value, total paid, and a status badge: **red "Due:
  ₹X"**, **green "Advance: ₹X"**, or a neutral **"Paid in Full"**.
  Cancelled orders don't count toward what a customer owes. Search by
  name or phone to find someone quickly.
- Click **View / Record payment** on any customer to open their full
  profile: the same summary, a **Record a payment** form (amount, method
  — Cash / UPI / Bank Transfer / Card / Other — plus an optional
  reference number and note), their full **payment history** (with Edit
  and Delete on each entry), and their recent orders.
- Payments are stored permanently in the database the moment they're
  recorded — they survive refreshes, logging out, and reopening the
  customer later. Editing or deleting a payment immediately recalculates
  that customer's due/advance balance and the dashboard totals.

## About fully automatic WhatsApp sending
Right now, sending still needs one tap from the customer (the share
sheet, or attaching the fallback download) — no website can silently push
a message into WhatsApp on its own. True zero-tap automatic sending
requires Meta's **WhatsApp Business API**, which needs a verified
business account, an approved message template, and a small per-message
cost. That's a separate setup on your end whenever you're ready — happy
to build the integration once you have it.

## Deploying to GitHub Pages

1. **Create a repository.** Go to [github.com/new](https://github.com/new),
   give it a name (e.g. `baba-electronics`), and create it (public repo,
   no need to add a README there — you already have one).

2. **Upload the files.** On the new repo's page, click **"uploading an
   existing file"** (or the **Add file → Upload files** button), then drag
   in every file from this folder: `index.html`, `orders.html`,
   `admin.html`, `style.css`, `app.js`, `pdf-builder.js`, `order-calc.js`,
   `config.js`, `products.js`, `firebase-config.js`, `logo.png`,
   `logo-data.js`, `README.md`. Commit the upload.

3. **Turn on Pages.** In the repo, go to **Settings → Pages** (left
   sidebar). Under "Build and deployment", set **Source** to
   **"Deploy from a branch"**, branch **`main`**, folder **`/ (root)`**,
   then click **Save**.

4. **Wait a minute, then visit your site.** GitHub will show a URL like:
   ```
   https://<your-github-username>.github.io/<repo-name>/
   ```
   That's your live website. Any time you edit a file (e.g. through
   GitHub's web editor — click the pencil icon on the file) and commit the
   change, the live site updates automatically within a minute or two.

### If you'd rather use git from a computer
```bash
git init
git add .
git commit -m "Launch site"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
Then do step 3 above.

## Orders, Payments & Payment Receipts (admin panel)

Checkout now also asks for the customer's **Shop Name** and **delivery
address**, alongside their name and phone — all four are required and are
stored with the order. `orderNo`/`createdAt` (Order Time) and the
customer's Name/Phone/Address are permanent once an order is placed —
nothing in the admin panel can edit them.

Click any row in the **Orders** tab to open the full order drawer:

- **Customer / Shop Information** — Shop Name is editable; Customer Name,
  Phone and Address are shown read-only and can't be changed here.
- **Ordered Products** — change quantities or prices, remove a line, or
  add another product from the catalog. Every change recalculates the
  **Current Order Total** live, before you save anything.
- **Financials** — an optional **Discount**, the **Previous Balance**
  carried over from earlier orders, and **Payment Received**. The engine
  (shared by every screen, in `order-calc.js`) always computes:
  ```
  Current Order Total = sum(line totals) − Discount
  Total                = Previous Balance + Current Order Total
  Balance Remaining    = Total − Payment Received
  ```
  **Payment Status** (Payment Pending / Partially Paid / Fully Paid) is
  never set by hand — it's always derived from Payment Received vs Total,
  so it can't drift out of sync with the numbers.
- **Order Status** (Order Placed / Processing / Completed / Cancelled) is
  editable and separate from Payment Status.
- **Audit Log** — every saved change (Shop Name, Discount, Previous
  Balance, Payment Received, Order Status, or the product list) is
  recorded with who changed it, the old/new value, and when. Order Time
  is never part of this log, because it's never editable.
- **Save changes** writes everything to the database. If Payment Received
  changed, the order also gets a customer-facing notification message
  ("Payment updated successfully for Order #…") that the customer sees
  the next time they look up that order on **My Orders** — this app has
  no push/SMS notifications, so "My Orders" is the existing mechanism
  this plugs into.
- **Save & Generate Payment Receipt** saves first, then builds a formal
  **PAYMENT RECEIPT** PDF (shop branding, Shop Name, Customer details,
  itemized products, Previous Balance, Current Order Total, Total,
  Payment Received, Balance Remaining, Payment Status) from the
  just-saved data. Customers can also download the latest receipt
  themselves from **My Orders**, once an order has been processed at
  least once.
- **Download Order Request PDF** regenerates the original checkout
  document (still headed "ORDER REQUEST") from the saved data — this one
  never changes to a receipt on its own; only the dedicated receipt
  button produces a "PAYMENT RECEIPT".

**Existing orders placed before this update** don't have Shop Name,
Previous Balance, Payment Received, etc. saved yet — every screen treats
that the same way: Shop Name shows blank/editable, Previous Balance and
Payment Received default to ₹0, and Payment Status defaults to Payment
Pending, so nothing breaks and the admin can just fill these in from the
order drawer the first time they touch an old order.

## Notes
- Products without a photo show a simple colored placeholder tile with
  the product's first letter — upload a photo any time from the admin
  panel's Products tab to replace it.
