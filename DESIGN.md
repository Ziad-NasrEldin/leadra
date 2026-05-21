---
name: Leadra
desc: Mobile-first internal real estate resale management interface.
colors:
  brand-ivory: "#f6f1ea"
  brand-linen: "#efe7dd"
  brand-copper: "#a76f4d"
  brand-copper-soft: "#d8c0ad"
  brand-warm-copper: "#7f4a35"
  brand-charcoal: "#2a2623"
  brand-graphite: "#1f1f23"
  brand-taupe: "#7d7468"
  brand-black: "#0d0d0f"
  brand-slate: "#1f1f23"
  on-dark: "#fffaf0"
  danger: "#9e3c31"
  sold-wash: "#ead0ca"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(3rem, 6.2vw, 6.7rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 800
    lineHeight: 1.2
rounded:
  xs: "0.65rem"
  sm: "0.8rem"
  md: "0.9rem"
  lg: "1rem"
  xl: "1.2rem"
  panel: "1.4rem"
  login: "2.35rem"
  pill: "999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-black}"
    textColor: "{colors.on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.62rem 0.95rem"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.brand-ivory}"
    textColor: "{colors.brand-charcoal}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.62rem 0.95rem"
    height: "46px"
  input-field:
    backgroundColor: "{colors.brand-ivory}"
    textColor: "{colors.brand-charcoal}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.82rem"
    height: "52px"
  content-card:
    backgroundColor: "{colors.brand-ivory}"
    textColor: "{colors.brand-charcoal}"
    rounded: "{rounded.panel}"
    padding: "{spacing.4}"
  status-pill:
    backgroundColor: "{colors.brand-linen}"
    textColor: "{colors.brand-graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.65rem"
---

# Design System: Leadra

## 1. Overview

**Creative North Star: "The Quiet Resale Ledger"**

Leadra is an operational tool for real estate resale teams, so the interface should feel like a calm private office: dense enough for repeated daily work, warm enough to avoid sterile admin software, and restrained enough to keep inventory, permissions, prices, and owner data in focus. The visual system is scanned from the current app, primarily `src/index.css`, `src/components/LeadraUi.tsx`, and the README project brief.

The register is product, not marketing. Design serves task confidence: role-aware dashboards, project-first browsing, create-unit flows, details pages, notifications, profile settings, and admin panels. Keep the mobile-first posture visible in every new screen, then scale up to the desktop side rail and wider analytical layouts.

This system rejects generic SaaS blue, neon dashboards, decorative glassmorphism, and card piles that make internal tools feel artificially inflated. Surfaces can be warm and premium, but they must stay efficient, legible, and permission-conscious.

**Key Characteristics:**

- Warm ivory paper surfaces with charcoal ink and muted taupe supporting text.
- Black or deep slate anchors for primary action, login hero, and desktop rail.
- Copper as a rare operational accent, not a decorative wash.
- Serif headings only where hierarchy needs a strong identity cue.
- Pill controls, soft cards, tactile selects, and compact mobile stacks.
- Motion is short, directional, and reduced-motion aware.

## 2. Colors

The palette is a warm ledger palette: ivory paper, charcoal ink, deep graphite-black structure, and restrained copper accents.

### Primary

- **Muted Copper** (`brand-copper`): The primary accent. Use for eyebrows, icon tint, focus outlines, active borders, selected filters, and low-volume highlights.
- **Boardroom Black** (`brand-black`): The primary action and dark anchor. Use for primary buttons, dark login surfaces, avatar initials, and high-contrast structural moments.
- **Slate Rail** (`brand-slate`): The companion dark surface for gradients and navigation rail depth.

### Secondary

- **Graphite** (`brand-graphite`): The serious operational accent. Use for inventory marks, availability meters, dark hero blends, and selected state contrast.
- **Soft Copper** (`brand-copper-soft`): Use only on dark surfaces where `brand-copper` needs a lighter companion.
- **Warm Copper** (`brand-warm-copper`): Use sparingly for dark-theme accent depth and copper gradient endpoints.

### Neutral

