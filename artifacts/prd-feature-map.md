# Leadra PRD Implementation Feature Map

Source PRD: `F:\ZIAD\iCloudDrive\Work\Side Projects\Leadra\Leadra_Full_PRD_Final_Purple_Stakeholder_Updates.docx`

Generated from the extracted PRD text in `artifacts/leadra_prd_extracted.txt` and the current repo at `E:\GitHub\leadra`.

Status rule: `Implemented` means the current UI/domain/persistence behavior appears to satisfy the PRD requirement end to end. Anything partial, demo-only, contradicted, or missing required sub-behavior is marked `Not implemented`.

## Executive Summary

The current system implements a usable MVP: login, role shells, unit creation, destination/project browsing, basic unit details, in-app notifications, audit rows, analytics, Supabase tables/RLS/functions, admin user management, admin password reset, owner-phone normalization, same-project duplicate blocking, image upload in the UI, and PDF generation/share/download.

The PRD is not fully implemented. The biggest open gaps are role visibility/privacy rules, edit-unit workflows, fixed 12 unit types and conditional fields, payment timetable/remaining-value rules, Sold by Us vs Sold by Others, master-data management UI, PDF completeness, media/PDF controls, email notification integration, and several audit/notification event types.

## Feature Map

| PRD feature area | Status | Evidence / gap |
|---|---:|---|
| Four roles: Admin, Sub Admin, Manager, Sales Representative | Implemented | `UserRole` exists in `src/lib/types.ts`; UI exposes all roles in admin user forms. |
| Admin/Sub Admin same access level | Implemented | Admin page access and workflow checks use `admin` or `sub_admin`. |
| All roles can view all units | Implemented | Client permissions now allow every role to view every unit; Supabase migration `0012_all_roles_unit_visibility.sql` updates the select policy and `list_units_safe` RPC while preserving owner-data masking. |
| Owner phone visible only to Admin/Sub Admin/uploading Sales Rep | Not implemented | Managers can view owner data for team units in client and safe RPC logic. |
| Owner phone search only for Admin/Sub Admin | Not implemented | `canSearchOwnerPhone` delegates to owner-data visibility, so managers and uploading sales users can search in cases the PRD forbids. |
| Uploader name visible globally on cards/details | Not implemented | `createdByName` exists, but unit cards show project/type/owner phone; details do not include an uploader row. |
| No self-service password editing | Implemented | Profile page is read-only and has no password editor. |
| Admin/Sub Admin reset/edit user passwords | Implemented | Admin UI has set-password form and Supabase edge function `admin-update-user-password`. |
| Admin/Sub Admin user creation/edit/deactivation | Implemented | Admin UI and edge functions support user creation/profile updates; local workflows deactivate users. |
| Sales representative deletion/deactivation requires reassignment | Not implemented | Reassignment exists, but prior assignment history is only in audit metadata; no durable per-unit ownership-history model. UI still labels the action as delete, not deactivate. |
| Inactive users remain visible in audit history | Implemented | Users are marked inactive/deletedAt locally and audit rows store actor name/role. |
| Branches do not restrict unit visibility | Implemented | Client unit permissions, safe unit RPCs, manager analytics, and analytics RPCs no longer scope visibility by team or branch; team/branch remain metadata for filtering and reporting. |
| Users cannot self-register | Implemented | App exposes sign-in only; README instructs disabling public signup; seed/admin functions support admin-created accounts. |
| Multiple active sessions allowed | Implemented | No app-level single-session enforcement was found; Supabase default multi-session behavior is used. |
| Main pages: login/dashboard/units/create/details/notifications/profile | Implemented | `View` union and app navigation include these screens. |
| Extra admin pages: admin dashboard/user management/audit log | Implemented | Admin shell includes Users, Settings, Metrics, Audit. |
| Extra admin pages: unit management/master data management | Not implemented | No UI to create/edit/archive Developer, Destination, Project, View, Finish, Teams, Branches, media limit, logo, or PDF layout. |
| Sales dashboard PRD details | Not implemented | Dashboard exists, but latest units are visible units, not specifically logged-in sales user uploads; no sales 72-hour upload warning. |
| Manager dashboard PRD details | Implemented | Manager dashboard shows team uploads, team activity, status changes, installment updates, inactivity alerts, and quick actions. |
| Admin/Sub Admin dashboard PRD details | Not implemented | Admin uses generic dashboard plus analytics/admin panels; PRD-specific dashboard sorting by teams/developers/destinations/projects is incomplete. |
| Any user can create a unit | Implemented | Create Unit is available to all non-admin-restricted views; RLS permits active users to insert units. |
| Unit archive only Admin/Sub Admin | Not implemented | `canArchiveUnit` and RLS allow managers to archive team units. |
| Archive instead of permanent unit delete | Implemented | Units use `archived`; no normal UI hard-delete path found. |
| Create Unit field order Destination before Developer | Not implemented | UI order is Developer, Project, BUA, Destination. |
| Required field star/asterisk across forms | Not implemented | Required inputs exist, but labels do not consistently show `*`. |
| Destination retained in creation/details/filters/PDF | Not implemented | Present in create/details/filters/PDF text, but order is wrong and PDF is otherwise incomplete. |
| Destination not used in unit code | Not implemented | Client and DB generate unit code from destination label and include unit id/bathroom count. |
| Fixed 12 unit types | Not implemented | Create UI offers only Apartment, Villa, Townhouse; seed lookup has Apartment/Villa only. |
| Unit-type conditional fields | Not implemented | Floor, land area, furnished, finish, etc. are broadly shown; no 12-type conditional logic. |
| Floor supports Ground and 1-40 only where applicable | Not implemented | Floor options include Ground, 1-40, and Roof; not tied to selected unit type. |
| Penthouse wording and Penthouse unit behavior | Not implemented | Penthouse is absent from unit-type options and data model has no terrace-area field. |
| Unit code formula Project Abbreviation + Bedrooms + BR | Not implemented | Current formula is destination-derived + id + BR + bedrooms + bathrooms. |
| One payment method per unit | Implemented | `PaymentMethod` is cash/installment and DB has `one_payment_method` constraint. |
| Basic total/down-payment/remaining/commission/installment math | Implemented | Domain and DB calculate remaining, commission, and installment amount for numeric installment years. |
| Payment Method shown in details but excluded from PDF | Not implemented | PDF text/blob include payment method. |
| Transfer fees | Not implemented | No type/schema/UI/PDF field found. |
| Maintenance paid/cost/due-date fields | Not implemented | No type/schema/UI fields found. |
| Custom installment text entered by user and shown in PDF | Not implemented | Custom mode exists, but no custom text input/storage/PDF field; PDF uses generic message. |
| Installment From/To month-year selectors | Not implemented | UI/schema use numeric `installmentYears`. |
| Payment timetable that marks installments paid/unpaid | Not implemented | Schedule is display-only; no payment history, mark-paid action, or remaining-value recalculation from timetable. |
| Remaining Value locked except timetable changes | Not implemented | No edit workflow exists, and DB trigger recalculates remaining on any unit update from total/down payment. |
| Installment amount range filtering | Implemented | Client and Supabase safe search include installment amount range filters. |
| Owner country code/global phone normalization | Implemented | Client supports multiple country codes and normalizes; DB has `normalize_owner_phone`. |
| Duplicate block only same project normalized phone | Implemented | Client workflow and DB unique index enforce project + normalized phone; cross-project is allowed. |
| Delivery Date year-only and future years | Implemented | Create form stores delivery year only and supports 2026-2035. |
| Media limit 10 files / 40 MB total with clear errors | Implemented | Client validation enforces file count/total bytes and shows errors. |
| Videos rejected everywhere | Not implemented | UI file input accepts images only, but types/schema/seed still support video, gallery has video placeholder, analytics counts videos. |
| Permitted PDF attachments with at least one photo | Not implemented | Upload UI accepts images only; no PDF attachment support or related-photo rule. |
| Image Show in PDF / Hide from PDF controls | Not implemented | No per-image include/exclude state or UI found. |
| Download uploaded photos | Not implemented | Gallery displays media but no download action found. |
| Remove uploaded images one-by-one while editing | Not implemented | Removal exists only before create submission; no edit-unit media workflow. |
| Sales notes | Not implemented | Sales notes are created and shown, but no post-create edit workflow exists. |
| Admin/manager notes with metadata | Implemented | Admin/Sub Admin/Manager can add/update/delete a shared note with creator, role, timestamp. |
| Sales notified when admin/manager comments on own unit | Implemented | Note workflow creates in-app notification targeted to unit creator. |
| Status: Available, Hold, Sold by Us, Sold by Others | Implemented | Unit status supports Available, Hold, Sold by Us, and Sold by Others; legacy `sold` values still render as sold for old data. |
| Status visible in cards/details/filters/audit/PDF | Not implemented | Status is visible in app/audit, but not split into Sold by Us/Others and not clearly included in PDF. |
| View All Units project/location-first cards | Implemented | Units page shows destination cards, then project cards, then units. |
| Selected location/project opens separate page | Not implemented | Selection filters within the same `#units` view; no separate location/project route. |
| Searchable/typeahead dropdowns throughout | Not implemented | Custom select components are button/listbox controls, not text-searchable inputs. |
| Filters listed in PRD | Not implemented | Many filters exist, but land area, terrace area, garden area, split sold statuses, and strict owner-phone permissions are missing. |
| Unit Details route `/#details/:unitId` | Implemented | Hash detail route exists. |
| Unit Details edit action for allowed users | Not implemented | No visible edit-unit action or edit page/workflow found. |
| Unit Details compact mobile-first redesign | Not implemented | Details page exists, but section order and several required conditional-display rules do not match PRD. |
| Unit Details Destination before Developer | Not implemented | Main info shows Developer, Project, then Destination. |
| Unit Details Delivery before Commission | Not implemented | Commission is inside Pricing before Delivery. |
| Unit Details Furnished only when selected | Not implemented | Details always shows furnished/unfurnished. |
| Unit Details conditional fields only when applicable | Not implemented | Floor, land area, roof/garden area, furnished, etc. are shown even when not applicable. |
| Internal unit share link respects permissions | Implemented | Share link copies hash details route; detail selection uses visible/sanitized unit data. |
| PDF generation/share/download fallback | Implemented | Client generates PDF, uses Web Share where available, and downloads when sharing is unavailable. |
| PDF branded with Leadra logo | Not implemented | PDF uses company name; no logo embedding/config UI found. |
| PDF required content and ordering | Not implemented | Missing developer, down payment, remaining value, transfer fees, custom text, conditional area rules; includes payment method despite PRD exclusion. |
| PDF selected-image inclusion/exclusion | Not implemented | PDF includes all image media; no Show/Hide PDF controls. |
| PDF audit/admin notification | Implemented | App records audit and admin notification when generating/sharing PDF. |
| Admin-configurable PDF logo/name/footer/contact/layout | Not implemented | Settings model includes name/footer/contact/logo path, but UI only edits commission percentage. |
| Audit log baseline | Implemented | Audit rows are created for user, unit creation, archive/status, notes, PDF, settings/password flows. |
| Full audit event coverage from PRD | Not implemented | Missing login/session revocation, edit-unit/payment timetable, image show/hide/download/remove, master-data changes, and several payment/maintenance events. |
| In-app notifications | Implemented | Notification center and workflow-created in-app notifications exist. |
| Email notifications | Not implemented | Edge function exists, but no invocation/integration from app workflows found. |
| 72-hour inactivity notifications | Not implemented | Manager/Admin dashboards display stale users; no notification-sending workflow found. |
| Profile account display | Implemented | Profile shows name, email, phone, role, team, branch, status. |
| Profile self-edit restrictions | Implemented | Profile page does not allow direct edits to password/role/team/branch/email. |
| Profile phone edit if allowed by Admin/Sub Admin | Not implemented | No profile edit workflow found. |
| Mobile-first UI priority | Implemented | CSS/app structure is mobile-first oriented with touch-friendly cards/buttons, though detailed visual QA was not part of this pass. |

## Highest-Priority Gaps

1. Fix role/permission contradictions: all-role unit visibility, manager owner-phone restrictions, owner-phone search limited to Admin/Sub Admin, manager archive prohibition.
2. Add edit-unit workflow with PRD-scoped permissions, including total/pricing edit rules and owner-field restrictions.
3. Replace unit type/status models: 12 fixed unit types, conditional fields, Penthouse/terrace handling, and `sold_by_us`/`sold_by_others`.
4. Rework payment model: From/To month-year period, payment timetable, paid/unpaid history, remaining-value recalculation only from timetable, custom installment text.
5. Rebuild PDF/media feature set: video ban at schema/type/seed level, PDF attachments if required, image Show/Hide in PDF, required PDF content/order, logo/config UI, payment-method exclusion.
6. Add Admin/Sub Admin master-data management for destinations, developers, projects, views, finishing, teams, branches, PDF/company settings, and media limits.
7. Integrate email notifications and complete audit coverage for the PRD event list.
