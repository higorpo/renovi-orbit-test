# Chat Screen Component — Detailed Design Specification

The chat screen is the primary real-time communication interface between clients and service providers inside the Renovi platform. Its purpose is to provide a clean, trustworthy, modern, and frictionless messaging experience optimized for service negotiation, clarification, and operational communication.

The interface should feel lightweight, highly readable, and mobile-first, while still scaling elegantly to desktop environments.

The visual language should combine:

* WhatsApp-like conversational familiarity,
* Airbnb-style cleanliness,
* and modern marketplace professionalism.

The chat experience must prioritize:

* clarity,
* speed,
* usability,
* message readability,
* and contextual understanding of the active service request.

---

# Overall Screen Structure

The screen is vertically divided into 3 major sections:

```text id="b6f49e"
┌──────────────────────────────┐
│ Header                       │
├──────────────────────────────┤
│                              │
│ Conversation Messages        │
│ Scrollable Area              │
│                              │
├──────────────────────────────┤
│ Message Input Area           │
└──────────────────────────────┘
```

---

# Mobile-First Layout

The mobile version is the primary reference for the interface.

The screen should feel:

* spacious,
* minimal,
* touch-friendly,
* and highly readable.

The layout should use safe-area awareness for:

* iOS notch,
* Android status bar,
* gesture navigation areas.

---

# Header Section

The top section of the chat acts as a contextual identity block for the active conversation.

It should remain fixed/sticky at the top during scrolling.

---

# Header Layout Structure

```text id="t8o2re"
┌─────────────────────────────────────┐
│ ← Back          [ Avatar ] Details │
│                 Karen               │
│      Apartment Painting Service    │
└─────────────────────────────────────┘
```

---

# Header Container

### Height

Recommended:

* `96px–132px`

The height should comfortably accommodate:

* avatar,
* title,
* subtitle,
* spacing.

---

### Background

* Neutral surface color.
* Usually white or very soft gray.
* Slight separation from message area.

---

### Border / Separation

Optional:

* subtle bottom border,
  or
* very soft shadow.

The separation should feel delicate and modern.

---

# Back Button

Located in the top-left corner.

---

## Purpose

Allows the user to navigate back to:

* conversation list,
* previous screen,
* or inbox view.

---

## Design

### Shape

* Circular or ghost-style button.

### Icon

* Left-facing arrow.

### Size

* Touch target minimum: `44px`.

### Visual Style

* Minimal.
* Neutral icon color.
* No heavy borders.

### Interaction

* Soft opacity/scale feedback on tap.

---

# Profile Avatar

Centered horizontally in the header.

---

## Purpose

Represents the other participant in the conversation.

Dynamic behavior:

* Client sees provider avatar.
* Provider sees client avatar.

---

## Shape

* Perfect circle.

---

## Size

Recommended:

* `52px–72px`.

---

## Visual Style

* Fully circular crop.
* Soft shadow optional.
* White border optional.

---

## Fallback State

If no image exists:

* colored circular background,
* centered user initial.

Example:

```text id="0x69sk"
K
```

---

# Participant Name

Centered below the avatar.

---

## Typography

* Medium/Semibold.
* `18px–22px`.

---

## Color

* Primary text color.
* Strong contrast.

---

## Behavior

* Single line preferred.
* Ellipsis truncation if too long.

---

# Service Name / Context Subtitle

Located below the participant name.

Example:

```text id="j2zq3t"
Apartment Painting Service
```

---

## Purpose

Provides contextual awareness of which service request this chat belongs to.

This is especially important because users may have multiple simultaneous chats.

---

## Typography

* Smaller than participant name.
* `13px–15px`.

---

## Color

* Secondary/muted text color.

---

## Behavior

* Single line preferred.
* Ellipsis truncation if needed.

---

# Details Button

Located in the top-right corner of the header.

---

## Purpose

Opens a detailed contextual panel or screen containing:

* service request details,
* proposal information,
* scheduling details,
* attachments,
* participant information,
* or additional operational actions.

---

## Design

### Shape

* Rounded pill/capsule button.

### Height

* `32px–40px`.

### Padding

* Horizontal emphasis.

---

## Typography

* Medium weight.
* Clean sans-serif.

---

## Visual Style

* Soft neutral background.
* Minimalistic.
* Modern marketplace feel.

---

## Interaction

* Soft press feedback.
* Fast transitions.

---

# Conversation Area

This is the main scrollable area of the screen.

It occupies all remaining vertical space between:

* header,
* and message input area.

---

# Conversation Container

### Behavior

* Vertical scrolling only.
* Smooth momentum scrolling.
* Auto-scroll to latest message when entering chat.

---

## Padding

Recommended:

* Horizontal: `16px`
* Vertical: `12px–20px`

---

# Date Separators

Used to separate messages chronologically.

Example:

```text id="0fjlwm"
Feb 9
```

---

## Alignment

Centered horizontally.

---

## Typography

* Small.
* Medium weight.

---

## Color

* Muted gray.

---

## Spacing

Generous vertical spacing above and below.

---

# Message Groups

Messages should visually group by:

* sender,
* and time proximity.

Grouped messages reduce visual clutter.

---

# Incoming Messages

Messages received from the other participant.

Positioned on the left side.

---

## Structure

```text id="h83j72"
[Avatar] [ Message Bubble ]
```

---

# Incoming Avatar

Optional per message group.

---

## Behavior

* Shown only for the first message in a grouped sequence.
* Hidden for consecutive grouped messages.

---

## Shape

