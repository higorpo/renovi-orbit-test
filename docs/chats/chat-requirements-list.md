# Chat System UI/UX Requirements Checklist

## Chat List Screen

1. A chat list screen must exist to display all active and historical conversations.

2. The chat list must support both mobile and desktop/web layouts.

3. Each chat item must display:

   * the service icon/image,
   * the other participant avatar,
   * participant name,
   * service name,
   * latest message preview,
   * latest interaction timestamp.

4. The participant avatar must dynamically change depending on the viewer:

   * client sees provider avatar,
   * provider sees client avatar.

5. The service icon/image must represent the service category or request associated with the conversation.

6. The chat list item must support unread conversation states.

7. Unread conversations should optionally display:

   * background highlight,
   * unread indicator,
   * or other subtle visual emphasis.

8. The latest message preview must support:

   * plain text,
   * image/file indicators,
   * voice message indicators,
   * system messages.

9. Long participant names, service names, and messages must truncate gracefully using ellipsis.

10. The entire chat list item must be fully clickable/tappable.

11. Chat list items must support responsive layouts.

12. The chat list must support vertical scrolling with smooth performance.

13. The chat list should auto-update when new messages arrive.

14. The chat list should reorder conversations based on latest activity.

15. The chat list must support empty states when no conversations exist.

---

# Chat Screen Structure

16. A dedicated chat screen must exist for each conversation.

17. The chat screen must contain:

* fixed header,
* scrollable conversation area,
* fixed message input area.

18. The chat screen must support both mobile and desktop/web experiences.

19. The chat screen must support safe areas for:

* mobile notches,
* status bars,
* gesture navigation.

20. The conversation area must resize correctly when the keyboard opens.

21. The keyboard must never overlap:

* latest messages,
* input field,
* send button.

22. The chat screen must automatically scroll to the latest message when opened.

23. The conversation area must support infinite vertical scrolling.

24. The chat screen must support grouped messages for better visual organization.

---

# Chat Header

25. The chat header must contain:

* back button,
* participant avatar,
* participant name,
* service name,
* details button.

26. The header must remain fixed/sticky during conversation scrolling.

27. The back button must navigate to the previous screen or chat list.

28. The participant avatar must be fully circular.

29. The avatar must support:

* uploaded image,
* fallback initials.

30. The participant name must be centered below the avatar.

31. The service name must appear below the participant name.

32. The service name should help identify which service request the chat belongs to.

33. The details button must exist in the top-right corner of the header.

34. The details button must open a detailed contextual panel or screen.

35. The details area may later contain:

* proposal information,
* service request details,
* scheduling information,
* attachments,
* operational actions.

---

# Chat Action Banner

36. A contextual action banner must exist below the chat header.

37. The banner must dynamically adapt based on:

* user role,
* proposal state,
* negotiation state,
* operational workflow state.

38. The banner must contain:

* short contextual description,
* primary CTA button,
* dismiss/close button.

39. The banner must show only one active contextual action at a time.

40. The banner must prioritize the most important pending action.

41. The banner dismiss action must only hide the banner temporarily.

42. The banner must reappear if the user leaves and reopens the chat screen.

43. The banner must support different states for:

* provider without proposal,
* provider with revision request,
* client with proposal received,
* client without pending actions,
* additional future workflow states.

44. The CTA button must trigger the relevant operational flow.

45. The banner must visually integrate with the chat interface without feeling intrusive.

---

# Conversation Messages

46. The conversation area must support:

* incoming messages,
* outgoing messages,
* system messages.

47. Incoming messages must appear on the left side.

48. Outgoing messages must appear on the right side.

49. Message bubbles must support:

* text messages,
* emojis,
* multiline content,
* image attachments,
* future attachment types.

50. Incoming and outgoing messages must have visually distinct bubble styles.

51. Message bubbles must support grouped visual layouts.

52. Message metadata must support:

* timestamp,
* delivery state,
* read state.

53. System messages must appear centered in the conversation.

54. System messages must support operational events such as:

* inquiry declined,
* proposal submitted,
* booking confirmed,
* proposal updated.

55. Date separators must exist between chronological message groups.

56. Date separators must remain visually lightweight.

57. The conversation area must support long conversations efficiently.

---

# Message Input Area

58. A fixed message input area must exist at the bottom of the screen.

59. The message input area must contain:

* photo attachment button,
* text input field,
* send button.

60. The message input area must remain visible while typing.

61. The text input field must support:

* multiline text,
* pasted content,
* emojis.

62. The text input field must expand vertically up to a safe maximum height.

63. The placeholder text should guide the user naturally.

64. The send button must be circular.

65. The send button must use the platform primary color.

66. The send button icon must point upward.

67. The send button should support disabled state when no message exists.

68. The photo attachment button must open:

* gallery,
* camera,
* or attachment picker.

69. The attachment button must support future extensibility for additional file types.

