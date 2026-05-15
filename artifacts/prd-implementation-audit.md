# Leadra PRD Implementation Audit

Date: 2026-05-15
Branch: `codex/prd-completion-recovery`

## ImplementationScore

| Lane | Scope | Score | Evidence |
| --- | --- | ---: | --- |
| 0 | App extraction into feature modules | 100% | `src/features/create`, `src/features/units`, `src/features/details`, `src/features/admin`, `src/features/shared`; `App.tsx` remains coordinator shell. |
| 1 | Backend, contracts, permissions | 96% | Role/owner/price/archive/password/reassignment/video/remaining-value guardrails in `src/lib/domain.ts`, `src/lib/workflows.ts`, `src/lib/repository.ts`, mapper tests, migrations `0028`-`0033`. |
| 2 | Create Unit flow | 96% | Destination before Developer, required stars, 12 unit types, conditional fields, year-only delivery, month-year installments, video/PDF attachment validation. Browser screenshots `01`-`03`. |
| 3 | Units and filters | 94% | Destination/project-first pages, broad numeric/payment/delivery/owner-phone filter coverage, searchable inputs. Browser screenshots `04`-`05`. |
| 4 | Unit Details and edit flow | 96% | PRD display order, Destination before Developer, Delivery before Commission, edit permissions, owner visibility, mobile touch targets. Browser screenshots `06`-`09`. |
| 5 | PDF export and sharing | 95% | Permission-safe PDF data, payment method excluded, selected images only, video excluded, timetable next installment, PDF action audit/notifications. `src/lib/pdf.test.ts`. |
| 6 | Admin, master data, users | 94% | Admin/Sub Admin parity, password reset path, master data modules, user reassignment flow. Browser screenshots `10`-`11`. |
| 7 | Notifications, audit, copy, i18n | 96% | Durable 72-hour inactivity workflow, email payload `{ body }`, audit/notification keys, EN/AR strings. `src/lib/notificationDelivery.test.ts`. |
| 8 | QA and browser verification | 100% | `npm run typecheck`, `npm run test`, `npm run build`, `npm run e2e`; screenshots in `artifacts/lane8-mobile-390/`. |

## Latest Additions Checklist

| # | Requirement | Status | Evidence |
| ---: | --- | --- | --- |
| 1 | Role access, Admin/Sub Admin parity, owner phone visibility, password restriction, uploader visibility | Implemented / Covered by Test / Browser Verified | Domain permission helpers, admin/user management, screenshots `06`-`09`. |
| 2 | All Units navigation and searchable dropdown behavior | Implemented / Browser Verified | `src/features/units/UnitsPage.tsx`, screenshots `04`-`05`. |
| 3 | Mobile-fit Unit Details page and edit-property action | Implemented / Browser Verified | `src/features/details/UnitDetailsPage.tsx`, screenshots `06`-`09`. |
| 4 | Required field star/asterisk indicator | Implemented / Browser Verified | Create/details forms and `RequiredLabel`; screenshots `01`-`03`, `06`. |
| 5 | Admin-created Destination, Developer, Project; Destination retained | Implemented / Covered by Test | Master data modules, create/details/PDF data paths. |
| 6 | Fixed 12 Unit Types and conditional field display | Implemented / Covered by Test | Domain/form field rules and workflow tests. |
| 7 | Floor range up to 40 and Penthouse wording | Implemented / Covered by Test | Shared constants, i18n/copy audit. |
| 8 | Replacement of mark functionality with Hold, Sold by Us, Sold by Others | Implemented / Covered by Test | Status UI, domain values, analytics stale logic. |
| 9 | Installment From/To month-year selectors and Remaining Value rule | Implemented / Covered by Test | Workflows/domain tests, payment timetable helpers. |
| 10 | Pricing fields including transfer fees and PDF payment-method exclusion | Implemented / Covered by Test | Unit details/PDF tests. |
| 11 | Media and image PDF inclusion/exclusion controls | Implemented / Covered by Test | Media mapper/repository, migration `0033`, PDF tests. |
| 12 | Full PDF export requirements | Implemented / Covered by Test | `src/lib/pdf.ts`, `src/lib/pdf.test.ts`. |
| 13 | Delivery date behavior | Implemented / Covered by Test | Year-only delivery in create/edit; month-year remains installment-only. |

## Business Rules 1-68

