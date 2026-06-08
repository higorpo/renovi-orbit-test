---
version: v1
name: Renovi-design-system
description: A premium residential services marketplace anchored on a clean white canvas and Azul Petróleo (#0F2F3A) as the dominant trust color. Cobre (#C57A3A) is reserved as a rare reward accent — premium badges, best proposals, reputation signals — never as a primary CTA fill. Display type runs Manrope (or Plus Jakarta Sans) at 28–48px in weight 600–700; body runs Inter at 400. The signature component is the Service Request Card — the product entry point that puts users inside the flow immediately, not a marketing hero. Pill buttons (`{rounded.pill}`), structured cards at 16px (`{rounded.lg}`), and 12px inputs (`{rounded.md}`) mix Uber operational discipline with Airbnb human trust. Micro-motion only (100–200ms); elevation stays discrete. Real photography of professionals, homes, and completed work — no stock vectors, no generic illustrations.

colors:
  primary: "#0F2F3A"
  primary-hover: "#174554"
  primary-soft: "#EDF4F6"
  accent: "#C57A3A"
  accent-hover: "#B0682B"
  accent-soft: "#F7EFE7"
  success: "#2E7D32"
  warning: "#D97706"
  danger: "#DC2626"
  canvas: "#FFFFFF"
  canvas-soft: "#F8FAFB"
  border: "#E7ECEF"
  ink: "#0F172A"
  body: "#475569"
  mute: "#94A3B8"
  on-primary: "#FFFFFF"
  on-accent: "#FFFFFF"
  scrim: "#000000"

typography:
  display-xl:
    fontFamily: "'Manrope', 'Plus Jakarta Sans', Inter, -apple-system, system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.48px
  display-lg:
    fontFamily: "'Manrope', 'Plus Jakarta Sans', Inter, sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.36px
  display-md:
    fontFamily: "'Manrope', 'Plus Jakarta Sans', Inter, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.28px
  title:
    fontFamily: "'Manrope', 'Plus Jakarta Sans', Inter, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  button-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  button-sm:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: 0
  badge:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: 0.22px
  rating-display:
    fontFamily: "'Manrope', 'Plus Jakarta Sans', Inter, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.48px
  nav-link:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

motion:
  fast: 100ms
  base: 150ms
  slow: 200ms
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"

elevation:
  level-1: "0 2px 8px rgba(0, 0, 0, 0.04)"
  level-2: "0 8px 24px rgba(0, 0, 0, 0.08)"
  level-3: "0 16px 40px rgba(0, 0, 0, 0.12)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 24px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 13px 23px
    height: 48px
    border: "1px solid {colors.border}"
  button-accent-badge:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  service-request-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
    elevation: "{elevation.level-2}"
  provider-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 16px
    elevation: "{elevation.level-1}"
  proposal-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px
    elevation: "{elevation.level-1}"
  proposal-card-highlight:
    backgroundColor: "{colors.accent-soft}"
    borderColor: "{colors.accent}"
    rounded: "{rounded.lg}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 14px 12px
    height: 52px
    border: "1px solid {colors.border}"
  top-nav:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.nav-link}"
    height: 64px
  premium-badge:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  rating-row:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
---

## Overview

Renovi is a **premium residential services marketplace**. The visual language must communicate **trust, quality, simplicity, and transparency** — not compete for attention. The product exists to transform uncertainty into confidence.

The user typically arrives with a problem: a leak, painting job, cleaning, installation, or renovation. The design must reduce anxiety, not add to it.

Renovi does not copy Uber or Airbnb. It combines:

| Influence | Weight | What we take |
|---|---|---|
| **Uber** | 60% | Operational discipline — clean interface, minimal noise, extreme hierarchy clarity, dispatch speed |
| **Airbnb** | 25% | Human trust — real photos, real professionals, real reviews, reputation as the product |
| **Nubank** | 15% | Clarity — simple language, intuitive flows, minimal bureaucracy |

The core emotion is not travel or logistics. It is:

> **"Finalmente alguém vai resolver isso."**

