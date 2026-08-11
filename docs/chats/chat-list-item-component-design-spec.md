## Chat List Item Component — Detailed Design Specification

The chat list item is a compact, touch-friendly conversation preview component designed for a service marketplace platform such as Prestway. Its purpose is to give users a quick understanding of:

* who they are talking to,
* which service request the chat belongs to,
* and the latest activity in the conversation.

The component should feel modern, clean, highly scannable, and optimized for mobile-first usage.

---

# Overall Layout

The component is structured as a **horizontal card row** with the following layout:

```text
[ Service Icon ]
        [ User Avatar ]
[ Text Content Section ................ ] [ Timestamp ]
```

The component occupies the full available width of the list container and has:

* rounded corners,
* subtle background contrast,
* soft spacing,
* high readability,
* and clear visual hierarchy.

The entire component is tappable/clickable.

---

# Container Specifications

### Shape

* Rounded rectangle container.
* Border radius: approximately `14px–18px`.

### Height

* Fixed or semi-flexible height.
* Recommended: `76px–92px`.

### Width

* Full width of parent container with horizontal padding.

### Padding

* Internal padding:

  * Vertical: `10px–12px`
  * Horizontal: `12px–14px`

### Background

Two states:

#### Default State

* Neutral/light surface color.
* Example:

  * `#FFFFFF`
  * or slightly tinted neutral.

#### Active/Unread State

* Slightly elevated background tint.
* Example:

  * light gray/blue surface.
* Should feel subtle, not aggressive.

### Hover / Press Feedback

* Slight darkening/lightening.
* Very soft scaling or opacity feedback.
* Fast transition (~150ms).

---

# Left Visual Stack

The left side contains a layered visual identity composed of:

1. Service icon/image
2. User avatar

This creates immediate contextual understanding.

---

# Service Icon

### Purpose

Represents the service category associated with the conversation.

Examples:

* Plumbing
* Painting
* Electrician
* Interior design
* Furniture assembly

### Placement

* Positioned at the far left.
* Slightly behind or above the avatar stack.

### Shape

* Rounded square or soft rounded rectangle.
* Radius: `10px–14px`.

### Size

* Approximately `42px–52px`.

### Visual Style

Can be:

* an illustrated icon,
* category thumbnail,
* or real service image.

Should have:

* subtle shadow,
* muted/sophisticated colors,
* good contrast.

### Behavior

Static visual element.

---

# User Avatar

### Purpose

Represents the other participant in the chat.

The avatar changes dynamically depending on who is viewing the conversation:

* Client sees provider avatar.
* Provider sees client avatar.

### Placement

* Overlapping the service icon.
* Positioned partially at the bottom-right corner of the service image.

### Shape

* Perfect circle.

### Size

* Approximately `28px–36px`.

### Border

* Thin white border (`2px–3px`) to separate from background.

### Fallback State

If no profile image exists:

* Use colored circular background.
* Centered user initial.

Example:

```text
K
```

### Elevation

* Slight shadow for separation.

---

# Main Content Section

This is the primary information area.

It is vertically organized into multiple text rows.

---

# First Row — User Name + Timestamp

```text
Karen                               09:02
```

### User Name

Represents:

* provider name,
* or client name.

### Typography

* Font weight: Medium/Semibold.
* Font size: `14px–16px`.

### Color

* Primary text color.
* High contrast.

### Behavior

* Single line only.
* Ellipsis if too long.

---

### Timestamp

Shows:

* latest message time,
* or latest interaction time.

### Alignment

* Top-right aligned.

### Typography

* Smaller font.
* `11px–12px`.

### Color

* Muted gray.

### Behavior

* Never wraps.

---

# Second Row — Service Name

```text
Apartment Painting Service
```

### Purpose

Clearly identifies which service request the conversation belongs to.

### Typography

* Slightly smaller than username.
* Medium weight.

### Color

* Secondary text color.

### Behavior

* Single line preferred.
* Ellipsis truncation if needed.

### Spacing

* Small vertical spacing from first row.

---

# Third Row — Last Message Preview

Below the service name, the component shows the latest message exchanged in the conversation.

Example:

```text
"Can you send more photos of the kitchen?"
```

### Purpose

Provides immediate conversational context without requiring the user to open the chat.

### Typography

* Small font size.
* Neutral gray color.
* Lower visual priority than username and service name.

### Behavior

* Single line only.
* Ellipsis truncation if needed.
* Should gracefully handle:

  * long messages,
  * emojis,
  * attachments,
  * system messages.

### Message Types

The preview may display:

* Plain text messages
* Image/file indicators
* Voice message indicators
* System events

Examples:

```text
📷 Photo
Proposal submitted
Proposal received
Service request updated
```

---

# Unread Message Indicator

Optional enhancement.

### Style

Small colored dot.

### Placement

* Near timestamp
  or
* right edge center.

### Behavior

Visible only if:

* unread messages exist.

### Color

* Brand accent color.

---

# Interaction Behavior

## Tap Behavior

Opens the conversation screen.

---

# Visual Hierarchy Priorities

The component should prioritize information in this order:

1. User identity
2. Service context
3. Latest activity/message
4. Timestamp

---

# Design Language

The component should communicate:

* professionalism,
* trust,
* operational clarity,
* modern marketplace UX,
* and lightweight communication flow.

The visual style should resemble a blend between:

* WhatsApp conversation list simplicity,
* Airbnb cleanliness,
* and modern service marketplace interfaces.

---

# Recommended Design Characteristics

## Spacing

Generous and breathable.

## Shadows

Very subtle.

## Borders

Minimal or invisible.

## Colors

Neutral base palette with controlled accent colors.

## Typography

Clean sans-serif:

* Inter
* SF Pro
* or similar modern UI font.

## Motion

Soft and fast transitions.

---

# Responsive Behavior

## Mobile

Primary target.

Optimized for:

* thumb navigation,
* fast scanning,
* dense conversation lists.

## Tablet/Desktop

Can slightly increase:

* spacing,
* avatar sizes,
* typography scale.

---

# Accessibility Considerations

* Minimum touch target: `44px`.
* Strong text contrast.
* Support dynamic text scaling.
* Avatar fallback initials should remain readable.
