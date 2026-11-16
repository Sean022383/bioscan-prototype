# BioScan Laboratories

This is a static prototype for reviewing the public website, account-free Reservation, and staff Point of Sale. It implements selected workflows from Chapters 1 and 3 of the November 2026 BioScan software proposal using HTML, CSS, vanilla JavaScript, and synthetic records.

## Run locally

From the `bioscan-prototype` folder, run:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open [the public website](http://127.0.0.1:8000/) or [Staff Sign In](http://127.0.0.1:8000/staff.html). Use a recent Chromium, Firefox, or Safari browser with site storage enabled. Serve the files over HTTP on localhost or HTTPS. Opening individual files with a `file:` URL can give each page a different storage origin.

## Walkthrough

Sign in with a username and password; the account determines its role. Demo accounts are `pos1` (front desk), `medtech1`, `medtech2`, `clinic1` (Clinic Manager), and `admin1` (Administrator). Each password is identical to its username. Legacy accounts are preserved for existing walkthroughs. Existing custom accounts are preserved. The role dropdown and blank-credential walkthrough have been removed; use these accounts for the walkthrough below. At-station approvals also require Manager or Administrator credentials.

## MedTech and reservation additions

- Public Diagnostic Services no longer has a price column. Click or tap a service name with its info icon to open its description, price, and preparation. Keyboard users activate the button with Enter or Space; hovering or focusing alone does not open details. Escape or Close dismisses the details. Preparation also appears in the Reservation flow.
- Health fields in Reservation are optional and default to Unknown, with Prefer not to say available. Before confirming, clients must agree to data use and acknowledge the selected preparation guidance. The reservation records consent time and the selected services, and preserves the submitted health information for that visit.
- Sign in as `medtech1` to see Routine Urinalysis, CBC with Platelet, and FBS; `medtech2` shares Urinalysis and CBC. **Incoming** contains confirmed unpaid reservations. Finalized payments, including walk-ins, generate a **Ready** entry for each assigned service. Completion is per service and is separate from the Reservation status, which still becomes Completed at payment.
- MedTechs can view assigned patients' details and optional self-reported health information. Record a return referral with reason and date, or a referral to another clinic with its name and an optional return date. MedTechs assigned that service see the same status. **Referrals** preserves the history after completion. Manager and Administrator accounts review all entries under **Patient Care & Referrals**; clinical actions belong to MedTechs.
- Administrators create or edit MedTech accounts under **Staff Accounts** and select one or more assigned services. Changes to assignments change visibility without changing historical completions or referrals.
- Preparation is general guidance researched from MedlinePlus, RadiologyInfo, and Nebraska Medicine, with source links kept out of the public interface. Fasting intervals, specimen methods, and scan protocols require confirmation with BioScan; these are not claimed to be clinic-approved instructions. Both Manager and Administrator can create and edit service descriptions and preparation instructions.

## Bundles and service management

Both Clinic Manager and System Administrator have **Service Bundles** and **Diagnostic Services** tools. Bundle builders support drag-and-drop between available and included lists, plus Add/Remove buttons for keyboard and touch. A bundle requires at least two existing services, a name, description, and configurable price. An unavailable component makes a bundle unavailable. New services require a name, category, price, description, and preparation instructions, with optional alias and eligibility settings.

Four example bundles use only catalog services: General Checkup Tests (six tests, ₱1,490), Lipid Profile (₱670), Thyroid Panel (₱1,200), and Routine Chemistry Panel (₱1,640). These initial sample prices equal the sum of BioScan's existing service prices and are editable; no consultation or medical certificate is included. Examples were adapted from [Hi-Precision package types](https://www.hi-precision.com.ph/packages-luzon-mindanao) and [Healthway checkup packages](https://healthwaymedicalnetwork.com.ph/healthcheq-packages/), rather than claiming identical clinical packages or prices.

Bundles appear in the public directory, Reservation, and POS under **Bundles**. A sale expands each bundle into its component tests, with the bundle price apportioned exactly across lines. This preserves eligibility calculations, receipts, and per-service MedTech assignments. A duplicate test cannot be added through overlapping bundles or standalone selections. Removing one bundled line at the POS removes that whole bundle. Existing reservation and sale snapshots retain their original prices when a bundle is edited.

Walk-in registration now uses the same optional health fields as Reservation; front-desk staff confirm the client's data-use agreement. Health details are saved to the Client Profile and visible to assigned MedTechs. Reservation-only schedule, OTP, and preparation acknowledgments remain in the reservation flow.

## Cashier walkthrough

1. On the public site, search Diagnostic Services for **Routine Urinalysis**, **CBC with Platelet**, or **FBS**. Open **Reservation** and select services on that page. Every visit to the form starts with an empty selection.
2. Enter a fictional Client name and a sample Philippine mobile number such as `09170000131`. Choose an available **Appointment Date and Time Slot**, then open **View simulated SMS** for the generated verification code. Copy the **Reservation Code** on the confirmation page.
3. Open `staff.html` at the same address and port, enter `pos1` / `pos1`, and choose **Sign In**. Use **Find Reservation**, paste the code, and retrieve the sale. The scheduled services appear in the current sale. Try **Switch Account** and then sign back in as Cashier/Receptionist to see the unfinished sale.
4. To try an approval at the cashier station, select **Manual Discount Override**, enter a reason and an amount within the subtotal, choose **At the cashier station**, and request approval. Enter the `clinic1` or `admin1` credentials, choose **Approved** or **Declined**, then select **Record Decision**. The Cashier/Receptionist stays signed in and the approved discount appears once.
5. To try the other approval path, use **New Walk-In**, enter fictional Client details, and add a service. Request an override using **From another workstation**. Open a **new tab in the same browser profile** and type the same `staff.html` address. Sign in there as Clinic Manager or System Administrator. Under **Pending Approvals**, review the request and record a decision. The cashier tab releases its payment hold and applies an approved amount, or retains the original eligible discount after a decline. The two tabs must use the same host, port, and protocol. Use a fresh tab opened through the browser instead of duplicating the cashier tab, since duplicating can copy its initial session.
6. Choose **Take Payment**. For Cash, enter an amount received and review the change. For Manually Verified Static-QR E-Wallet, choose GCash or Maya, enter a fictional reference such as `SAMPLE-GCASH-001`, and confirm manual verification. Finalize the payment. A linked Reservation becomes **Completed** and cannot be used to finalize a second transaction.
7. Each successful checkout issues a numeric queue reference on the receipt: **1, 2, 3, …**, restarting at **12:00 AM Philippine time**. Reopening or reprinting a receipt preserves its original number, including on a later day. Existing receipts without a number remain unchanged. Only the current daily counter and each receipt's number/date are retained; there is no separate queue history or queue dashboard. In this browser prototype, the counter is shared across tabs on the same origin, not separate computers or browser profiles.
8. Choose **Print Receipt** to open browser printing. Use **Save as PDF** when a printer is unavailable. For paper, disable the browser’s headers and footers and select the paper size in the print dialog. Printing the same receipt again marks it **REPRINT** and logs a reprint. **View last Transaction Receipt** is available from the cashier workspace after checkout.
9. For **Find Client**, search for fictional sample **Mara Santos** or `CL-1001`. The sample Coupon `CARE10` is valid for Routine Urinalysis, CBC with Platelet, and FBS, once per Client while its usage limit is available. To try Senior Citizen or PWD calculations, add an eligible service and confirm eligibility in the POS.

## Prototype workflows

- The public website includes the supplied clinic exterior photo, landline, and email. In **Clinic Information**, update operating hours and contact details or add facility photos.
- In **Reservation**, choose services and a slot, then open **View simulated SMS** for the generated OTP. The public confirmation page displays delivered messages for the current Reservation. Use the staff **SMS Log** to review confirmations, reminders, notices, and failed dispatches. **System Settings** can simulate an SMS outage. Duplicate bookings for the same Client and slot are rejected.
- The **Cashier/Receptionist** can find matching Client Profiles, view recent Reservations and transactions, and start a walk-in. Use **Find Reservation** for the appointment and service details, and **Find Receipt** with a Transaction Number for an older receipt.
- **Clinic Manager** and **System Administrator** can browse the Client Profile directory. The Administrator can edit profile details. Both roles can schedule closures or service interruptions, review affected Reservations, and send simulated notices.
- Use **Payment & Backup Review** for failed e-wallet verifications, duplicate references, and simulated backup conflicts. **Transaction Corrections** records changes to payment method or e-wallet details while preserving the original sale and Transaction Number.
- In the Manager workspace, edit and deactivate **Coupons** or choose a report period under **Financial and Discount Reports**. **Export CSV** downloads a file. **Export PDF** opens the browser print dialog where you can choose **Save as PDF**.
- In the Administrator workspace, **Staff Accounts** supports creation, editing, role changes, password resets, and activation. **Roles and Permissions** displays the fixed access for each role. Audit entries include the staff username when signed in with an account.
- While the prototype is open, next-day No-Show updates and due reminders run in the browser. An open signed-in staff page checks for daily backup copies and retries eligible cloud backups. Seven-day retention applies to backup copies. The browser keeps active records until site data is cleared.

## Cloud database and backup

The current prototype uses **Primary Cloud (Supabase)** for transactions and reservations, plus a separate **Cloud Backup** for recovery copies. The earlier LAN/local-database and fallback workflows have been removed. These connections and copies remain browser simulations; no real cloud infrastructure is provisioned.

Manager **Database Operations** and Administrator **Backup and Recovery** show both cloud connection statuses, the last successful backup, and transactions awaiting backup. **Back Up Now** captures current finalized sales into the backup cloud. Automatic daily copies retain a rolling seven-day history. Failed backups preserve usable copies until a new backup succeeds. Existing fictional profiles, reservations, and sales are preserved when older recovery state is migrated.

A primary-cloud outage pauses both cashier checkout and reservation confirmation. A backup-cloud outage leaves primary-cloud processing available and keeps backups pending. The backup cloud does not become a separate cashiering database. Coupons remain available during normal cloud processing.

Administrators can **Simulate Connections** and stage a dated verified copy with **Restore to Primary Cloud**. Payment and reservation finalization pause during restore review. Manager or Administrator approval reconciles missing records while preserving current records, blocks duplicate reservations/payment references, and resumes processing. Managers can view backup history and approve reconciliation; only Administrators can initiate restores.

## Browser storage and simulation

The November 16 demo refresh replaces previous operational records once per browser origin, preserving staff accounts, passwords, service/bundle settings, and clinic details. It supplies 90 fictional paid transactions over 30 days, 61 reservations, 104 profiles, and at least 61 simulated SMS entries, plus completed services and sample referrals. Old backups, payment issues, corrections, closures, and queue counters are cleared with the old operational history. Subsequent refreshes preserve new work. These SMS messages are simulated; nothing is sent to real phones.

- `sessionStorage` holds the signed-in role, cashier draft, and last receipt for the current tab. Enter the staff account’s login username and password. Blank credentials no longer sign in. The account’s assigned role opens automatically.
- Namespaced `localStorage` shares Reservations, Client Profiles, override decisions, and finalized sales across tabs on the same origin. To reset the fictional records, close the BioScan tabs and clear site data for the preview origin. On an origin shared with other projects, delete only the storage keys beginning with `bioscan-prototype:v1:` using browser developer tools.
- System Administrators can open **Staff Accounts → Create Staff Account**, then enter a full name, unique login username, password, and role. Use **Switch Account** to sign in as that staff member. Accounts are shared across tabs in the same browser profile and origin. They are cleared with site data. Use fictional staff details and a test password.
- Use fictional Client details and payment references. Verification uses a generated simulated OTP with a five-minute window. E-wallet payment is a manual confirmation walkthrough. Messages, transfers, staff access, and integrations are simulated in the browser.
- Appointment slots and shared capacity are sample settings. Senior Citizen and PWD examples apply 20% to eligible service amounts. The examples use simple calculations without VAT treatment. Eligibility for the three sample lab services is a prototype setting. The supplied ultrasound price sheet informs the ultrasound example.
- The first visit seeds 30 days of fictional sales, Reservations, Client Profiles, approval decisions, and audit events. In Clinic Manager, **Financial and Discount Reports** charts daily net sales by payment method. Use **View daily figures** for exact amounts, or change the reporting period.
- In Clinic Manager, use **Coupons → Create Coupon**. Set a unique code, discount value, dates, usage limits, and eligible services. Enter the code during cashier checkout. In System Administrator, use **Diagnostic Services → Create Diagnostic Service**. An available service appears in public Diagnostic Services, Reservation, and the cashier catalog. The Clinic Manager can manage its availability and eligibility.
- The supplied BioScan logo, clinic exterior photo, landline, email, and Facebook link are included. Operating hours start as example details.
- The catalog is a selection of clearly priced items from the supplied laboratory, imaging, and ultrasound sheets. Entries with conflicting or unreadable price edits and send-out entries were left out.

## Publish on GitHub Pages

1. Create or select a repository. Put the contents of `bioscan-prototype` at the publishing root so `index.html` is at that root.
2. In **Settings → Pages**, choose **Deploy from a branch**, select the branch that contains the files, choose **/(root)**, and save.
3. Open the Pages URL when deployment completes. From there, the public navigation opens `reservation.html` and the footer opens `staff.html`. The files and assets use relative paths, so they also work below a repository URL.

[GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)


## Patient filters and detailed profiles

MedTech and management Patient Care lists have Category and Service filters with All categories and All services options. Status counts and searches reflect these filters. A MedTech's All services view still includes only that account's assigned services.

The header shows the signed-in staff member's name and role. Hover over the name, or activate it by keyboard/tap, to view the full name and assigned services grouped by category.

View Client and the Client Profile directory open a wide responsive profile with demographics, optional self-reported health information, transaction history, and reservation history. Expand a transaction for its service lines, prices, payment breakdown, and linked reservation. Expand a reservation for selected services, appointment date and time, status, SMS state, and recorded consent. MedTech history is restricted to assigned service lines; displayed scoped amounts are service subtotals before transaction discounts. Management sees full transaction payment totals. Clinical completion and referral controls remain available in the patient-care view.

Patient-view controls use separate attributes from service-edit controls so opening a client cannot also open a service editor.

Category menus are alphabetical, with All categories first. Reservation listings support All statuses, Cancelled, Completed, Confirmed, and No-Show, combined with the appointment date filter.

The header has a persistent light/dark theme toggle on all pages. Back to top appears after scrolling. The Common laboratory tests preview shows names without prices; prices remain in service details and checkout.

The client homepage now uses the approved modern white/emerald design, sans-serif headings, and the real clinic photo in the hero. Bundle previews and category shortcuts lead into the existing directory. The theme toggle is icon-only with an accessible label; a mobile homepage reservation button stays visible while scrolling. The booking page shares the new client styling.
