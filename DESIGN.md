# BioScan interface

The approved client-facing direction is a modern clinic website: white and soft-gray surfaces, emerald actions, bold sans-serif headings, a real clinic exterior photograph, and clear service browsing. Staff workspaces retain their established evergreen and warm-paper identity. Both surfaces support dark mode.

## Tokens

Use the shared CSS variables in styles.css. Paper is #f8f6ef, surface #fffdf7, primary ink #142f28, muted ink #4e6258, action green #28634e, and navigation #15382e. Segoe UI/system sans provides client-facing headings, operational text, and forms. Baskervville remains on staff workspace display headings. Use tabular numerals for prices and financial totals.

## Public directory and reservations

Service-name buttons expose descriptions, prices, and preparation through hover, keyboard focus, or tap. Popovers remain inside the viewport, scroll when needed, and support Close and Escape. No source citations are rendered in service details. Bundles share the directory and booking selection with individual services, with a dedicated category filter. A bundle's included services and preparation remain explicit.

Reservation forms stack on narrow screens. Optional health fields default to Unknown and permit Prefer not to say. Additional text appears only when the client chooses Provide details. Use the same health controls in walk-in registration and preserve consent context appropriate to each flow.

## Staff tools

Credentials choose the workspace. Keep the current sale visible at checkout. Both management roles have service and bundle editors. Bundle editors use two lists on desktop and a single column on mobile, with drag-and-drop plus equivalent Add/Remove buttons. Keep form errors beside the submit action and announce selection counts. Preserve clear keyboard focus and scroll containment. The bundle editor's title and Close control remain visible while scrolling.

Bundle prices are configurable. Financial lines retain their constituent service IDs, bundle label, and exact allocated amounts. Removing a bundled item removes its complete bundle. MedTech entries remain per service; reservation payment status and clinical service completion are separate.

## Verification

Reviewed the new editor on desktop and at 390px mobile width. Checked overflow, service visibility, configurable prices, duplicate prevention, role access, and public preparation rendering. Existing chart grid lines and the warm palette are intentional parts of the established interface.

Patient Care filters use Category, Service, and text search controls with explicit All options. Header identity details support hover, keyboard, and tap. Client profiles use a wide two-column overview/history layout on desktop and a single column on mobile, with a sticky dialog header and expandable transaction and reservation records.

## Theme and scrolling controls

The default light theme preserves the existing clinic identity. Optional dark mode uses deep green surfaces, pale text, mint actions with dark action text, and readable success/warning/error states. The theme is selected in the header, saved separately from clinic records, and shared across public, reservation, and staff pages. Print styles restore light colors. The pictured common-test preview contains service names only; diagnostic details and checkout retain their prices.

Back to top appears after 400px of page scrolling. It supports reduced-motion preferences and returns focus to the main content. On mobile it uses an accessible icon button to limit obstruction.

## Modern client website

The homepage leads with a split introduction and the user-confirmed real clinic photo from assets/bioscan-clinic-exterior.png. Use the stored clinic photo when administrators update it. Keep the logo and factual clinic information intact. The common-test preview is a compact horizontal list without prices, followed by prominent bundle previews, service search, alphabetically ordered category shortcuts, and the existing paginated directory. Avoid unsupported claims or stock medical imagery.

The public header is sticky. The theme control is icon-only at every width, with its accessible label and tooltip retained. A bottom reservation action stays visible on mobile homepage screens; back-to-top sits above it. Reservation pages inherit the modern typography and surfaces while preserving the existing form steps, consent, preparation details, and pricing behavior.

Verified light/dark homepage layouts at desktop and 390px mobile width, category filtering, bundle details, reservation navigation, booking summary totals, and no page overflow.