* Circular.

---

## Size

* `28px–36px`.

---

# Incoming Bubble

### Shape

Rounded rectangle bubble with:

* large corner radius,
* softer top-left radius optional for grouped effect.

---

## Background

* Very light neutral gray.

---

## Typography

* High readability.
* `15px–17px`.

---

## Text Color

* Dark neutral text.

---

## Max Width

Recommended:

* `72%–82%` of screen width.

---

# Outgoing Messages

Messages sent by the current user.

Positioned on the right side.

---

# Outgoing Bubble

### Shape

Rounded rectangle bubble.

---

## Background

* Primary dark/brand-colored surface.

Example:

* dark charcoal,
* deep neutral,
* or primary brand color.

---

## Text Color

* White or near-white.

---

## Max Width

* `72%–82%`.

---

# Message Metadata

Metadata appears below or near message groups.

Examples:

* timestamp,
* read receipts,
* delivery status.

---

## Typography

* Small.
* Muted.

---

## Alignment

* Incoming metadata aligns left.
* Outgoing metadata aligns right.

---

# System Messages

Used for operational events.

Examples:

```text id="r4t4p7"
Inquiry declined
Proposal submitted
Booking confirmed
```

---

## Alignment

Centered horizontally.

---

## Typography

* Small/medium.
* Muted gray.

---

## Visual Style

Should feel unobtrusive and informational.

---

# Message Input Area

Fixed at the bottom of the screen.

Always visible.

---

# Input Container

```text id="f9c0sh"
[ Photo ] [ Message Input Field........ ] [ Send ]
```

---

## Behavior

* Fixed/sticky positioning.
* Must adapt dynamically when keyboard opens.
* Keyboard must never overlap:

  * message field,
  * latest messages,
  * send button.

The layout should resize smoothly with keyboard appearance.

---

# Input Area Container

### Height

Recommended:

* `64px–82px`.

---

## Background

* White or neutral surface.

---

## Border

Optional subtle top border.

---

## Padding

Comfortable horizontal spacing.

---

# Photo Attachment Button

Located on the left side of the input area.

---

## Purpose

Allows the user to attach and send images.

---

## Shape

* Circular button.

---

## Icon

* Photo/image icon.

---

## Size

* `40px–48px`.

---

## Visual Style

* Neutral background.
* Minimal design.

---

## Interaction

Opens:

* camera,
* photo gallery,
* or attachment picker.

---

# Message Text Field

The primary text input component.

---

## Shape

* Fully rounded pill input.

---

## Height

* `44px–52px`.

---

## Background

* Very soft neutral gray.

---

## Placeholder

Example:

```text id="jzbjlwm"
Write a message...
```

---

## Typography

* Clean sans-serif.
* Medium readability.

---

## Behavior

Supports:

* multiline expansion,
* emojis,
* pasted content.

Should expand vertically up to a safe limit.

---

# Send Button

Located on the far-right side of the input area.

---

## Shape

* Perfect circle.

---

## Icon

* Upward arrow icon.

---

## Background

* Primary platform color.

---

## Icon Color

* White.

---

## Size

* `44px–52px`.

---

## Behavior

* Disabled when input is empty (optional).
* Activated when text exists.

---

## Interaction Feedback

* Soft scaling animation.
* Subtle opacity transitions.

---

# Keyboard Interaction Behavior

This is a critical UX requirement.

When the keyboard opens:

* the entire conversation area must resize dynamically,
* the latest messages must remain visible,
* the input field must stay attached above the keyboard,
* no UI elements may become hidden behind the keyboard.

The transition should feel smooth and native.

---

# Desktop Adaptation

The desktop/web experience should preserve the same visual language while leveraging larger screen space.

---

# Desktop Layout Structure

```text id="jlwm3g"
┌───────────────┬─────────────────────┐
│ Chat List     │ Active Conversation │
│ Sidebar       │                     │
│               │                     │
└───────────────┴─────────────────────┘
```

---

# Desktop Sidebar

The conversation list becomes a persistent left sidebar.

Recommended width:

* `320px–420px`.

---

# Desktop Conversation Area

The active chat occupies the remaining horizontal space.

The internal structure remains consistent with mobile:

* header,
* messages,
* fixed input area.

---

# Desktop Improvements

Compared to mobile:

* increased spacing,
* larger message widths,
* more breathing room,
* smoother hover states,
* richer transitions.

---

# Recommended Design Language

The interface should communicate:

* trust,
* operational clarity,
* simplicity,
* responsiveness,
* and modern marketplace professionalism.

The experience should feel:

* lightweight,
* calm,
* highly usable,
* and conversational rather than enterprise-heavy.

---

# Recommended Typography

Preferred fonts:

* Inter
* SF Pro
* Geist
* or similar modern UI sans-serif.

---

# Recommended Motion

Animations should be:

* subtle,
* fast,
* purposeful.

Avoid:

* exaggerated motion,
* heavy transitions,
* visual noise.

---

# Accessibility Considerations

* Minimum touch targets: `44px`.
* Strong contrast ratios.
* Keyboard-safe layout handling.
* Screen-reader friendly structure.
* Avatar fallback readability.
* Proper focus states on desktop/web.
* Support for dynamic text scaling.

---

# HTML example
```html
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport"/>
<title>Renovi Chat - Karen</title>
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
</header>
<!-- Scrollable Message Area -->
<main class="chat-container overflow-y-auto px-4 py-6 flex flex-col space-y-stack-gap max-w-3xl mx-auto w-full">
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