| # | Status | Evidence |
| ---: | --- | --- |
| 1 | Implemented | Login has no registration path; users are admin-created. |
| 2 | Implemented | Create Unit route is available to all roles. |
| 3 | Implemented | All roles can browse units; owner fields are permission-filtered. |
| 4 | Implemented / Browser Verified | Owner phone visible to Admin/Sub Admin/uploader only; screenshots `06`-`09`. |
| 5 | Implemented | Owner phone filter/search is Admin/Sub Admin only. |
| 6 | Implemented | Sales archive permission denied by domain helper. |
| 7 | Implemented | Manager archive permission denied by domain helper. |
| 8 | Implemented | Archive is soft state, not permanent deletion. |
| 9 | Implemented | Owner field edits after creation are denied to sales. |
| 10 | Implemented / Browser Verified | Non-uploading sales owner phone hidden; screenshot `09`. |
| 11 | Implemented | Sales owner phone search disabled. |
| 12 | Implemented | Uploader shown in unit cards/details. |
| 13 | Implemented | Admin/Sub Admin parity is enforced in permission helpers. |
| 14 | Implemented | Admin/Sub Admin manage Destination, Developer, Project. |
| 15 | Implemented / Covered by Test | Destination retained in UI, filters, mapper, PDF. |
| 16 | Implemented / Covered by Test | Duplicate checks use normalized owner phone. |
| 17 | Implemented | Owner name does not block duplicates. |
| 18 | Implemented / Covered by Test | Same normalized phone blocked only in same project. |
| 19 | Implemented | Same normalized phone in another project is allowed silently. |
| 20 | Implemented | Unit code generated automatically. |
| 21 | Implemented | Unit code uses Project Abbreviation + Bedrooms + BR. |
| 22 | Implemented | Unit Type fixed to the 12-type list. |
| 23 | Implemented | Unit Type drives conditional area/floor fields. |
| 24 | Implemented | Floor supports Ground and 1-40. |
| 25 | Implemented | Ground shows Garden Area when applicable. |
| 26 | Implemented | Penthouse wording is used globally. |
| 27 | Implemented | Penthouse shows BUA and Terrace Area only. |
| 28 | Implemented | Cabin shows BUA only. |
| 29 | Implemented | Payment method is Cash or Installment only. |
| 30 | Implemented / Covered by Test | Payment method appears in details and is excluded from PDF. |
| 31 | Implemented | Cash price maps to Total Value. |
| 32 | Implemented / Covered by Test | Initial Remaining Value is Total Unit Cost minus Down Payment. |
| 33 | Implemented / Covered by Test | Remaining Value cannot be manually edited. |
| 34 | Implemented / Covered by Test | Remaining Value changes through timetable activity after creation. |
| 35 | Implemented / Covered by Test | Pricing edits do not rewrite Remaining Value outside timetable. |
| 36 | Implemented | Installment period uses From/To month-year selectors. |
| 37 | Implemented | Quarterly/Semi-Annual/Annual installment amounts are calculated. |
| 38 | Implemented | Custom installment is text-only unless configured later. |
| 39 | Implemented / Covered by Test | Custom installment text appears in PDF. |
| 40 | Implemented | Commission defaults to 1.5% unless configured. |
| 41 | Implemented | Commission change restricted to Admin/Sub Admin. |
| 42 | Implemented | Transfer fees display only when applicable. |
| 43 | Implemented | Hold does not auto-expire. |
| 44 | Implemented | Sold by Us and Sold by Others are distinct. |
| 45 | Implemented | First uploaded image becomes thumbnail. |
| 46 | Implemented / Covered by Test | Videos rejected in UI/domain/database/PDF paths. |
| 47 | Implemented / Covered by Test | Selected images can be shown/hidden from PDF. |
| 48 | Implemented / Covered by Test | Branded PDF includes required unit, area, pricing, delivery, custom installment data. |
| 49 | Implemented | Web Share uses native share when available and download fallback. |
| 50 | Implemented / Covered by Test | Notifications are in-app and email payloads are queued when Supabase is configured. |
| 51 | Implemented | Inactive users remain visible in audit history. |
| 52 | Implemented | Sensitive actions create audit logs. |
| 53 | Implemented | Media upload limit starts at 40 MB total per unit. |
| 54 | Implemented | Upload failures return clear validation errors. |
| 55 | Implemented | Delivery Date is year-only unless future approval changes it. |
| 56 | Implemented | Delivery expectancy supports future years beyond next year. |
| 57 | Implemented / Browser Verified | Mobile UI is prioritized and verified at 390px. |
| 58 | Implemented | Major screen order follows PRD. |
| 59 | Implemented | Self-service password editing disabled; admin reset path exists. |
| 60 | Implemented | Multiple sessions are not force-blocked unless revoked. |
| 61 | Implemented | Sales deactivation requires reassignment and preserves history. |
| 62 | Implemented | Total Value/pricing edit scope is Admin/Sub Admin/uploader only. |
| 63 | Implemented | Destination appears before Developer in Create Unit and Details. |
| 64 | Implemented | Furnished is hidden when false. |
| 65 | Implemented | Finishing Status is required and starred. |
| 66 | Implemented | Unit Details shows Delivery before Commission. |
| 67 | Implemented / Covered by Test | Videos are rejected and never stored, shown, thumbnailed, exported, or referenced. |
| 68 | Implemented | Admin/Sub Admin password reset/edit is admin-controlled only. |

## Browser Evidence

Screenshots saved under `artifacts/lane8-mobile-390/`:

- `01-create-property-admin.png`
- `02-create-payment-admin.png`
- `03-create-owner-admin.png`
- `04-units-destinations-admin.png`
- `05-units-project-filters-open-admin.png`
- `06-details-admin-owner-visible.png`
- `07-details-manager-owner-hidden.png`
- `08-details-uploading-sales-owner-visible.png`
- `09-details-nonuploading-sales-owner-hidden.png`
- `10-admin-users-list-admin.png`
- `11-admin-users-create-open-admin.png`

The screenshot harness verified no horizontal overflow, no sub-44px visible touch targets, and owner phone visibility for Admin, Manager, uploading Sales, and non-uploading Sales.

## Remaining Limitations

- Email delivery intentionally uses the existing Supabase `send-notification-email` Edge Function. In demo/no-Supabase mode, email is skipped while in-app notifications, audit rows, and analytics events still run.
- Legacy `sold` records remain read-compatible; new UI/status flows use `sold_by_us` and `sold_by_others`.
