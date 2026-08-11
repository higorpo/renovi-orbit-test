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

---

# HTML preview

```html
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport"/>
<title>Prestway Chat - Karen</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-surface-variant": "#444748",
                      "on-primary-container": "#858383",
                      "surface-dim": "#d3daea",
                      "surface": "#f9f9ff",
                      "secondary": "#5c5f60",
                      "on-secondary-container": "#626566",
                      "on-tertiary": "#ffffff",
                      "on-tertiary-fixed-variant": "#004493",
                      "outline-variant": "#c4c7c7",
                      "primary": "#000000",
                      "on-surface": "#151c27",
                      "primary-fixed": "#e5e2e1",
                      "inverse-primary": "#c8c6c5",
                      "tertiary-fixed": "#d8e2ff",
                      "surface-container-high": "#e2e8f8",
                      "on-primary": "#ffffff",
                      "background": "#f9f9ff",
                      "tertiary-container": "#001a41",
                      "surface-tint": "#5f5e5e",
                      "on-error": "#ffffff",
                      "tertiary-fixed-dim": "#adc6ff",
                      "secondary-fixed": "#e1e3e4",
                      "secondary-container": "#e1e3e4",
                      "error": "#ba1a1a",
                      "outline": "#747878",
                      "primary-fixed-dim": "#c8c6c5",
                      "surface-container-low": "#f0f3ff",
                      "surface-bright": "#f9f9ff",
                      "on-secondary-fixed-variant": "#454748",
                      "primary-container": "#1c1b1b",
                      "surface-container": "#e7eefe",
                      "on-error-container": "#93000a",
                      "tertiary": "#000000",
                      "surface-variant": "#dce2f3",
                      "secondary-fixed-dim": "#c5c7c8",
                      "surface-container-highest": "#dce2f3",
                      "on-tertiary-container": "#2480ff",
                      "inverse-surface": "#2a313d",
                      "on-tertiary-fixed": "#001a41",
                      "error-container": "#ffdad6",
                      "on-background": "#151c27",
                      "on-secondary": "#ffffff",
                      "on-secondary-fixed": "#191c1d",
                      "on-primary-fixed-variant": "#474746",
                      "inverse-on-surface": "#ebf1ff",
                      "on-primary-fixed": "#1c1b1b",
                      "surface-container-lowest": "#ffffff"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "spacing": {
                      "gutter-bubble": "0.5rem",
                      "margin-mobile": "1rem",
                      "padding-bubble-x": "1rem",
                      "margin-page": "1.5rem",
                      "padding-bubble-y": "0.75rem",
                      "stack-gap": "1rem"
              },
              "fontFamily": {
                      "message-text": ["Inter"],
                      "label-sm": ["Inter"],
                      "header-title": ["Inter"],
                      "message-text-mobile": ["Inter"],
                      "header-title-mobile": ["Inter"],
                      "metadata": ["Inter"]
              },
              "fontSize": {
                      "message-text": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                      "label-sm": ["13px", {"lineHeight": "18px", "fontWeight": "500"}],
                      "header-title": ["20px", {"lineHeight": "28px", "letterSpacing": "-0.02em", "fontWeight": "600"}],
                      "message-text-mobile": ["15px", {"lineHeight": "22px", "fontWeight": "400"}],
                      "header-title-mobile": ["18px", {"lineHeight": "24px", "fontWeight": "600"}],
                      "metadata": ["12px", {"lineHeight": "16px", "fontWeight": "400"}]
              }
            },
          },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #e5e7eb;
            border-radius: 10px;
        }
        .chat-container {
            height: calc(100vh - 112px - 80px);
            margin-top: 112px;
            margin-bottom: 80px;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
</head>
<body class="bg-surface-container-lowest font-message-text text-on-surface antialiased">
<!-- Fixed Header -->
<header class="fixed top-0 w-full z-50 bg-surface h-[112px] shadow-sm flex flex-col items-center justify-center px-4">
<!-- Top Row Actions -->
<div class="w-full flex justify-between items-center absolute top-4 left-0 px-4">
<button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
<span class="material-symbols-outlined text-on-surface">arrow_back</span>
</button>
<button class="bg-surface-container-high px-4 py-1.5 rounded-full text-label-sm font-label-sm hover:opacity-80 transition-opacity">
                Details
            </button>
</div>
<!-- Identity Cluster -->
<div class="flex flex-col items-center mt-2">
<div class="relative">
<img alt="Karen" class="w-16 h-16 rounded-full object-cover border-2 border-surface shadow-sm" data-alt="A professional headshot of a friendly female contractor in her late 30s with a warm smile, set against a bright, airy architectural background. The lighting is soft and natural, emphasizing a high-trust marketplace aesthetic. The visual style is clean and minimalist, using a soft-focus background to keep the subject as the primary anchor. The colors are muted neutrals and soft whites." src="https://lh3.googleusercontent.com/aida-public/AB6AXuChJKH1zxjV94ksXxqHPZnWCBkFCIH0CqzUzcVNvDjx80m_QVBucXVHg_WCtCgBu5HvuO1BMmGhiS33lQ86ya5IaCW4Uf1kfi69OD4UnmkdjNcK4hbOaFkNUZtOke6XqAlSZAj6fPvjuGz2mMzNpp9dxrKpFlXyT6ZH8-sri8JI518y4pVS-rH1SfwBJp2OtLF6oHTcnadaMeY5RXpV4pTrSyKrOihXu899OpgxiY-YUUOgsw9Sj8Ttl88AG3iyt9yOVpdWYi84yE8"/>
<div class="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-surface rounded-full"></div>
</div>
<h1 class="font-header-title-mobile text-header-title-mobile mt-1 text-on-surface">Karen</h1>
<p class="font-metadata text-metadata text-secondary">Apartment Painting Service</p>
</div>
</header><div class="fixed top-[112px] left-0 w-full z-40 bg-surface px-4 py-2">
<div class="max-w-3xl mx-auto bg-surface-container-low rounded-xl p-4 shadow-sm border border-outline-variant/30">
<div class="flex flex-col space-y-4">
<p class="text-[14px] leading-relaxed text-on-surface-variant font-message-text">
                You already have enough information to prepare a proposal for this request. Send your pricing, scope, and details to continue the negotiation.
            </p>
<div class="flex justify-end items-center space-x-3">
<button class="px-4 py-2 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors rounded-full uppercase tracking-wide">
                    Close
                </button>
<button class="px-6 py-2 bg-primary-container text-on-primary text-label-sm font-semibold rounded-full shadow-sm hover:opacity-90 transition-all">
                    Send Proposal
                </button>
</div>
</div>
</div>
</div>
<!-- Scrollable Message Area -->
<main class="chat-container overflow-y-auto px-4 py-6 flex flex-col space-y-stack-gap max-w-3xl mx-auto w-full" style="height: calc(100vh - 112px - 80px - 140px); margin-top: calc(112px + 140px); margin-bottom: 80px;">
<!-- Date Separator -->
<div class="flex justify-center my-4">
<span class="font-metadata text-metadata text-secondary px-3 py-1 bg-surface-container-low rounded-full">
                Feb 9
            </span>
</div>
<!-- Incoming Message -->
<div class="flex items-end space-x-2 animate-fade-in">
<img class="w-8 h-8 rounded-full object-cover flex-shrink-0" data-alt="Small circular avatar profile photo of a professional woman with brown hair and a friendly expression, captured in a brightly lit studio setting. The image is crisp and professional, fitting a high-end service platform's minimalist design. The background is a clean, neutral gray tone that provides gentle contrast." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLR_L6nMMtY6kbMw9M4-osf4vyTCAugzIePIf45yS3O9svHOAcRrfWj8fJgqs2DR8jeOwcO2VeibLImyYcnJGSHM8YIQrFmDiGDp4Tz9I07itas8N_4E8jiJMRUodkEvNAnMfQROQ1pjfb1nB3ASVxx-1bIDaJC5gYW3BE3Ep70-tyyUl7VFysSDIaYGqZzs25DZRP0hS62eYongJ8zRNyLHe92sRY8HWjJjlsNjMVJypDc1uDqwuZFLlU-FDOORWKLXWP9Sa51iM"/>
<div class="max-w-[80%] bg-[#F1F3F5] text-on-surface px-padding-bubble-x py-padding-bubble-y rounded-2xl rounded-bl-none shadow-sm">
<p class="font-message-text-mobile text-message-text-mobile">Hi! I saw your request for the apartment painting. When would you like to start?</p>
</div>
</div>
<!-- System Message -->
<div class="flex flex-col items-center justify-center my-6 space-y-1">
<div class="h-[1px] w-12 bg-outline-variant mb-1"></div>
<span class="font-metadata text-metadata text-on-surface-variant uppercase tracking-widest font-medium">
                Proposal submitted
            </span>
</div>
<!-- Outgoing Message -->
<div class="flex justify-end animate-fade-in">
<div class="max-w-[80%] bg-[#1A1A1A] text-on-tertiary px-padding-bubble-x py-padding-bubble-y rounded-2xl rounded-br-none shadow-md">
<p class="font-message-text-mobile text-message-text-mobile">Hello Karen! I'm looking to start next Monday. Does that work for you?</p>
</div>
</div>
<!-- Message Status -->
<div class="flex justify-end -mt-2">
<span class="font-metadata text-metadata text-secondary mr-1">Delivered</span>
<span class="material-symbols-outlined text-[14px] text-secondary">done_all</span>
</div>
</main>
<!-- Fixed Input Area -->
<footer class="fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant h-[80px] flex items-center px-4 z-50">
<div class="max-w-3xl mx-auto w-full flex items-center space-x-3">
<!-- Attach Button -->
<button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
<span class="material-symbols-outlined">add_photo_alternate</span>
</button>
<!-- Input Field -->
<div class="flex-1 relative">
<input class="w-full bg-surface-container-low border-none rounded-full py-3 px-6 text-on-surface placeholder:text-secondary focus:ring-1 focus:ring-primary transition-all font-message-text-mobile text-message-text-mobile" placeholder="Write a message..." type="text"/>
</div>
<!-- Send Button -->
<button class="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm" id="sendBtn">
<span class="material-symbols-outlined">arrow_upward</span>
</button>
</div>
</footer>
<script>
        // Micro-interactions
        const input = document.querySelector('input');
        const sendBtn = document.getElementById('sendBtn');

        input.addEventListener('input', (e) => {
            if (e.target.value.trim().length > 0) {
                sendBtn.style.opacity = '1';
                sendBtn.classList.remove('bg-secondary');
                sendBtn.classList.add('bg-primary');
            } else {
                sendBtn.style.opacity = '0.5';
            }
        });

        // Initialize state
        sendBtn.style.opacity = '0.5';

        // Scroll to bottom on load
        window.addEventListener('load', () => {
            const chatContainer = document.querySelector('.chat-container');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        // Focus keyboard adjustment (for mobile simulation)
        input.addEventListener('focus', () => {
            // Optional: Handle viewport height changes on mobile keyboard popup
        });
    </script>
</body></html>
```