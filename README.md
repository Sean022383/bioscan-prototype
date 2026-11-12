# BioScan Laboratories

This is a static prototype for reviewing the public website, account-free Reservation, and staff Point of Sale. It implements selected workflows from Chapters 1 and 3 of the November 2026 BioScan software proposal using HTML, CSS, vanilla JavaScript, and synthetic records.

## Run locally

From the `bioscan-prototype` folder, run:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open [the public website](http://127.0.0.1:8000/) or [Staff Sign In](http://127.0.0.1:8000/staff.html). Use a recent Chromium, Firefox, or Safari browser with site storage enabled. Serve the files over HTTP on localhost or HTTPS. Opening individual files with a `file:` URL can give each page a different storage origin.

## Walkthrough

1. On the public site, search Diagnostic Services for **Routine Urinalysis**, **CBC with Platelet**, or **FBS**. Open **Reservation** and select services on that page. Every visit to the form starts with an empty selection.
2. Enter a fictional Client name and a sample Philippine mobile number such as `09170000131`. Choose an available **Appointment Date and Time Slot**, then open **View simulated SMS** for the generated verification code. Copy the **Reservation Code** on the confirmation page.
3. Open `staff.html` at the same address and port, select **Cashier/Receptionist**, and choose **Sign In**. Both credential fields can be blank. Use **Find Reservation**, paste the code, and retrieve the sale. The scheduled services appear in the current sale. Try **Switch Account** and then sign back in as Cashier/Receptionist to see the unfinished sale.
4. To try an approval at the cashier station, select **Manual Discount Override**, enter a reason and an amount within the subtotal, choose **At the cashier station**, and request approval. Select **Clinic Manager** or **System Administrator**, choose **Approved** or **Declined**, then select **Record Decision**. The Cashier/Receptionist stays signed in and the approved discount appears once.
5. To try the other approval path, use **New Walk-In**, enter fictional Client details, and add a service. Request an override using **From another workstation**. Open a **new tab in the same browser profile** and type the same `staff.html` address. Sign in there as Clinic Manager or System Administrator. Under **Pending Approvals**, review the request and record a decision. The cashier tab releases its payment hold and applies an approved amount, or retains the original eligible discount after a decline. The two tabs must use the same host, port, and protocol. Use a fresh tab opened through the browser instead of duplicating the cashier tab, since duplicating can copy its initial session.
6. Choose **Take Payment**. For Cash, enter an amount received and review the change. For Manually Verified Static-QR E-Wallet, choose GCash or Maya, enter a fictional reference such as `SAMPLE-GCASH-001`, and confirm manual verification. Finalize the payment. A linked Reservation becomes **Completed** and cannot be used to finalize a second transaction.
7. Choose **Print Receipt** to open browser printing. Use **Save as PDF** when a printer is unavailable. For paper, disable the browser’s headers and footers and select the paper size in the print dialog. Printing the same receipt again marks it **REPRINT** and logs a reprint. **View last Transaction Receipt** is available from the cashier workspace after checkout.
8. For **Find Client**, search for fictional sample **Mara Santos** or `CL-1001`. The sample Coupon `CARE10` is valid for Routine Urinalysis, CBC with Platelet, and FBS, once per Client while its usage limit is available. To try Senior Citizen or PWD calculations, add an eligible service and confirm eligibility in the POS.

## Prototype workflows

- The public website includes the supplied clinic exterior photo, landline, and email. In **Clinic Information**, update operating hours and contact details or add facility photos.
- In **Reservation**, choose services and a slot, then open **View simulated SMS** for the generated OTP. The public confirmation page displays delivered messages for the current Reservation. Use the staff **SMS Log** to review confirmations, reminders, notices, and failed dispatches. **System Settings** can simulate an SMS outage. Duplicate bookings for the same Client and slot are rejected.
- The **Cashier/Receptionist** can find matching Client Profiles, view recent Reservations and transactions, and start a walk-in. Use **Find Reservation** for the appointment and service details, and **Find Receipt** with a Transaction Number for an older receipt.
- **Clinic Manager** and **System Administrator** can browse the Client Profile directory. The Administrator can edit profile details. Both roles can schedule closures or service interruptions, review affected Reservations, and send simulated notices.
- Use **Payment & Sync Review** for failed e-wallet verifications, duplicate references, and simulated sync conflicts. **Transaction Corrections** records changes to payment method or e-wallet details while preserving the original sale and Transaction Number.
- In the Manager workspace, edit and deactivate **Coupons** or choose a report period under **Financial and Discount Reports**. **Export CSV** downloads a file. **Export PDF** opens the browser print dialog where you can choose **Save as PDF**.
- In the Administrator workspace, **Staff Accounts** supports creation, editing, role changes, password resets, and activation. **Roles and Permissions** displays the fixed access for each role. Audit entries include the staff username when signed in with an account.
- While the prototype is open, next-day No-Show updates and due reminders run in the browser. An open signed-in staff page checks for daily backup copies and retries eligible simulated synchronization. Seven-day retention applies to backup copies. The browser keeps active records until site data is cleared.

## Backup and Recovery

The System Administrator can open **Backup and Recovery** to view Local PostgreSQL and Supabase status, transaction synchronization, the last successful sync, and daily backup history. **Backup database** selects the source. Choose **Restore** on a dated verified copy to stage its financial records. The Clinic Manager and System Administrator can review the resulting transaction comparison and approve reconciliation. A restore pauses payment finalization for the affected database. Records outside the selected backup are preserved.

Use **Simulate Connections** to test an outage. With Local PostgreSQL offline and Supabase online, choose **Switch to Cloud Database** and confirm that local cashiering has stopped. To return, bring both databases online, choose **Switch to Local Database**, and approve reconciliation. The Clinic Manager can perform mode changes and approve reconciliation from **Database Operations**. The System Administrator is the only role with restore controls. The cloud restore confirmation reflects the thesis requirement for authorized Supabase project access.

Database statuses, synchronization, and daily financial snapshots run in this browser prototype. The thesis deployment uses encrypted local backup files and separate Supabase-managed backups.

## Browser storage and simulation

- `sessionStorage` holds the signed-in role, cashier draft, and last receipt for the current tab. Leave both credential fields blank to open the selected role for the walkthrough. When using a staff account, enter its login username and password. The account’s assigned role opens automatically.
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