- **Ivory Paper** (`brand-ivory`): The base app background and primary light surface.
- **Linen Wash** (`brand-linen`): The soft supporting surface for chips, low-contrast fills, and selected state fields.
- **Charcoal Ink** (`brand-charcoal`): The default text color in light mode.
- **Muted Taupe** (`brand-taupe`): Secondary text, labels, hints, and subdued metadata.
- **Warm On-Dark** (`on-dark`): Text on black, slate, and graphite surfaces. Do not use pure white.
- **Danger Red** (`danger`): Destructive actions and permission-critical warnings.
- **Sold Wash** (`sold-wash`): Sold status background only.

### Named Rules

**The Copper Rarity Rule.** Copper should mark state, focus, selection, or brand identity. If more than roughly 10 percent of a working screen is copper, the interface is becoming ornamental.

**The Warm Neutral Rule.** Do not introduce plain white, pure black, or cold gray as default UI colors. Every neutral should remain connected to ivory, linen, charcoal, taupe, or slate.

**The Status Separation Rule.** Availability, hold, sold, destructive, and permission states must remain visually distinct. Never reuse danger red for a neutral warning or sold wash for an error.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif fallback)

**Body Font:** Manrope (with sans-serif fallback)

**Label/Mono Font:** Manrope

**Character:** Fraunces gives Leadra its premium resale identity in top-level headings. Manrope carries the operational workload: labels, forms, rows, metrics, filters, buttons, and metadata.

- **Display** (700, `clamp(3rem, 6.2vw, 6.7rem)`, `0.9`): Login and rare brand-scale hero headings only.
- **Headline** (700, `clamp(2rem, 5vw, 4.5rem)`, `0.98`): Page titles and major dashboard headings.
- **Title** (700, `1.35rem`, `1.02`): Section headings, detail panels, compact hero titles, and card-level hierarchy.
- **Body** (400, `1rem`, `1.5`): Main reading text. Keep paragraph line length around 65 to 75 characters when the layout permits.
- **Label** (800, `0.82rem`, `1.2`): Form labels, control labels, and dense interface copy.
- **Eyebrow** (900, `0.72rem`, `0.14em`, uppercase): Reserved for high-signal category markers and role labels.

### Named Rules

**The Serif Reserve Rule.** Use Fraunces for h1 and h2-level identity only. Dense tools, rows, buttons, labels, filters, and data stay in Manrope.

**The Dense Label Rule.** Operational labels are small but heavy. Prefer weight and color contrast over extra size.

## 4. Elevation

Leadra uses a hybrid of tonal layering and soft structural shadows. Cards are not floating decorations; shadows separate touchable or grouped work surfaces from the ivory paper. Dark-mode shadows become deeper, but still diffuse.

### Shadow Vocabulary

- **Soft Surface** (`--shadow-soft: 0 18px 45px rgba(42, 38, 35, 0.08)`): Default card, metric, hero, and details panel shadow in light mode.
- **Strong Surface** (`--shadow-strong: 0 30px 90px rgba(42, 38, 35, 0.16)`): Login shell and high-emphasis panels.
- **Hover Lift** (`0 20px 55px color-mix(in oklch, var(--ink), transparent 88%)`): Interactive cards and rows on hover.
- **Field Focus** (`0 0 0 4px rgba(167, 111, 77, 0.12), 0 12px 30px rgba(13, 13, 15, 0.08)`): Inputs and select triggers on focus.
- **Portal Menu** (`0 24px 44px color-mix(in oklch, var(--ink), transparent 84%)`): Branded select menus and elevated popovers.

### Named Rules

**The State Creates Lift Rule.** Resting surfaces use soft depth. Stronger shadows appear because the user hovered, focused, opened, or selected something.

**The No Heavy Drop Rule.** Avoid hard black shadows. If a shadow reads as a dark outline, it is too heavy for this product.

## 5. Components

### Buttons

Buttons are pill-shaped, high-weight, and compact enough for mobile toolbars.

- **Shape:** Full pill corners (`999px`) with a minimum height of `46px`.
- **Primary:** Boardroom black to slate gradient with warm on-dark text, copper-tinted border, `0.62rem 0.95rem` padding.
- **Secondary / Ghost:** Panel surface background with charcoal text and the same pill shell.
- **Danger:** Danger red fill with warm on-dark text.
- **Hover / Focus:** Hover lifts by `translateY(-2px) scale(1.01)` with a soft shadow. Focus uses a copper outline with `3px` offset.

### Fields and Branded Selects

Fields should feel tactile and stable, especially on mobile.

