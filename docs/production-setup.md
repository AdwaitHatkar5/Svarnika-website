# Production Setup

## Where To Update Inventory

Use a Google Sheet with two tabs:

- `Inventory`: product rows for the website.
- `Orders`: customer orders submitted from checkout.

Create the `Inventory` tab with these exact headers:

```csv
id,name,category,metal,weight,price,image,description,stock
```

You can either edit the Google Sheet directly or open `/admin` on your deployed site and add products from the website. Product images must be public URLs.

The Apps Script creates and updates the `Orders` tab automatically. If you create it manually, use these headers:

```csv
createdAt,orderId,customerName,customerEmail,customerPhone,customerAddress,paymentRef,upiId,total,items,status,shipmentId,shipmentCompanyLink
```

To make shipment tracking visible on the website, update `status`, `shipmentId`, and `shipmentCompanyLink` for the matching `orderId` row. Customers can enter their order ID on the storefront and open the shipment company link from the tracking card.

## Where To Add UPI Details

Set these variables locally in `.env` and in Netlify under `Site configuration -> Environment variables`:

```bash
VITE_UPI_ID=your-upi-id@upi
VITE_UPI_NAME=Svarnikaa
```

## Where To Add Email And Sheet Credentials

Google Apps Script sends email using your Google account. You do not add a Gmail password in this website.

1. Create a Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Paste the code from `docs/google-apps-script.js`.
4. In Apps Script, go to `Project Settings -> Script Properties`.
5. Add `OWNER_EMAIL` with the email address that should receive order notifications.
6. Deploy as `Web app`.
7. Set `Execute as` to `Me`.
8. Set `Who has access` to `Anyone`.
9. Copy the web app URL.

Customer email is optional in checkout. If entered, it must be a valid email address under 254 characters, and the Apps Script sends a simple order-received email to that address.

After deployment, `ping` reports `inventoryRows` and `orderRows`. The admin page loads orders automatically after PIN unlock.

Add the web app URL to local `.env` and Netlify:

```bash
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Connect Live Inventory

In Google Sheets, publish only the `Inventory` tab:

1. `File -> Share -> Publish to web`.
2. Choose the `Inventory` sheet.
3. Choose `Comma-separated values (.csv)`.
4. Copy the published CSV URL.

Add it to local `.env` and Netlify:

```bash
VITE_GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/e/YOUR_PUBLISHED_SHEET_ID/pub?output=csv
```

## Admin Page

The admin page is available at:

```text
/admin
```

Set this variable in local `.env` and Netlify:

```bash
VITE_ADMIN_PIN=change-this-pin
```

This is a simple PIN gate for a small catalogue workflow. Do not share the `/admin` URL publicly.

Admin supports:

- Product add/edit by `id`; the Apps Script updates the matching product row instead of creating duplicates.
- Offer fields: `originalPrice`, `offerLabel`, and `offerText`.
- Recent order dashboard after admin PIN unlock.
- Status, shipment ID, and courier link updates.
- Invoice generation with two modes: single customer/multiple orders and two orders on one A4 page.

After updating `docs/google-apps-script.js`, redeploy the Apps Script once so the new inventory, order update, and invoice-support fields are available.

For private payment screenshot upload and inventory image folders, open Apps Script, select `authorizeDriveAccess`, click Run, and approve Drive access once. The script prepares `My Drive / Svarnikaa Payment Proofs` and `My Drive / Svarnikaa Payment Proofs / Inventory`.

## Netlify Deploy Settings

Use these settings:

```text
Build command: npm run build
Publish directory: dist/public
```

The included `netlify.toml` already sets the same values and supports direct routes like `/admin`.
