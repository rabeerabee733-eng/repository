# مستودع العاصمة

Independent Arabic medicine catalog with product reference photos, search, WhatsApp inquiry cart, pharmacy details, and provisional invoices.

- Static public directory: `dist`.
- Validation: `node verify.mjs && node cart.test.mjs && node --check dist/app.js && node --check dist/invoice.js`.
- `cart.test.mjs` also runs `invoice.test.mjs`.
- Public site: https://al-asima-medicine-catalog.onrender.com/
- WhatsApp: +963967765704.
- No OpenAI service, account, API key, database, external font, or third-party PDF script is required.
- Displayed prices come from the supplied list and require supplier confirmation.
- This dedicated branch deploys to a separate Render static site; unrelated branches are not used.

## Pharmacy orders and invoices

The cart requires pharmacy name and address before invoice creation or WhatsApp handoff. Optional city, phone, contact and notes accompany the order. WhatsApp is a user-operated handoff; it does not send automatically or attach PDF files. Long orders split into numbered messages.

An invoice snapshots items, quantities and prices and receives a unique identifier. Download generates an A4 PDF locally with Arabic/English item names and blank receipt/signature spaces. The print view also supports paper signatures. Edit order creates a new invoice at current catalog prices and retains the old invoice; prior signatures never carry to the revision.

`invoice.html` lists up to 30 invoices stored in this browser's localStorage. Pharmacy/cart draft details use sessionStorage. Clearing browser data removes the local archive. Invoices do not synchronize across devices and cannot be retrieved from an invoice URL alone on another device. Download/share PDF to retain a copy. There is no shared warehouse archive, server-side order registration, login, payment processing, signature identity verification or delivery-status verification.

At delivery, each person can enter their name and draw in their own signature field, then save and download again. Receipt date is required when receipt details are filled. Changing receipt names clears the corresponding signature; date/notes changes clear both. These are locally entered marks, not cryptographically verified signatures. Receipt fields remain empty until entered by the user.

## QA

Automated checks cover catalog/search, cart eligibility and quantities, totals, pharmacy validation, immutable invoice snapshots, revision signatures, storage capacity/failure, receipt field validation, encoded WhatsApp message limits and PDF byte offsets. Manual UI checks use dummy data only and do not send messages to the warehouse. PDF layout was rendered independently with the production PDF generator for a single-page order and a 219-item order; fonts and pagination were inspected. Cloud browser policy blocks blob URL navigation, so its download automation cannot validate that final browser-specific save action. The generated PDF link and print fallback remain available.
