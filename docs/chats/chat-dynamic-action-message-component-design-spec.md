# Dynamic Chat Action Message Component — Detailed Design Specification

The Dynamic Chat Action Message Component is a specialized message type rendered inside the conversation timeline of the chat interface.

Unlike regular text or image messages, this component represents structured operational interactions tied to platform workflows, such as:

* proposals,
* proposal revisions,
* proposal acceptances,
* proposal rejections,
* negotiation state changes,
* and future workflow-related system interactions.

The component behaves as a dynamic and state-aware message block embedded directly into the conversation history.

Its purpose is to:

* provide contextual operational actions inside the conversation flow,
* reduce friction between communication and decision-making,
* and allow users to interact with service workflow states without leaving the chat experience.

The component should feel:

* native to the conversation,
* operationally clear,
* visually differentiated from normal messages,
* and highly interactive without breaking the conversational flow.

---

# Core Concept

The component is not a static message.

It is a dynamic state-driven UI block that:

* renders different layouts depending on message type,
* updates automatically when related entities change state,
* and remains historically attached to the original conversation timeline position.

Example:

If a provider sends a proposal:

* a proposal message component is inserted into the chat timeline.

If the proposal is later accepted:

* the same message component dynamically updates to display the accepted state.

The message must not create duplicated operational messages unnecessarily.

Instead, the original component evolves visually according to workflow progression.

---

# Component Placement

The component appears inline within the conversation message history.

Example:

```text id="jlwmxm"
Client message
Provider message
[ Dynamic Proposal Component ]
Client reply
Provider reply
```

The component behaves as a timeline event embedded naturally into the chat.

---

# Primary Objectives

The component should:

* visually distinguish operational interactions from regular messages,
* centralize workflow actions inside the conversation,
* reduce context switching,
* maintain historical workflow traceability,
* and dynamically reflect real-time state changes.

---

# Supported Initial Use Cases

Initially, the component focuses on proposal-related interactions.

Examples:

* Proposal sent
* Proposal updated
* Proposal revision requested
* Proposal accepted
* Proposal rejected

The architecture must remain extensible for future operational message types.

---

# Future Extensibility

The component architecture should support future dynamic message types such as:

* payment requests,
* scheduling confirmations,
* milestone approvals,
* cancellation requests,
* dispute events,
* booking confirmations,
* delivery confirmations,
* review requests,
* or other workflow-driven interactions.

The rendering system must therefore be:

* modular,
* schema-driven,
* and dynamically composable.

---

# Visual Hierarchy

The component should visually stand out from normal chat bubbles while still feeling integrated into the conversation.

It should feel:

* structured,
* elevated,
* operational,
* and interactive.

---

# Component Structure

The component may contain:

1. Contextual description
2. Operational status
3. Proposal summary information
4. Expand/collapse interaction
5. Primary action buttons
6. Secondary actions
7. Dynamic status indicators
8. Metadata information

---

# Base Layout Structure

```text id="jlwmj7"
┌──────────────────────────────────┐
│ Proposal summary information     │
│                                  │
│ Current operational status       │
│                                  │
│ [ Expand Details ]               │
└──────────────────────────────────┘
```

---

# Component Container

## Shape

* Rounded card container.

---

## Border Radius

Recommended:

* `16px–20px`

---

## Width

* Larger than standard message bubbles.
* Recommended:

  * `78%–92%` of conversation width.

---

## Alignment

The component alignment depends on:

* who triggered the action,
* and who is viewing the conversation.

Example:

* Provider-sent proposal appears aligned similarly to outgoing operational messages.
* Client-visible proposal maintains contextual alignment consistency.

---

# Background Styling

The component should visually differentiate itself from regular text messages.

Recommended:

* slightly elevated neutral surface,
* soft tinted background,
* subtle border,
* lightweight shadow.

---

# Typography

The typography should emphasize:

* clarity,
* scanability,
* operational trust.

---

# Proposal Summary Section

The component should display summarized proposal information directly inside the conversation timeline.

Examples:

* total price,
* estimated timeline,
* short service summary,
* proposal expiration,
* revision state.

The summary should remain intentionally concise.

The objective is:

* quick contextual understanding,
  not
* full proposal visualization.

---

# Example Summary Layout

```text id="jlwm0x"
Painting Service Proposal

Total: $450
Estimated Duration: 3 days
Valid until: Feb 18
```

---

# Expandable Details Interaction

The component must support expansion for deeper inspection.

Example CTA:

```text id="jlwmgz"
View Details
```

or

```text id="jlwmie"
Expand Proposal
```

---

# Expanded State

When expanded, the component may reveal:

* detailed pricing,
* scope breakdown,
* included services,
* exclusions,
* timeline information,
* notes,
* attachments,
* revision history.

