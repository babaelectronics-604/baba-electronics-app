# Baba Electronics & Electricals — Website

A working store website: live search, category filtering, a cart with
adjustable quantities, order-slip PDF generation shared straight to
WhatsApp, customer order history, and a password-protected admin panel.

## What's in here
- `index.html` — the shop page
- `orders.html` — customer-facing "My Orders" lookup (by phone number)
- `admin.html` — password-protected admin panel: manage orders **and products**
- `style.css` — all the visual styling, shared by all three pages
- `products.js` — **starter catalog only** (see below) — after setup, manage
  products from the admin panel instead
- `app.js` — the shop page's logic (search, cart, PDF, WhatsApp)
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
       match /meta/{docId} {
         allow read, write: if true;
       }
     }
   }
   ```
   Click **Publish**. (Note: this lets anyone who knows how to query the
   database read order and product data — acceptable for a small local
   shop, but not bank-grade privacy. *Writing* products or orders always
   requires being logged in as admin. When you're ready for the WhatsApp
   Business API phase, that's the natural point to lock this down further
   with a proper backend.)

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
  Confirmed → Fulfilled, or Cancelled), or delete an order.

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
   `admin.html`, `style.css`, `app.js`, `products.js`,
   `firebase-config.js`, `logo.png`, `logo-data.js`, `README.md`. Commit
   the upload.

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

## Notes
- Products without a photo show a simple colored placeholder tile with
  the product's first letter — upload a photo any time from the admin
  panel's Products tab to replace it.