- **Style:** `52px` minimum height, `0.9rem` radius, `1px` warm line border, panel background, `0.82rem` padding.
- **Focus:** Copper border, stronger panel background, `4px` copper focus ring, and a `-1px` lift.
- **Select Trigger:** Gradient from panel-strong to surface-soft, heavier text, inset top highlight, and a small copper chevron.
- **Select Menu:** Fixed portal, `1.05rem` radius, warm blurred panel, `210ms` entrance, searchable options, and active rows with a copper/linen tint.
- **Owner Phone Field:** Country selector and phone input share one grouped shell; preserve the single control shape on desktop and stack cleanly below `640px`.

### Cards and Panels

Cards group related operational work. They must not become decorative containers for every section.

- **Corner Style:** Main cards use `1.4rem`; mobile cards reduce toward `1.2rem`; compact rows use `1rem` to `1.2rem`.
- **Background:** Panel and panel-strong surfaces over ivory paper, with linen or accent-surface fills for lower-emphasis content.
- **Shadow Strategy:** Use Soft Surface at rest. Use Hover Lift for interactive role, project, and unit cards.
- **Border:** Always keep a `1px` warm line border unless the component is intentionally dark.
- **Internal Padding:** Default card padding is `1rem`; compact mobile cards can reduce to `0.85rem`.

### Navigation

Desktop navigation is a dark side rail; mobile navigation moves to bottom controls and compact topbar actions.

- **Desktop Rail:** `96px` wide, sticky, dark black-to-slate gradient, ivory/copper icon states, `1.05rem` nav-button radius.
- **Nav Button:** `64px` minimum height, icon over text, muted on-dark text at rest, copper-tinted active/hover background.
- **Mobile:** Hide the side rail below `860px`; preserve safe-area bottom padding and use compact icon-first controls.

### Rows, Chips, and Status

Rows are the core scan pattern for units, notifications, users, and analytics.

- **Unit Row:** `1.2rem` radius, warm panel background, `74px` thumb, compact metadata, and hover lift for openable rows.
- **Status Pill:** Pill shell, `0.35rem 0.65rem` padding, 900 weight, and status-specific fill.
- **Analytics Chip:** `32px` minimum height, copper-tinted border, accent-surface fill, 900 weight, no wrapping.
- **Empty State:** Dashed copper-tinted border, `1rem` radius, accent-surface fill, and concise body copy.

### Motion

Motion should make state changes easier to follow, not make the interface theatrical.

- **Feedback:** `150ms` for immediate control feedback.
- **State:** `220ms` for toggles and color shifts.
- **Layout:** `320ms` for page and component settling.
- **Entrance:** `520ms` for staged content.
- **Hero:** `680ms` for rare login or hero entry.
- **Easing:** Use `cubic-bezier(0.16, 1, 0.3, 1)` or `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Reduced Motion:** Respect the existing reduced-motion block by disabling transitions and animations.

## 6. Do's and Don'ts

- **Do** keep Leadra mobile-first. At `860px` and below, collapse the shell, hide the side rail, tighten title scale, and keep touch targets around `44px` to `48px`.
- **Do** use the existing root CSS variables before adding new visual tokens.
- **Do** use copper for focus, selected state, icon tint, and small identifiers.
- **Do** preserve role-aware density: dashboards, filters, and details pages should be scannable without marketing-style hero padding.
- **Do** keep text legible in English and Arabic. Respect `dir="rtl"` patterns already present in the CSS.
- **Do** use Lucide icons inside controls when an icon clarifies an action.
- **Don't** use pure `#000` or `#fff` for new UI surfaces or text. Use `brand-black`, `brand-slate`, or `on-dark`.
- **Don't** use gradient text, glassmorphism as decoration, oversized SaaS metric heroes, or repeated icon-card grids.
- **Don't** add colored side-stripe borders wider than `1px`; use full borders, background tints, icons, or status pills.
- **Don't** nest cards inside cards. Use rows, lists, or unframed spacing inside an existing panel.
- **Don't** flood screens with copper, graphite, or beige variations. The palette works because black, ivory, taupe, graphite, and copper have separate jobs.
- **Don't** animate layout properties. Animate opacity, transform, color, border, and shadow only.
- **Don't** hide permission-sensitive state in color alone. Owner data visibility, destructive actions, archive/delete states, and role permissions need text labels.