The base canvas is **pure white** (`{colors.canvas}` — #ffffff) with a soft alternate floor (`{colors.canvas-soft}` — #f8fafb) for section bands. **Azul Petróleo** (`{colors.primary}` — #0F2F3A) is the dominant brand color — navbar, primary CTAs, active states, important links. **Cobre** (`{colors.accent}` — #C57A3A) is a **reward color**, used sparingly for premium badges, best proposals, reputation signals, and progress — never as the default CTA fill.

Type splits into two families: **Manrope** (or **Plus Jakarta Sans**) for display and titles, **Inter** for body, captions, and UI chrome. Display headlines run 28–48px at weight 600–700 — heavier than Airbnb's modest Cereal weights because Renovi has less photography at the fold and must establish credibility through type and structure.

The shape language is a **deliberate mix** — unlike Uber (all pill) or Airbnb (all soft-round). Buttons are pill-shaped (`{rounded.pill}`) because they signal action. Cards use 16px radius (`{rounded.lg}`) for stability. Inputs use 12px (`{rounded.md}`) for structure.

**Key Characteristics:**

- **Dual-color hierarchy:** `{colors.primary}` carries every primary CTA, navbar, and active state. `{colors.accent}` appears only on reward moments — premium provider badge, best proposal highlight, ranking progress. Cobre used scarcely — most pages are 90% white + petróleo with one or two copper moments.
- **Signature component:** `{component.service-request-card}` — the Service Request Card. Equivalent to Uber's Request Card and Airbnb's Search Bar. The hero is a product entry, not a marketing site.
- **Three dominant cards:** Service Request Card, Provider Card, Proposal Card — these three components should dominate nearly the entire experience.
- **Real photography only:** professionals, homes, clients, completed work. No stock imagery, no vectors, no illustrated characters.
- **Discrete elevation:** three shadow tiers (`{elevation.level-1}` through `level-3`); hierarchy comes primarily from spacing, not shadow.
- **Micro-motion only:** `{motion.fast}` 100ms · `{motion.base}` 150ms · `{motion.slow}` 200ms. No elastic, no exaggerated transitions.

### What the brand must transmit

When someone opens Renovi they should feel:

1. **Segurança** — trust in who enters their home
2. **Profissionalismo** — credible, not casual
3. **Clareza** — no ambiguity about next steps
4. **Rapidez** — operational efficiency
5. **Qualidade** — premium, not discount

### What the brand must NOT feel like

- Colorful startup
- Promotions app
- Cheap classifieds (OLX / GetNinjas)
- Generic marketplace
- Tourism / lifestyle (Airbnb)
- Pure logistics (Uber)

---

## Positioning

| Platform | Transmits | Renovi does NOT copy |
|---|---|---|
| **Uber** | Speed, movement, efficiency | Pill-everything aesthetic, illustration-led UI |
| **Airbnb** | Warmth, community, experience | Lifestyle photography, Rausch-as-primary pattern |
| **Mercado Livre** | Transaction density | Classifieds visual noise |
| **Nubank** | Simplicity, clarity | Purple brand identity |

**Renovi transmits:** trust · quality · resolution

The problem Renovi solves involves entry into the client's home, payment, trust, and service execution — all requiring significantly more visual credibility than a travel or ride-hailing app.

---

## Colors

### Brand & Primary

- **Azul Petróleo** (`{colors.primary}` — #0F2F3A): The dominant brand color. Used for navbar (`{component.top-nav}`), primary CTAs (`{component.button-primary}`), active navigation states, important inline links, and focus rings. This is the color of trust and operational authority.
- **Primary Hover** (`{colors.primary-hover}` — #174554): The press / pointer-down variant for primary buttons and interactive petróleo surfaces (`{component.button-primary-hover}`).
- **Primary Soft** (`{colors.primary-soft}` — #EDF4F6): A pale petróleo tint for selected row backgrounds, info banners, and subtle highlight bands. Never used as a CTA fill.

### Accent (Reward)

- **Cobre** (`{colors.accent}` — #C57A3A): The reward color. Used **only** for premium provider badges (`{component.premium-badge}`), best-proposal highlights (`{component.proposal-card-highlight}`), ranking indicators, progress milestones, and reputation seals. **Never** used as the default primary CTA background.
- **Accent Hover** (`{colors.accent-hover}` — #B0682B): Darker copper for interactive reward elements on press.
- **Accent Soft** (`{colors.accent-soft}` — #F7EFE7): Warm tint background for highlighted proposal cards and premium provider rows.

#### Cobre usage rules

| Use Cobre for | Do NOT use Cobre for |
|---|---|
| Premium provider seal | Primary "Solicitar orçamento" button |
| Best proposal highlight | Navbar background |
| Ranking / progress indicators | Default link color |
| Reputation badges | Form input focus rings |
| "Destaque" labels | Body text or headings |

### Surface

- **Canvas** (`{colors.canvas}` — #ffffff): The default page floor. Cards, modals, and form surfaces sit on white.
- **Canvas Soft** (`{colors.canvas-soft}` — #f8fafb): Alternate section background for visual separation without heavy borders — used on list pages, settings bands, and empty states.

### Borders

- **Border** (`{colors.border}` — #e7ecef): The default 1px border tone — card outlines, input borders, table separators, secondary button strokes.

### Text

- **Ink** (`{colors.ink}` — #0F172A): Headlines, card titles, primary labels, nav links on light surfaces.
- **Body** (`{colors.body}` — #475569): Running text, descriptions, secondary card meta.
- **Mute** (`{colors.mute}` — #94a3b8): Placeholders, inactive tabs, timestamps, helper text, "Membro desde" labels.
- **On Primary** (`{colors.on-primary}` — #ffffff): White text on petróleo CTAs and navbar.
- **On Accent** (`{colors.on-accent}` — #ffffff): White text on filled copper badges (rare — prefer accent text on accent-soft background).

### Semantic

- **Success** (`{colors.success}` — #2e7d32): Confirmation states, completed service indicators, verified badges.
- **Warning** (`{colors.warning}` — #d97706): Expiring proposals, pending actions, attention-needed banners.
- **Danger** (`{colors.danger}` — #dc2626): Errors, destructive actions, validation failures.

### Scrim

- **Scrim** (`{colors.scrim}` — #000000 at 40–50% opacity): Modal backdrop for dialogs, bottom sheets, and full-screen overlays on mobile.

---

## Typography

### Font Families

| Role | Family | Fallback stack |
|---|---|---|
| **Display / Titles** | Manrope (preferred) or Plus Jakarta Sans | Inter, -apple-system, system-ui, sans-serif |
| **Body / UI** | Inter | -apple-system, system-ui, sans-serif |

Display and body are intentionally split. Inter alone feels too generic for a premium trust brand; a geometric display face (Manrope) adds authority to headlines without the editorial softness of Airbnb Cereal.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 700 | 1.15 | Landing hero headline (desktop) |
| `{typography.display-lg}` | 36px | 700 | 1.20 | Section heroes, empty states |
| `{typography.display-md}` | 28px | 700 | 1.25 | Page titles, modal headers |
| `{typography.title}` | 20px | 600 | 1.30 | Card titles, provider name, proposal summary |
| `{typography.body}` | 16px | 400 | 1.50 | Default running text, form values |
| `{typography.caption}` | 14px | 400 | 1.43 | Card meta, timestamps, "127 serviços" |
| `{typography.rating-display}` | 48px | 700 | 1.10 | Provider profile rating ("4.9") |
| `{typography.button-md}` | 16px | 600 | 1.25 | Primary and secondary CTA labels |
| `{typography.button-sm}` | 14px | 600 | 1.29 | Compact pill buttons, card actions |
| `{typography.badge}` | 11px | 600 | 1.18 | Premium badge, status chips |
| `{typography.nav-link}` | 16px | 600 | 1.25 | Top navigation links |

### Principles

- Display weights are **deliberately strong** (600–700) — Renovi must establish credibility at the fold through type hierarchy, not photography alone.
- Body stays at **400 weight** — clarity over typographic muscle in long-form copy.
- The single loudest typographic moment is the **rating display** (`{typography.rating-display}` — 48px / 700) on provider profiles. Rating numbers are a peak trust signal.
- Language in UI copy should be **simple and direct** (Nubank influence) — avoid jargon, bureaucratic phrasing, or marketing fluff.

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Manrope:wght@600;700&display=swap" rel="stylesheet">
```

If Manrope is unavailable, **Plus Jakarta Sans** is the alternate display face. Inter remains the body fallback throughout.

---

## Shape Language

Renovi uses a **mixed radius system** — intentional differentiation from Uber (all pill) and Airbnb (all soft-round).

| Token | Value | Applied to |
|---|---|---|
| `{rounded.sm}` | 8px | Chips, tags, small badges |
| `{rounded.md}` | 12px | Text inputs, select fields, textareas |
| `{rounded.lg}` | 16px | Cards — Service Request, Provider, Proposal |
| `{rounded.xl}` | 24px | Hero form card, modal containers |
| `{rounded.pill}` | 999px | Buttons, filter pills, status badges |

### Core Rule

| Element | Radius | Rationale |
|---|---|---|
| **Buttons** | `{rounded.pill}` | Signals action and forward motion |
| **Cards** | `{rounded.lg}` (16px) | Signals stability and trust |
| **Inputs** | `{rounded.md}` (12px) | Signals structure and formality |

---

## Layout

### Spacing System

- **Base unit:** 4px (with 2px micro-step).
- **Tokens:** `{spacing.xxs}` 2px · `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.base}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 64px.
- **Card internal padding:** `{spacing.lg}` (24px) for `{component.service-request-card}`; `{spacing.base}` (16px) for `{component.provider-card}`; `{spacing.lg}` (20–24px) for `{component.proposal-card}`.
- **Card gutters:** `{spacing.base}` (16px) between cards in list views; `{spacing.lg}` (24px) in detail layouts.

### Grid & Container

- **Max content width:** ~1200px centered on marketing/landing; ~1080px on in-app flows to maintain focus.
- **Hero layout:** Single-column centered — headline above `{component.service-request-card}`. No side-by-side marketing imagery at desktop; the form card IS the hero.
- **List pages (proposals, providers):** Single-column card stack on mobile; 2-column grid on tablet+ with `{spacing.base}` gutters.
- **Provider profile:** Photo + stats header, then tabbed content (reviews, services, about). Sticky "Contratar" CTA on mobile.

### Whitespace Philosophy

Generous vertical breathing room at section boundaries (`{spacing.section}` — 64px) but **dense card stacks** in marketplace views — proposals and provider lists should feel scannable, not editorial. The contrast reinforces "clear entry, efficient browsing."

---

## Elevation

Three discrete shadow tiers. Hierarchy should come primarily from **spacing and typography**, not layered shadows.

| Level | Token | Shadow | Use |
|---|---|---|---|
| **Flat** | — | none | Body, hero, footer, 90% of surfaces |
| **Level 1** | `{elevation.level-1}` | `0 2px 8px rgba(0,0,0,.04)` | Provider cards at rest, list items |
| **Level 2** | `{elevation.level-2}` | `0 8px 24px rgba(0,0,0,.08)` | Service Request Card (hero), floating action bars |
| **Level 3** | `{elevation.level-3}` | `0 16px 40px rgba(0,0,0,.12)` | Modals, bottom sheets, dropdown menus |

- **Card hover:** Elevate from level-1 to level-2 on pointer hover — subtle lift, no scale transform.
- **Modal scrim:** `{colors.scrim}` at 40–50% opacity.

---

## Motion

Micro-animations only. No elastic easing, no exaggerated bounce, no parallax.

| Token | Duration | Use |
|---|---|---|
| `{motion.fast}` | 100ms | Button press, toggle, checkbox |
| `{motion.base}` | 150ms | Card hover elevation, tab switch |
| `{motion.slow}` | 200ms | Modal enter/exit, bottom sheet slide |
| `{motion.easing}` | `cubic-bezier(0.4, 0, 0.2, 1)` | All transitions |

Principles:

- Transitions communicate **state change**, not decoration.
- Page transitions use simple fade or slide-up (mobile bottom sheets).
- Loading states use skeleton screens with subtle pulse — no spinners on full-page loads.

---

## Components

### Buttons

**`button-primary`** — Petróleo fill, white text, pill shape, 14×24px padding, 48px height, weight 600. The dominant CTA: "Solicitar orçamento", "Continuar", "Enviar proposta".

**`button-primary-hover`** — Background flips to `{colors.primary-hover}`. No transform, no shadow change.

**`button-secondary`** — White fill, ink text, 1px `{colors.border}` outline, pill shape. Used for "Ver perfil", "Cancelar", inverse CTAs.

**`button-accent-badge`** — Accent-soft fill, accent text, pill shape. Used for reward-labeled actions ("Melhor proposta") — not a primary flow CTA.

### Signature: Service Request Card

**`service-request-card`** — The most important component in the system. Equivalent to Uber's Request Card and Airbnb's Search Bar.

Structure:

```text
[headline]
Resolva qualquer serviço residencial
com profissionais verificados.

[service-request-card]
  O que você precisa?
  [Categoria]
  [Descrição]
  [ Solicitar orçamento ]
```

White surface, `{rounded.lg}` (16px) or `{rounded.xl}` (24px) on hero placement, `{elevation.level-2}`, 24px padding. Contains category selector, description field, and full-width `{component.button-primary}`.

The hero should feel like a **product**, not a marketing site — the user starts inside the flow immediately.

### Provider Card

**`provider-card`** — The primary trust element. Photo-first layout:

```text
[Foto]

Nome
★★★★★ 4.9
127 serviços
Membro desde 2024

[ Ver perfil ]
```

White surface, `{rounded.lg}`, `{elevation.level-1}`, 16px padding. Avatar is circular. Rating in ink (not gold/yellow — gold stars feel cheap). Meta lines in `{typography.caption}` muted. `{component.premium-badge}` (cobre) appears only on verified premium providers.

### Proposal Card

**`proposal-card`** — Standard proposal row in comparison views. White surface, `{rounded.lg}`, `{elevation.level-1}`, 20px padding. Shows provider mini-card, price, timeline, and action buttons.

**`proposal-card-highlight`** — Best proposal variant. `{colors.accent-soft}` background, 1px `{colors.accent}` border. The **only** place a full copper border appears in the card system. Used for "Melhor proposta" or client-recommended option.

### Forms

**`text-input`** — White surface, 1px `{colors.border}` outline, `{rounded.md}` (12px), 52px height, 14×12px padding. Stacked label above in `{typography.caption}` muted. On focus: 2px `{colors.primary}` border — no glow ring.

### Navigation

**`top-nav`** — Petróleo surface (`{colors.primary}`), 64px height, white text and logo. Compact compared to Airbnb's 80px white nav — Renovi's nav IS the brand color moment.

### Badges

**`premium-badge`** — Accent-soft fill, accent text, pill shape, 11px / 600. "Premium", "Verificado", "Destaque". The copper reward moment on provider cards.

---

## Photography

Renovi photography is the **opposite of Uber's illustration approach** and **different from Airbnb's destination aesthetic**.

| Use | Do NOT use |
|---|---|
| Real professionals at work | Stock photo models |
| Real homes and completed jobs | Generic lifestyle imagery |
| Real clients (with consent) | Illustrated characters or vectors |
| Before/after service results | 3D renders or AI-generated faces |

Photography supports trust — it is never decorative. Every photo should answer: "Can I trust this person in my home?"

---

## Hero

The Renovi hero is a **product entry point**, not a marketing landing page.

```text
[headline — display-md or display-lg]
Resolva qualquer serviço residencial
com profissionais verificados.

[service-request-card]
  O que você precisa?
  [Categoria ▾]
  [Descreva o serviço...        ]
  [ Solicitar orçamento          ]
```

- No background video, no illustration, no feature grid above the fold.
- Optional: a subtle `{colors.canvas-soft}` band behind the card for depth.
- On mobile: card goes full-width with `{spacing.base}` horizontal padding; CTA sticky at bottom if multi-step.

---

## Card System Overview

Three cards dominate the experience:

| Card | Role | Priority |
|---|---|---|
| **Service Request Card** | Entry point — starts the flow | Highest — signature component |
| **Provider Card** | Trust signal — who will do the work | High — repeated in search, proposals, profile |
| **Proposal Card** | Transaction unit — price, timeline, action | High — repeated in comparison and chat |

All other UI elements (nav, forms, badges) exist in service of these three.

---

## Design Principles

### 1. Trust Before Beauty

Every element must increase trust. If a design choice is beautiful but reduces clarity or credibility, choose clarity.

### 2. The Service Is The Product

The focus is not the platform — it is the service being performed. UI should foreground the professional, the proposal, and the outcome.

### 3. Real People, Real Work

Real photos. Real reviews. Real results. No fabricated social proof, no generic avatars in production surfaces.

### 4. One Primary Action

Each screen has exactly one dominant action. Secondary actions are visually subordinate (outline buttons, text links).

### 5. Clarity Beats Creativity

When in doubt between something beautiful and something clear, choose the clear option.

---

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| **Mobile** | < 744px | Top nav compact (logo + menu); Service Request Card full-width; provider/proposal cards stack 1-up; sticky bottom CTA bar on detail pages; bottom sheets for filters and category picker |
| **Tablet** | 744–1128px | Top nav with primary links; cards 2-up in list views; Service Request Card centered at ~480px max-width |
| **Desktop** | 1128–1440px | Full nav; hero headline + Service Request Card centered; provider/proposal cards 2-up; detail pages 2-column (content + sticky action rail) |
| **Wide** | > 1440px | Content caps at 1200px; gutters absorb excess space |

### Touch Targets

- Primary CTAs: minimum 48×48px (WCAG AAA).
- Provider card tap area: full card is tappable, not just the "Ver perfil" button.
- Filter pills: minimum 44px height with `{spacing.md}` horizontal padding.

### Mobile-First Notes

- Dialogs and multi-step flows use full-screen sheets on mobile (`100dvh`, safe-area padding).
- Action footers sit above the virtual keyboard.
- Scroll containers use `overscroll-y-contain` and `touch-pan-y`.

---

## CSS Token Mapping

Current implementation in `src/index.css` maps to this system:

| DESIGN.md token | CSS variable | Notes |
|---|---|---|
| `{colors.primary}` | `--primary` (196 60% 15%) | Azul Petróleo #0F2F3A |
| `{colors.accent}` | `--secondary`, `--accent`, `--copper` | Cobre #C57A3A — migrate accent usage to reward-only contexts |
| `{colors.border}` | `--border` | #E7ECEF equivalent |
| `{rounded.lg}` | `--radius` (0.75rem = 12px) | **Gap:** current `--radius` is 12px; cards should use 16px (`--radius-lg`) |
| Display font | h1–h6 currently Inter | **Gap:** migrate headings to Manrope |

---

## Known Gaps

- **Display font not yet loaded:** `src/index.css` uses Inter for all headings; Manrope / Plus Jakarta Sans pending integration.
- **Accent overuse:** Cobre currently maps to `--secondary` and `--accent` broadly; audit needed to restrict copper to reward contexts only.
- **Card radius mismatch:** Tailwind `--radius` is 12px; design spec calls for 16px on cards.
- **Dark mode:** Tokens exist in `index.css` but the public product is light-mode-first; dark mode is not a v2 priority.
- **Hover state colors:** Documented at component level; precise `:hover` extraction pending design QA pass.
- **Skeleton / loading states:** Not yet standardized across all card types.
- **Photography guidelines:** Production asset pipeline (consent, compression, aspect ratios) not yet documented.

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v2 | 2026-06-08 | Initial Renovi design system — petróleo-dominant, copper-as-reward, Service Request Card as signature component, mixed shape language, real-photography mandate |