The expansion should occur inline without navigating away from the conversation unless explicitly necessary.

---

# Expand/Collapse Behavior

The interaction should:

* animate smoothly,
* preserve scroll position,
* and feel lightweight.

Recommended animations:

* height expansion,
* opacity fade,
* smooth content reveal.

---

# Dynamic State Updates

This is a critical requirement.

The component must automatically update its rendered state whenever the linked operational entity changes.

Examples:

---

## Proposal Sent

Initial state:

```text id="jlwmfg"
Proposal submitted
Waiting for client review
```

---

## Proposal Accepted

Updated state:

```text id="3r5n4y"
Proposal accepted
This proposal was approved by the client
```

---

## Proposal Rejected

Updated state:

```text id="jlwm1d"
Proposal declined
The client chose not to proceed with this proposal
```

---

## Revision Requested

Updated state:

```text id="jlwmw1"
Revision requested
The client requested changes to this proposal
```

---

# Historical Integrity

Even after updates:

* the message must remain in its original timeline position,
* preserve chronological integrity,
* and maintain historical workflow continuity.

The component evolves visually without creating duplicate operational entries unless explicitly required by the workflow.

---

# Real-Time Synchronization

The component should support real-time updates across clients.

Example:

* Provider sends proposal
* Client sees proposal component instantly
* Client accepts proposal
* Provider sees proposal component update immediately

The synchronization should feel live and reactive.

---

# Role-Aware Rendering

The component may render differently depending on:

* viewer role,
* permissions,
* workflow ownership.

Example:

## Provider View

May display:

* edit proposal action,
* resend proposal,
* revision request indicator.

## Client View

May display:

* accept proposal,
* reject proposal,
* request changes.

---

# Action Buttons

The component may contain contextual action buttons.

Examples:

* Accept
* Reject
* Request Revision
* Edit Proposal
* View Details

---

# Action Button Design

## Shape

* Rounded pill/capsule buttons.

---

## Hierarchy

* Primary actions visually emphasized.
* Secondary actions visually lighter.

---

## Interaction

Buttons should support:

* loading states,
* disabled states,
* success feedback,
* optimistic UI updates when appropriate.

---

# State Indicators

The component should visually communicate workflow status clearly.

Possible states:

* Pending Review
* Accepted
* Declined
* Expired
* Revision Requested
* Updated
* Cancelled

---

# State Visualization

States may be represented through:

* subtle color changes,
* status labels,
* icons,
* border accents,
* contextual text.

Color must never be the only state indicator.

---

# Loading States

The component must support:

* skeleton states,
* partial loading,
* optimistic updates,
* asynchronous refresh states.

---

# Error States

The component must gracefully handle:

* unavailable proposal data,
* deleted proposals,
* synchronization failures,
* permission issues.

Example:

```text id="jlwm2w"
Unable to load proposal information
```

---

# Responsive Behavior

## Mobile

The component should:

* stack naturally vertically,
* remain highly readable,
* support touch-friendly interactions,
* avoid excessive density.

---

## Desktop/Web

The component may:

* expand horizontally,
* display richer layouts,
* increase spacing,
* support hover interactions.

---

# Accessibility Considerations

The component must support:

* keyboard navigation,
* screen readers,
* proper semantic structure,
* accessible button labels,
* strong contrast ratios,
* dynamic text scaling.

Expanded/collapsed states must be properly announced to assistive technologies.

---

# Recommended Design Language

The component should feel:

* operational,
* trustworthy,
* modern,
* structured,
* and conversationally integrated.

It should resemble:

* a lightweight embedded workflow card,
  not
* a modal,
* enterprise table,
* or external system interruption.

The experience should feel native to the conversation flow itself.

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
<div class="flex flex-col items-end my-6 w-full">
<div class="w-[85%] bg-surface-container-low border border-outline-variant rounded-[18px] p-4 shadow-sm space-y-4">
<div class="flex justify-between items-start">
<div class="space-y-1">
<h3 class="font-header-title-mobile text-[16px] text-on-surface">Apartment Painting Proposal</h3>
<div class="flex flex-wrap gap-x-3 gap-y-1 text-[14px] font-message-text text-on-surface-variant">
<span class="flex items-center gap-1 font-semibold">Total: $450</span>
<span class="flex items-center gap-1 text-secondary">Duration: 3 days</span>
<span class="flex items-center gap-1 text-secondary">Valid until: Feb 18</span>
</div>
</div>
<span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap">
                Pending Review
            </span>
</div>
<div class="pt-2">
<button class="w-full bg-primary text-on-primary font-label-sm py-2.5 rounded-full hover:opacity-90 transition-opacity">
                View Details
            </button>
</div>
</div>
<div class="h-[1px] w-full bg-transparent mt-2"></div>
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