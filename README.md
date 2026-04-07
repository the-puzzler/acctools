# Acc Tools

Static GitHub Pages site for browser-based internal tools.

## What it does

- `index.html` is the app landing page
- `csv-date-processor.html` is the live CSV processing tool
- Runs entirely in the browser
- Works on GitHub Pages
- Does not upload CSV data anywhere

## Local preview

Open `index.html` directly in a browser, or run any simple static server in this folder.

## GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open `Pages`.
3. Set the source to deploy from your main branch.
4. Save, then open the published URL.

## Live tool

The current live tool is the CSV Date Processor.

Open `csv-date-processor.html` from the landing page, or directly if needed.

The processing logic lives in `app.js` and:

- extracts `Start Date` and `End Date` from the `Reference` column
- adds a `Review` column based on the invoice month comparison
- de-duplicates rows by `Invoice Number`

Required input columns:

- `Invoice Number`
- `Reference`
- `Invoice Date`
