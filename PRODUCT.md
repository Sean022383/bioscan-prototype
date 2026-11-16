# BioScan Laboratories

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS, and vanilla JavaScript for GitHub Pages.

## Users and purpose

Clients browse clinic information and Diagnostic Services, then create an account-free Reservation. The Cashier/Receptionist retrieves a Reservation or registers a walk-in, prepares the sale, verifies payment, and issues a Non-BIR Transaction Receipt. The Clinic Manager and System Administrator review Manual Discount Overrides and have separate workspaces reflecting their thesis permissions. The Clinic Manager manages Coupons and exports reports. Both management roles can browse Client Profiles and review closures, notifications, flagged payments, and corrections. The System Administrator creates Diagnostic Services for the shared catalog and staff accounts with a full name, login username, password, and one role.

## Operating context

The Reservation Code connects the public workflow to the front desk. The active staff role and unfinished cashier sale belong to their tab. Reservations, approval decisions, Diagnostic Services, Coupons, and transactions are shared by tabs on the same browser origin. The initial records include 30 days of fictional sales. SMS, payments, database connections, backup copies, and reconciliation are simulated. Staff accounts use browser-local credentials that determine their workspace; blank-credential access is removed. MedTech accounts have service assignments and share the patient lists for those services. Confirmed unpaid reservations are Incoming; paid services are Ready until individually completed or referred. Return referrals record a reason and date; external referrals record a receiving clinic. Managers and Administrators review patient care and referrals. Reservations include optional self-reported health information, preparation guidance, and recorded data-use and preparation consent.

## Evidence on hand

November 2026 software proposal, Chapters 1 and 3. User-supplied laboratory, X-ray, and ultrasound price sheets. The user confirmed 6 Lanzones Street, Potrero, Metro Manila as the public address. The supplied landline is (02) 8361-4295 and email is bioscanlab@yahoo.com. Operating hours are example details. The supplied photographs document price sheets. The supplied BioScan logo, exterior photo, and Facebook URL are used on the public site.

## Product principles

Keep the Reservation action visible. Keep checkout focused on the current sale. Preserve the cashier session during approval and preserve the sale when switching accounts. Keep service prices and reservation statuses legible.

## Bundles and service editors

Both Manager and Administrator may create and edit diagnostic services and bundles. Service definitions include public descriptions and preparation instructions. Bundle definitions reference existing service IDs and carry a configurable price; sales preserve the component tests and bundle-price snapshots. Walk-in and reservation health fields match. Public service details do not render source citations. Demo usernames and passwords match: pos1, medtech1, clinic1, admin1.

## Cloud operating model

The current prototype supersedes the initial LAN/fallback model with a primary cloud database and a separate cloud backup. Backup outages do not stop primary processing; primary outages pause checkout and reservations. Restores require Administrator initiation and management reconciliation. Connections and backup copies are simulated. Category menus sort alphabetically and reservation statuses are filterable with date.