---

# Responsiveness & Desktop Adaptation

70. Desktop/web layout must include:

* persistent chat sidebar,
* active conversation panel.

71. Desktop layouts must preserve the same visual hierarchy as mobile.

72. Desktop layouts may increase:

* spacing,
* typography scale,
* message widths.

73. Desktop interactions should support hover states.

74. Desktop layouts must remain responsive across different resolutions.

---

# Accessibility & UX

75. All touch targets must have minimum accessible sizing.

76. Text contrast must meet accessibility standards.

77. Color must never be the only contextual indicator.

78. All interactive elements must support focus states on desktop.

79. The interface must support screen readers.

80. Dynamic text scaling must not break layouts.

81. Motion and animations must remain subtle and non-disruptive.

82. The interface must prioritize readability and low cognitive load.

83. Long content must degrade gracefully without breaking layouts.

84. Avatar fallback states must remain visually readable.

85. Loading states and skeleton states should exist for asynchronous content.

86. Error states should exist for:

* failed message sending,
* failed attachment upload,
* unavailable conversation data.

87. Real-time updates must feel immediate and responsive.

88. The overall design language must communicate:

* trust,
* clarity,
* professionalism,
* operational simplicity,
* and modern marketplace UX.

----

# Dynamic Chat Action Message Component — Requirements & Technical Behavior Checklist

## Core Architecture

1. The chat system must support multiple message types beyond plain text messages.

2. Messages must support dynamic rendering based on a message type identifier.

3. The rendering system must be schema-driven and extensible.

4. The system must support both:

   * static messages,
   * and dynamic operational messages.

5. Dynamic operational messages must be rendered as specialized UI components inside the chat timeline.

6. Dynamic message components must remain embedded directly inside the conversation history.

7. Dynamic messages must preserve chronological positioning even after state updates.

8. The system must avoid creating duplicate operational messages unnecessarily.

9. The same dynamic message entity should evolve visually according to workflow changes.

10. The rendering system must support future extensibility for additional workflow-driven message types.

---

# Supported Initial Dynamic Message Types

11. The system must initially support proposal-related dynamic messages.

12. Proposal-related messages must support:

* proposal sent,
* proposal updated,
* proposal revision requested,
* proposal accepted,
* proposal rejected,
* proposal expired,
* proposal cancelled.

13. The architecture must support future dynamic message types such as:

* scheduling requests,
* payment requests,
* milestone approvals,
* booking confirmations,
* cancellation workflows,
* dispute workflows,
* review requests.

---

# Message Rendering Architecture

14. Each chat message must contain a message type field.

15. Example message types may include:

* text,
* image,
* system,
* proposal,
* workflow_action,
* attachment,
* future custom types.

16. The frontend renderer must dynamically choose the correct UI component based on the message type.

17. Dynamic messages must support custom rendering logic independent from standard chat bubbles.

18. The rendering engine must support polymorphic rendering behavior.

19. The renderer must support fallback states for unsupported or deprecated message types.

20. Unknown message types must fail gracefully without breaking the chat timeline.

---

# Suggested Database Structure

21. The chat_messages table should support:

* id,
* conversation_id,
* sender_user_id,
* message_type,
* created_at,
* updated_at,
* payload,
* linked_entity_type,
* linked_entity_id.

22. The payload field should support structured JSON storage.

23. The payload should contain lightweight render-related information.

24. The payload should not duplicate authoritative business data unnecessarily.

25. Dynamic operational messages should reference authoritative workflow entities through linked IDs.

---

# Suggested Example Structure

26. A proposal message may reference:

* proposal_id,
* proposal_version_id,
* workflow_state.

Example:

```json id="swifph"
{
  "message_type": "proposal",
  "linked_entity_type": "proposal",
  "linked_entity_id": "proposal_123",
  "payload": {
    "summary": {
      "total_price": 450,
      "estimated_duration": "3 days"
    }
  }
}
```

---

# Source of Truth

27. The proposal entity itself must remain the authoritative source of truth.

28. The dynamic message component must hydrate itself using linked operational entities.

29. The chat message should not become the primary owner of workflow state.

30. Proposal state changes should automatically propagate to linked chat components.

31. State synchronization should occur reactively whenever workflow entities change.

---

# Dynamic State Synchronization

32. Dynamic messages must automatically re-render when linked entities change state.

33. Proposal acceptance must automatically update:

* client view,
* provider view,
* historical message rendering.

34. Proposal rejection must update the existing dynamic component instead of generating duplicate operational cards when appropriate.

35. Proposal revision requests must update the original proposal message state.

36. Dynamic messages must support real-time synchronization across devices.

37. Real-time updates should feel immediate and reactive.

38. State updates must preserve scroll stability whenever possible.

---

# Proposal Rendering Requirements

39. Proposal messages must display summarized proposal information.

40. Proposal summaries may include:

