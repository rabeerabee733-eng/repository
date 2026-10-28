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

## Pharmacy orders and PDF sharing

The cart requires pharmacy name and address. A single preparation action snapshots the order and opens its invoice, where PDF is automatically generated. Optional city, phone, contact and notes accompany the order. The PDF is retained in memory as a File, allowing the Share button to invoke Web Share immediately during user activation. On compatible devices the user chooses WhatsApp and the warehouse contact. A share API resolution is never represented as delivery confirmation.

The fixed-recipient WhatsApp link addresses +963967765704 and contains the pharmacy details, invoice ID, items and quantities. It supports numbered parts for long orders. A wa.me link does not attach PDF. When file sharing is unsupported, download PDF and attach it in WhatsApp, or use the print dialog to save it.

There is no automatic WhatsApp Business integration or backend in this static site. Merely filling the form does not transmit an order. A sender account/API setup and backend would be needed for automatic server-side messaging and document delivery. No API credentials belong in this public site.

## Paper receipt

Invoice HTML and PDF always contain blank paper lines for delivery date, receiving notes, warehouse and pharmacy representative names, signatures and stamps. No signature canvas, electronic receipt entry or save-signature control exists. Previously stored electronic receipt data is retained in old local records but is ignored by the display and PDF generator. Signatures are written with a pen after printing.

## Local records

`invoice.html` lists up to 30 invoice snapshots in localStorage. Draft pharmacy/cart details use sessionStorage. Records do not synchronize between devices; clearing browser data removes them. Editing an order creates a new invoice at current catalog prices and retains the old one. All prices are provisional and require supplier confirmation. There is no payment processing or confirmation of delivery.

## QA

`node verify.mjs && node cart.test.mjs && node --check dist/app.js && node --check dist/invoice.js` validates catalog search, cart eligibility, quantity bounds, totals, pharmacy validation, snapshots, local storage, WhatsApp message encoding/recipient, PDF structure, paper-only receipt rendering and file-share capability fallbacks. Manual testing uses dummy local data and does not send warehouse messages. The production PDF generator was rendered independently for a single-page and a 219-item order. Cloud browser automation does not provide native file sharing; its unsupported-device fallback was checked. Blob navigation is blocked by its browser policy, so final download/native-share execution requires a supporting user browser.

## Pack controls and mobile basket

Every eligible product has a zero-to-99 pack counter with plus/minus controls in both the card and detail dialog. Updates synchronize in place with the basket and its total; reducing a count to zero removes the item. The basket bar remains visible even when empty and respects the mobile safe area. The basket dialog keeps its close control and total/checkout action visible while the item list and pharmacy form scroll. Draft pharmacy fields survive quantity changes.

The invoice handoff displays two clear actions: open the order directly in the warehouse WhatsApp conversation, and share or download the PDF attachment. Browser file sharing still requires the user to choose the WhatsApp recipient. Direct automatic PDF attachment to a preset WhatsApp chat is not implemented without a messaging service integration.

Static scripts/styles and relative module imports carry an asset version. Bump that version together for future frontend releases so an older cached script cannot run against newer HTML.
