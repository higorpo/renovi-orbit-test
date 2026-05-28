# Chat Action Banner Component — Detailed Design Specification

The Chat Action Banner is a contextual guidance component displayed inside the chat screen, positioned immediately below the main chat header.

Its purpose is to provide users with a clear and actionable summary of the next recommended action for that specific conversation.

The component acts as a lightweight operational assistant inside the chat flow, helping both clients and service providers understand:

* what is currently expected from them,
* what actions are available,
* and what the next step in the service workflow should be.

The banner should feel:

* informative,
* calm,
* lightweight,
* highly noticeable without being intrusive,
* and operationally clear.

It should never feel like an aggressive warning or advertisement.

---

# Component Placement

The banner is positioned directly below the chat header component.

Example hierarchy:

```text id="jlwm8g"
┌──────────────────────────────┐
│ Chat Header                  │
│ Avatar / Name / Service      │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Chat Action Banner           │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Conversation Messages        │
└──────────────────────────────┘
```

The banner remains visually attached to the top section of the screen and appears before the message history.

---

# Primary Purpose

The banner dynamically adapts based on:

* conversation state,
* proposal state,
* negotiation state,
* and user role.

The displayed content differs depending on whether:

* the viewer is the client,
* or the service provider.

The system should always prioritize showing the most relevant operational action for the current stage of the interaction.

---

# Component Structure

The banner is composed of:

1. Informational text content
2. Primary action button
3. Dismiss/close button

---

# Layout Structure

```text id="jlwmx4"
┌─────────────────────────────────────┐
│ Short contextual explanation text   │
│                                     │
│                     [ Close ] [ CTA ]│
└─────────────────────────────────────┘
```

---

# Banner Container

## Shape

* Rounded rectangle card.

---

## Border Radius

Recommended:

* `14px–18px`

---

## Width

* Full available width inside chat content area.
* Respect screen horizontal padding.

---

## Height

Dynamic height depending on text length.

Recommended minimum:

* `88px–120px`

---

## Padding

Recommended:

* `16px–20px`

Spacing should feel breathable and easy to scan.

---

# Visual Style

The banner should feel:

* soft,
* modern,
* operational,
* and minimally distracting.

---

## Background

Neutral or lightly tinted surface.

Examples:

* very soft blue,
* soft amber,
* neutral gray,
* muted green,
  depending on action type.

The background color should communicate context subtly without overwhelming the interface.

---

## Border

Optional:

* subtle border,
  or
* extremely soft shadow.

---

## Elevation

Very light elevation only.

The component should feel integrated into the interface, not floating aggressively above it.

---

# Informational Text

The main content area contains a short operational explanation.

The text should:

* be concise,
* easy to understand,
* action-oriented,
* and conversational.

---

# Typography

## Description Text

Explains:

* what is happening,
* what action is recommended,
* or what the consequence of inaction may be.

---

### Typography

* Regular/Medium weight
* `13px–15px`

---

### Color

* Neutral readable text color.
* Strong accessibility contrast.

---

### Behavior

* Multi-line supported.
* Natural text wrapping.
* Avoid long paragraphs.

---

# Action Buttons Area

Located at the bottom-right area of the banner.

Buttons should remain visually secondary to the message itself while still clearly actionable.

---

# Primary Action Button (CTA)

This is the main action users are expected to take.

---

## Examples

### Provider Side

* Send Proposal
* Review Proposal
* Update Proposal
* Continue Negotiation

### Client Side

* View Proposal
* Accept Proposal
* Continue Conversation
* Close Conversation

---

# CTA Button Design

## Shape

* Rounded capsule/pill button.

---

## Height

Recommended:

* `36px–42px`

---

## Padding

Comfortable horizontal padding.

---

## Typography

* Medium/Semibold.
* High readability.

---

## Background

* Primary platform color,
  or
* contextual action color.

---

## Text Color

* White or high-contrast foreground.

---

## Interaction

* Soft scaling animation.
* Hover feedback on desktop.
* Press opacity on mobile.

---

# Dismiss / Close Button

Located beside the primary action button.

---

## Purpose

Temporarily hides the banner for the current screen session.

If the user:

* leaves the chat screen,
* and later reopens it,

the banner becomes visible again if the operational condition still exists.

---

# Close Button Design

## Style

Low-emphasis button.

---

## Appearance Options

Can be:

* text button,
* ghost button,
* or icon button.

---

## Examples

```text id="jlwmf2"
Dismiss
Close
✕
```

---

## Visual Priority

Must appear visually lighter than the CTA button.

---

# Dynamic Banner States

The component content changes dynamically according to workflow conditions.

Below are example states.

---

# Provider — Proposal Not Yet Sent

## Example Content

```text id="jlwmh2"
You already have enough information to prepare a proposal for this request. Send your pricing, scope, and details to continue the negotiation.
```

### CTA

```text id="jlwmw8"
Send Proposal
```

---

# Provider — Proposal Revision Requested

## Example Content

```text id="njlwm0"
The client requested updates to your proposal. Review the requested changes and submit a revised version.
```

### CTA

```text id="jlwmg3"
Review Proposal
```

---

# Client — Proposal Received

## Example Content

```text id="jlwmv9"
The provider submitted a proposal for this request. Review pricing, timeline, and service details before responding.
```

### CTA

```text id="jlwm6k"
View Proposal
```

---

# Client — No Pending Actions

## Example Content

```text id="jlwm31"
This conversation currently has no pending actions. You may continue chatting or close the conversation if you no longer wish to proceed.
```

### CTA

```text id="8ng7z2"
Close Conversation
```

---

# Behavior Rules

The system should:

* show only one banner at a time,
* prioritize the most important operational action,
* avoid conflicting actions,
* and dynamically update the banner after state transitions.

---

# Visibility Rules

The banner may:

* appear immediately when entering the chat,
* animate softly into view,
* or remain persistently visible until dismissed.

---

# Animation Recommendations

Animations should be:

* subtle,
* lightweight,
* fast,
* and non-distracting.

Recommended:

* fade-in,
* soft slide-down,
* slight opacity transitions.

Avoid:

* bouncing,
* excessive movement,
* or attention-grabbing effects.

---

# Mobile Behavior

On mobile:

* the banner spans almost the full screen width,
* remains highly touch-friendly,
* and maintains comfortable spacing.

The CTA button must always remain easy to tap with one hand.

---

# Desktop/Web Adaptation

On desktop:

* the banner should align with the conversation content width,
* maintain the same hierarchy,
* and optionally allow slightly larger spacing.

Hover states may be added to buttons.

---

# Accessibility Considerations

* Strong contrast ratios.
* Clear button labels.
* Touch targets minimum `44px`.
* Screen-reader readable action descriptions.
* Color should never be the only contextual indicator.
* Multi-line text must remain readable with dynamic font scaling.

---

# Recommended Design Language

The banner should communicate:

* operational guidance,
* progress clarity,
* trust,
* and workflow assistance.

It should feel like:

* a lightweight assistant,
  not
* a warning system,
  notification spam,
  or advertisement.