* total price,
* estimated duration,
* expiration date,
* short description,
* revision state.

41. Proposal summaries must remain concise and highly scannable.

42. The component must support expandable details.

43. Expanded proposal state may contain:

* scope breakdown,
* pricing details,
* included services,
* exclusions,
* notes,
* attachments,
* revision history.

44. Expanded content should render inline whenever possible.

45. Expansion state should animate smoothly.

46. Expansion interactions must preserve chat scroll position.

---

# Role-Aware Rendering

47. The component must render differently depending on the viewer role.

48. Provider-side rendering may support:

* edit proposal,
* resend proposal,
* revision visibility.

49. Client-side rendering may support:

* accept proposal,
* reject proposal,
* request revision.

50. Users must only see actions permitted by their role and workflow state.

---

# Action Handling

51. Dynamic message components must support embedded CTA actions.

52. CTA actions may include:

* Accept,
* Reject,
* Edit,
* Request Revision,
* View Details.

53. Action buttons must support:

* loading states,
* disabled states,
* optimistic updates,
* error recovery.

54. Actions must trigger workflow mutations safely and atomically.

55. Workflow updates must synchronize across all connected clients.

---

# UI/UX Requirements

56. Dynamic messages must visually differentiate themselves from regular messages.

57. The component should feel like an operational workflow card.

58. The component must remain visually integrated with the conversation.

59. Dynamic cards should support:

* rounded containers,
* soft elevation,
* contextual backgrounds,
* status indicators.

60. Message cards must support responsive layouts.

61. The component must remain highly readable on small mobile screens.

62. Long content must degrade gracefully.

63. Dynamic cards must support touch-friendly interactions.

---

# State Visualization

64. The component must visually communicate operational state.

65. Supported visual states may include:

* Pending Review,
* Accepted,
* Declined,
* Expired,
* Revision Requested,
* Updated,
* Cancelled.

66. State indicators may use:

* labels,
* icons,
* border accents,
* contextual text,
* background changes.

67. Color alone must never communicate workflow state.

---

# Historical Integrity

68. Dynamic messages must preserve historical continuity.

69. State changes must update existing operational cards whenever possible.

70. Timeline chronology must remain intact after updates.

71. Historical operational events must remain traceable.

72. The system must support proposal version history.

73. Previous proposal revisions may need historical retrieval later.

---

# Real-Time Infrastructure

74. The chat system must support real-time event subscriptions.

75. Workflow entity changes must trigger chat UI updates.

76. Real-time events may include:

* proposal_updated,
* proposal_accepted,
* proposal_rejected,
* revision_requested.

77. The frontend must reconcile optimistic state with server-confirmed state.

78. Real-time synchronization must avoid duplicate renders.

---

# Error Handling

79. Dynamic messages must gracefully handle unavailable linked entities.

80. The system must support fallback rendering for deleted proposals.

81. Synchronization failures must not break chat rendering.

82. Failed operational actions must provide user feedback.

83. Partial loading states must remain visually stable.

---

# Loading States

84. Dynamic cards must support loading placeholders.

85. Expanded proposal details may load asynchronously.

86. Skeleton states should exist for incomplete data hydration.

87. The interface should avoid layout shifts during loading.

---

# Permissions & Security

88. Users must only access proposal data associated with their conversation.

89. Proposal visibility must respect authorization rules.

90. Dynamic message actions must validate permissions server-side.

91. Hidden or unauthorized workflow entities must not leak sensitive data.

---

# Responsiveness

92. Mobile layouts must prioritize:

* readability,
* vertical stacking,
* touch interactions.

93. Desktop layouts may:

* increase width,
* improve spacing,
* add hover interactions.

94. Expanded proposal layouts must remain responsive across screen sizes.

---

# Accessibility

95. Dynamic components must support keyboard navigation.

96. Expand/collapse states must be screen-reader accessible.

97. Buttons must contain accessible labels.

98. Focus states must exist for all interactive elements.

99. Dynamic updates should remain understandable to assistive technologies.

100. The component must support dynamic text scaling without layout breakage.

---

# Performance Considerations

101. Dynamic rendering should avoid unnecessary re-renders.

102. Operational messages should hydrate lazily when appropriate.

103. Expanded proposal content may load on demand.

104. Real-time synchronization must remain performant in long conversations.

105. The chat timeline must support virtualization if message volume becomes large.

106. Dynamic operational components must not significantly degrade scroll performance.

---

# Recommended Technical Architecture

107. Dynamic operational messages should behave as lightweight timeline references to authoritative workflow entities.

108. Workflow entities should live in dedicated domain tables separate from chat_messages.

109. The chat timeline should act as:

* a conversational layer,
* and a workflow event surface.

110. The rendering layer should resolve operational entities dynamically during hydration/rendering.

111. The architecture should remain modular enough to support future workflow-driven message components without requiring major chat refactors.
