---
version: v3.7
name: Prestway-design-system
description: Trust infrastructure for residential services. Primary is universal black (#000000). Brand blue (#2563EB) and brand orange (#F97316) are fixed tokens; audience-* is role-aware (client blue / provider orange via html[data-audience]) for punctual use. Display type Manrope (Bold/ExtraBold); body Inter. Signature component is the Service Request Card. Aesthetic peers Airbnb, Stripe, Notion, Linear, Shopify — never construction, banking, or generic service marketplaces. Micro-motion only (100–200ms). Abstract brand symbol; real photography of people and outcomes — no tool icons, no houses, no hard hats.
brand: BRAND.md

colors:
  primary: "#000000"
  primary-hover: "#2E2E2E"
  primary-dark: "#000000"
  primary-light: "#595959"
  primary-soft: "#F5F5F5"
  brand-blue: "#2563EB"
  brand-blue-hover: "#1E3A8A"
  brand-blue-soft: "#EFF6FF"
  brand-orange: "#F97316"
  brand-orange-hover: "#C2410C"
  brand-orange-soft: "#FFF7ED"
  audience-client: "#2563EB"
  audience-provider: "#F97316"
  accent: "#F97316"
  accent-hover: "#C2410C"
  accent-light: "#FDBA74"
  accent-soft: "#FFF7ED"
  success: "#16A34A"
  warning: "#F59E0B"
  danger: "#DC2626"
  info: "#0EA5E9"
  canvas: "#FFFFFF"
  canvas-soft: "#F9FAFB"
  border: "#E5E7EB"
  ink: "#111827"
  body: "#6B7280"
  mute: "#9CA3AF"
  on-primary: "#FFFFFF"
  on-accent: "#FFFFFF"
  scrim: "#000000"

typography:
  display-xl:
    fontFamily: "'Manrope', Inter, -apple-system, system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.48px
  display-lg:
    fontFamily: "'Manrope', Inter, sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.36px
  display-md:
    fontFamily: "'Manrope', Inter, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.28px
  title:
    fontFamily: "'Manrope', Inter, sans-serif"
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
    fontFamily: "'Manrope', Inter, sans-serif"
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
    audience: client
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    audience: client
  button-primary-provider:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 24px
    height: 48px
    audience: provider
  button-primary-provider-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    audience: provider
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
    audience: provider
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
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 64px
    borderBottom: "1px solid {colors.border}"
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

Prestway is a **trust infrastructure for residential services** — a technology platform that connects clients and professionals in a secure, transparent, and professional environment. It is **not** a construction company, real-estate brand, bank, or insurer. Full brand strategy lives in [`BRAND.md`](./BRAND.md).

The visual language must communicate **confiança + humanidade + tecnologia + crescimento**. The product exists to turn informal, anxious hiring into a predictable, protected experience.

The user typically arrives with a problem and uncertainty: who to trust, how to pay, what happens next. Design must deliver:

> **"Estou protegido. Posso confiar. Estou no controle."**

### Audience color split (mandatory)

| Audience | Palette | Use for |
|---|---|---|
| **Cliente** | **Azul Prestway** (`brand-blue` / `audience` — #2563EB) | Pontual ou via `audience-*` |
| **Prestador** | **Laranja** (`brand-orange` / `audience` — #F97316) | Pontual ou via `audience-*` |

Switched automatically by `html[data-audience]` — no separate color token.

### Aesthetic balance

| Pillar | Visual expression |
|---|---|
| **Confiança / Segurança (cliente)** | Prestway blue (`brand-blue` / `audience`), clear hierarchy, protected-payment cues |
| **Crescimento / Oportunidade (prestador)** | Prestway orange (`brand-orange` / `audience`), energy, valorização profissional |
| **Tecnologia / Modernidade** | Minimal UI, Inter body, precise spacing, Stripe/Linear clarity |
| **Humanidade / Proximidade** | Warm copy, real people — brand orange / audience when intentional |

Prestway should feel closer to **Airbnb · Stripe · Notion · Linear · Shopify** than to construtoras, imobiliárias, bancos, seguradoras, or generic service classifieds.

### Canvas & color roles

- **Canvas** (`{colors.canvas}` — #FFFFFF) with soft bands (`{colors.canvas-soft}` — #F9FAFB).
- **Primary** (`{colors.primary}`): universal black (#000000) for CTAs, focus, chrome.
- **Audience** (`audience-*`): role-aware brand color — Prestway blue for clients, orange for providers — use only when the role color is intentional.
- **Brand blue / Brand orange**: fixed tokens for punctual use without role switching.
- Type: **Manrope** (Bold / ExtraBold) for logo, display, and titles; **Inter** for body and UI chrome.

### Shape language

Mixed radii (intentional, not copy of Uber or Airbnb):

- Buttons → pill (`{rounded.pill}`)
- Cards → 16px (`{rounded.lg}`)
- Inputs → 12px (`{rounded.md}`)

### Key characteristics

- **Role-aware primary:** one token (`primary`) carries both audiences.
- **Signature component:** `{component.service-request-card}` — product entry, not a marketing hero.
- **Three dominant cards:** Service Request, Provider, Proposal.
- **Abstract brand mark:** connection / trust link / shared growth — never houses, tools, hard hats, or buildings.
- **Real photography only:** people, outcomes, care — never stock vectors or generic tool illustrations.
- **Micro-motion only:** 100–200ms; discrete elevation.

### What the brand must transmit

1. **Segurança** — protection for both sides
2. **Tranquilidade** — calm, controlled journey
3. **Confiança** — credible digital relationship
4. **Controle** — clear, predictable steps
5. **Valorização** — dignity for clients and professionals
6. **Profissionalismo** — informal market → professional experience

### What the brand must NOT feel like

- Construction / DIY catalog
- Bank or insurance portal
- Legal / corporate heavy UI
- Cheap classifieds (OLX / GetNinjas)
- Colorful promo startup
- Generic marketplace noise
- Tourism lifestyle (Airbnb copy) or pure logistics (Uber copy)

---

## Positioning (product UI)

| Reference | We take | We leave |
|---|---|---|
| **Stripe** | Clarity, trust in money flows, precise hierarchy | Developer-only density |
| **Airbnb** | Human trust, reputation as product | Lifestyle destination aesthetic |
| **Notion / Linear** | Minimal international tech polish | Cold/empty product surfaces |
| **Shopify** | Growth + accessibility for operators | Merchant-dashboard clutter |

**Prestway transmits:** trust · protection · transparency · professionalism · shared growth

The problem involves entry into the client's home, protected payment, and service execution — requiring more visual credibility than a ride-hailing or classifieds app, without looking like a bank or contractor.

---

## Colors

### Primary (universal black)

`{colors.primary}` is **#000000** for every role. Default CTAs, nav chrome, and focus use `primary-*`.

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary-hover">…</button>
```

### Brand + audience (punctual)

| Token | Hex | Behavior |
|---|---|---|
| `brand-blue` | #2563EB | Fixed Prestway blue |
| `brand-orange` | #F97316 | Fixed Prestway orange |
| `audience` | auto | Client → brand-blue · Provider → brand-orange via `html[data-audience]` |

```tsx
<span className="text-audience">…</span> {/* only when role color is intentional */}
<span className="bg-brand-blue text-brand-blue-foreground">…</span>
```

### Primary scale

- **Primary** (`{colors.primary}`): black fill for default actions.
- **Primary Hover** (`{colors.primary-hover}`): press state.
- **Primary Soft** (`{colors.primary-soft}`): tinted bands / selected rows.
- **Primary Foreground** (`{colors.on-primary}` — #FFFFFF): text on primary fills.

### Copper (optional reward)

- **Copper** (`--copper` / Tailwind `copper-*` — #F97316): optional warm highlight for badges/progress. Prefer `primary` for default actions; `brand-orange` / `audience` when orange is intentional.

### Surface

- **Canvas** (`{colors.canvas}` — #FFFFFF): default page floor.
- **Canvas Soft** (`{colors.canvas-soft}` — #F9FAFB): section bands, list floors, empty states.

### Borders

- **Border** (`{colors.border}` — #E5E7EB): card outlines, inputs, separators, secondary button strokes.

### Text

- **Ink** (`{colors.ink}` — #111827): headlines, titles, primary labels.
- **Body** (`{colors.body}` — #6B7280): running text, descriptions, secondary meta.
- **Mute** (`{colors.mute}` — #9CA3AF): placeholders, inactive tabs, timestamps, helpers.
- **On Primary / On Accent** (`{colors.on-primary}` / `{colors.on-accent}` — #FFFFFF): text on filled blue/orange.

### Semantic

- **Success** (`{colors.success}` — #16A34A)
- **Warning** (`{colors.warning}` — #F59E0B)
- **Danger** (`{colors.danger}` — #DC2626)
- **Info** (`{colors.info}` — #0EA5E9)

### Scrim

- **Scrim** (`{colors.scrim}` — #000000 at 40–50% opacity): modal / bottom-sheet backdrop.

---

## Typography

### Font families

| Role | Family | Characteristics |
|---|---|---|
| **Logo / Branding / Display** | Manrope Bold · ExtraBold | moderna, tecnológica, amigável, memorável |
| **Product / Interface** | Inter | legibilidade, simplicidade, clareza, confiança |

### Hierarchy

| Token | Size | Weight | Use |
|---|---|---|---|
| `{typography.display-xl}` | 48px | 800 | Landing hero (desktop) |
| `{typography.display-lg}` | 36px | 700 | Section heroes, empty states |
| `{typography.display-md}` | 28px | 700 | Page titles, modal headers |
| `{typography.title}` | 20px | 600 | Card titles, provider name |
| `{typography.body}` | 16px | 400 | Running text, form values |
| `{typography.caption}` | 14px | 400 | Meta, timestamps |
| `{typography.rating-display}` | 48px | 700 | Provider rating peak signal |
| `{typography.button-md}` / `button-sm` | 16 / 14 | 600 | CTAs |
| `{typography.badge}` | 11px | 600 | Status / premium chips |
| `{typography.nav-link}` | 16px | 600 | Navigation |

### Principles

- Display is strong enough to carry credibility without construction imagery.
- Body stays at 400 — clarity over typographic muscle.
- UI copy is **simple, human, and direct** — no bureaucratic fluff, no contractor jargon.
- Peak typographic trust moment: rating display on provider profiles.

### Font loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
```

---

## Shape Language

| Token | Value | Applied to |
|---|---|---|
| `{rounded.sm}` | 8px | Chips, tags |
| `{rounded.md}` | 12px | Inputs, selects, textareas |
| `{rounded.lg}` | 16px | Cards |
| `{rounded.xl}` | 24px | Hero form card, modals |
| `{rounded.pill}` | 999px | Buttons, filter pills, badges |

| Element | Radius | Rationale |
|---|---|---|
| **Buttons** | pill | Action and forward motion |
| **Cards** | 16px | Stability and trust |
| **Inputs** | 12px | Structure and formality |

---

## Layout

### Spacing

- Base unit 4px (2px micro-step).
- Tokens: `{spacing.xxs}` → `{spacing.section}` as in frontmatter.
- Card padding: 24px service-request · 16px provider · 20–24px proposal.
- Gutters: 16px lists · 24px detail layouts.

### Grid & container

- Max content ~1200px marketing; ~1080px in-app.
- Hero: single-column — headline above `{component.service-request-card}`. The form **is** the hero.
- Lists: 1-up mobile; 2-up tablet+.
- Provider profile: photo + stats, tabbed content; sticky hire CTA on mobile.

### Whitespace

Generous section breathing (`{spacing.section}`) with **dense card stacks** in marketplace views — scannable, not editorial.

---

## Elevation

| Level | Token | Use |
|---|---|---|
| Flat | — | Body, most surfaces |
| Level 1 | `{elevation.level-1}` | Provider cards, list items |
| Level 2 | `{elevation.level-2}` | Service Request Card, floating bars |
| Level 3 | `{elevation.level-3}` | Modals, sheets, menus |

Hover: level-1 → level-2, no scale. Hierarchy from spacing/type first, shadows second.

---

## Motion

| Token | Duration | Use |
|---|---|---|
| `{motion.fast}` | 100ms | Press, toggle |
| `{motion.base}` | 150ms | Hover elevation, tabs |
| `{motion.slow}` | 200ms | Modal / sheet |
| `{motion.easing}` | `cubic-bezier(0.4, 0, 0.2, 1)` | All |

No elastic bounce, no parallax. Skeletons over full-page spinners.

> **Code note:** Tailwind `ease-prestway` (alias `ease-prestway`) maps to `{motion.easing}`.

---

## Components

### Buttons

**`button-primary`** (cliente) — Azul Prestway fill, white text, pill, 48px height. Dominant client CTA: "Solicitar orçamento", "Continuar", "Pagar".

**`button-primary-hover`** — `{colors.primary-hover}`. No transform, no shadow change.

**`button-primary-provider`** (prestador) — Laranja Prestway fill, white text, pill, 48px height. Dominant provider CTA: "Enviar proposta", "Aceitar oportunidade", "Continuar" in provider wizards.

**`button-primary-provider-hover`** — `{colors.accent-hover}`. Same motion rules as client primary.

**`button-secondary`** — White fill, ink text, 1px border, pill. Shared across audiences.

**`button-accent-badge`** — Accent-soft + accent text. Provider-side labels ("Destaque", opportunity chips) — not a substitute for client primary CTAs.

### Signature: Service Request Card

**`service-request-card`** — Product entry point (Stripe checkout clarity × Airbnb search intent).

```text
[headline]
Contrate com segurança.
Profissionais verificados, pagamento protegido.

[service-request-card]
  O que você precisa?
  [Categoria]
  [Descrição]
  [ Solicitar orçamento ]
```

White surface, `{rounded.lg}` / `{rounded.xl}` on hero, `{elevation.level-2}`, 24px padding.

### Provider Card

**`provider-card`** — Trust element shown to clients (blue chrome context). Photo-first, circular avatar, rating in ink (not gold stars), meta in caption muted. Provider-side list cards use orange chrome for actions.

### Proposal Card

**`proposal-card`** — Comparison row (client view → blue actions; provider compose → orange actions).  
**`proposal-card-highlight`** — Accent-soft + 1px accent border when highlighting a provider/opportunity moment.

### Forms

**`text-input`** — White, 1px border, 12px radius, 52px height. Focus: 2px border in the **audience color** — `{colors.primary}` on client forms, `{colors.accent}` on provider forms. No glow.

### Navigation

**`top-nav`** — White canvas, ink text, 64px, subtle bottom border. Active states and nav CTAs follow audience: blue in client app, orange in provider app. Feels international-tech (Notion / Stripe), not bank or contractor chrome.

### Badges

**`premium-badge`** — Accent-soft + accent text when the badge lives in provider communication ("Premium", "Destaque"). Client-facing status chips prefer the blue soft/primary scale.

---

## Imagery & iconography

| Use | Do NOT use |
|---|---|
| Real professionals and clients (consent) | Stock models, illustrated characters |
| Completed outcomes, care, harmony at home | Houses, roofs, hammers, wrenches, hard hats, buildings as brand icons |
| Abstract Prestway mark (connection / trust link) | Generic tool iconography |
| Calm, organized environments | Chaotic construction sites as hero |

Photography answers: *"Can I trust this relationship?"* — never decoration.

---

## Hero

Product entry, not marketing theater:

```text
[headline — display-md / display-lg]
Contrate com segurança.
Profissionais verificados, pagamento protegido.

[service-request-card]
  O que você precisa?
  [Categoria ▾]
  [Descreva o serviço...        ]
  [ Solicitar orçamento          ]
```

- No background video, no tool collage, no feature grid above the fold.
- Optional `{colors.canvas-soft}` band behind the card.
- Mobile: full-width card; sticky CTA on multi-step.

---

## Card System Overview

| Card | Role | Priority |
|---|---|---|
| **Service Request Card** | Entry — starts the protected flow | Highest |
| **Provider Card** | Trust — who will do the work | High |
| **Proposal Card** | Transaction — price, timeline, action | High |

All other UI serves these three.

---

## Design Principles

### 1. Trust before beauty

If beauty reduces clarity or credibility, choose clarity.

### 2. Protection is the product

Foreground protected payment, clear steps, and reputation — not the platform ego.

### 3. Human technology

Modern and sophisticated, never cold. Accessible and welcoming without being casual or cheap.

### 4. One primary action

Exactly one dominant action per screen.

### 5. Clarity beats creativity

When in doubt, choose the clear option.

### 6. No construction clichés

Never lean on hammers, roofs, hard hats, or building silhouettes to explain the brand.

---

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| **Mobile** | < 744px | Compact nav; full-width request card; 1-up stacks; sticky bottom CTA; bottom sheets |
| **Tablet** | 744–1128px | Nav links; 2-up cards; request card ~480px |
| **Desktop** | 1128–1440px | Full nav; centered hero + request card; 2-column detail |
| **Wide** | > 1440px | Content cap 1200px |

### Touch targets

- Primary CTAs ≥ 48×48px.
- Full provider card tappable.
- Filter pills ≥ 44px height.

### Mobile-first

- Full-screen sheets on mobile (`100dvh`, safe-area).
- Action footers above virtual keyboard.
- `overscroll-y-contain` + `touch-pan-y` on scroll regions.

---

## CSS Token Mapping

Implementation in `src/index.css`:

| DESIGN.md token | CSS variable | Notes |
|---|---|---|
| `{colors.primary}` | `--primary` | Universal black #000000 |
| `{colors.primary-hover}` | `--primary-hover` | Near-black hover |
| `audience` | `--audience` | Role-aware: #2563EB client · #F97316 provider |
| `brand-blue` | `--brand-blue` | Fixed #2563EB |
| `brand-orange` | `--brand-orange` | Fixed #F97316 |
| `{colors.primary-soft}` | `--primary-soft` | Near-white soft tint |
| `{colors.canvas-soft}` | `--canvas-soft` | #F9FAFB |
| `{colors.border}` | `--border` | #E5E7EB |
| `{colors.ink}` | `--ink` | #111827 |
| `{rounded.lg}` | `--radius-lg` | 16px cards |
| Display font | `font-display` → Manrope | Headings use Manrope via `src/index.css` |
| Motion easing | `--motion-easing` | `ease-prestway` / `ease-prestway` |

---

## Known Gaps

- **Product copy migration:** many UI strings still say "Prestway"; migrate to **Prestway** per [`BRAND.md`](./BRAND.md).
- **Logo / symbol assets:** replace legacy Prestway marks with Prestway wordmark + abstract symbol.
- **Audience color audit:** keep default chrome on `primary` (black); use `audience-*` / `brand-*` only for intentional brand-color moments.
- **Dark mode:** tokens exist; public product is light-mode-first.
- **Skeleton / loading states:** standardize across card types.
- **Photography pipeline:** consent, compression, aspect ratios TBD.

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v3.7 | 2026-08-11 | Rebrand to **Prestway**. New DNA/positioning ([`BRAND.md`](./BRAND.md)). Palette → Azul #2563EB + Laranja #F97316. Peers Stripe/Notion/Linear. White top-nav. Ban construction imagery. Manrope ExtraBold for display. |