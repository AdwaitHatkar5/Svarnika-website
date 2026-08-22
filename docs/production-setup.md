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

## Netlify Deploy Settings

Use these settings:

```text
Build command: npm run build
Publish directory: dist/public
```

The included `netlify.toml` already sets the same values and supports direct routes like `/admin`.
