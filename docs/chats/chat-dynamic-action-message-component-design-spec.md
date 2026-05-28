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
