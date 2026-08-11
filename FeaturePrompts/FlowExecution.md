
# Feature Request: Architect Execution Timeline Viewer

## Objective

Create a new **Architect Execution Timeline Viewer** that provides a simplified, searchable, card-based visualization of Architect execution history for a single conversation.

This viewer is **not** intended to replace the native Genesys Replay Mode. Instead, it should provide a faster, more intuitive, and more powerful way to understand execution history through chronological execution cards, variable tracking, search, and intelligent navigation.

The existing Flow Execution functionality must remain intact.

---

# Documentation Requirements (Mandatory)

Upon completion:

- Update the project README.md.
- Document the new Architect Execution Timeline Viewer.
- Document all new API routes.
- Document new parser modules.
- Document new UI pages.
- Document caching behavior.
- Update architecture documentation.
- Update the project feature list.
- Ensure the README accurately reflects the completed implementation.

---

# Existing Functionality

The current Flow Execution page already exists.

Do NOT replace or modify the existing functionality.

The new viewer is an additional capability.

---

# User Workflow

1. User enters a Conversation ID.
2. System queries matching Flow Executions.
3. System displays a Flow Selection page.
4. User chooses:
   - Open in Genesys
   - Open in PS Tool
5. If PS Tool is selected:
   - Download execution history.
   - Parse execution.
   - Build internal execution model.
   - Display Architect Execution Timeline Viewer.

This workflow should always be followed, even if only a single Flow Execution exists.

Never automatically open the execution.

---

# Flow Execution Lookup

Use the existing Genesys Flow Instance APIs.

Step 1

POST

/api/v2/flows/instances/query

Example:

```json
{
  "query": [
    {
      "criteria": {
        "key": "ConversationId",
        "operator": "eq",
        "value": "<conversationId>"
      }
    }
  ]
}
```

Step 2

Display returned Flow Executions.

Step 3

Follow the existing asynchronous download workflow:

Flow Instance

↓

Job

↓

Job Status

↓

downloadUri

↓

Rendered Execution JSON

---

# Flow Selection Page

Always display the Flow Selection page.

Columns:

- Flow Name
- Flow Type
- Flow Version
- Start Time
- End Time
- Duration
- Error Status
- Warning Status

Actions:

Open in Genesys

Open in PS Tool

The existing Genesys functionality should continue to work unchanged.

The PS Tool viewer is an additional option.

---

# Execution Download

Download the rendered execution JSON once.

Store the downloaded JSON in session memory while the viewer is open.

Do NOT repeatedly download execution history during:

- Searching
- Variable Tracking
- Card Expansion
- Error Navigation

All interaction should operate against the cached execution model.

---

# Execution Parser

Create a dedicated parser responsible for converting the raw Genesys execution JSON into an internal execution model.

The UI must NEVER consume the raw Genesys JSON directly.

Architecture:

Genesys Execution JSON

↓

Execution Parser

↓

Internal Execution Model

↓

Execution Timeline Viewer

This abstraction is required to isolate the UI from future changes in the Genesys execution schema.

---

# Internal Execution Model

Create a reusable internal model representing execution items.

Example:

```typescript
ExecutionNode
{
    trackingId,
    actionType,
    actionName,
    timestamp,
    duration,
    taskName,
    commonModuleName,
    actionId,
    executionId,
    inputData,
    outputData,
    variables,
    children,
    metadata
}
```

The parser should preserve:

- chronological execution order
- nested tasks
- nested common modules
- variables
- action metadata
- tracking IDs
- output paths
- execution timing

---

# Parser Requirements

The parser must:

- Preserve chronological order.
- Preserve nested execution.
- Preserve trackingId.
- Preserve action type.
- Preserve action name.
- Preserve variables.
- Preserve input/output data.
- Preserve metadata.
- Preserve output paths.

Unknown action types must not cause failures.

Unknown actions should still render using:

- raw action key
- trackingId
- metadata
- variables

---

# Execution Summary

Always visible.

Pinned to the top of the page.

Display:

Conversation ID

Execution ID

Flow Name

Flow Type

Flow Version

Start Time

End Time

Execution Time

Actions Executed

Errors

Warnings

Flow Exit Reason

Buttons:

Go To First Error

Expand All

Collapse All

Tracked Variables

Search

---

# Timeline

Execution cards must remain in chronological execution order.

Cards must NEVER be sorted.

Cards must NEVER be reordered.

Searching highlights cards but never changes execution order.

---

# Card Layout

Collapsed

Display:

Action Number (trackingId)

Action Type

Action Name

Timestamp

Duration (if available)

Result / Output Path

Example:

-------------------------------------------------

[74]

Decision

Customer Found?

TRUE

14:50:35.341

-------------------------------------------------

Expanded

Display:

Action Number

Action Type

Action Name

Action ID

Execution ID

Task Name

Common Module Name

Timestamp

Duration

Input Data

Output Data

Output Variables

Variables

Metadata

Errors

Warnings

Output Path

---

# Task / Common Module Grouping

Tasks and Common Modules become parent cards.

Collapsed:

Common Module

Schedule Check

12 Actions

143 ms

Expanded:

Displays every execution step inside the module.

Execution order remains unchanged.

Nested modules must be supported.

---

# Search

Search by:

Action Name

Action Type

Search behavior:

- Highlight matching cards.
- Automatically expand parent Tasks/Common Modules containing matches.
- Never filter cards.
- Never reorder cards.

Provide:

Previous Match

Next Match

Match Count

---

# Variable Discovery

When execution is parsed:

Walk the entire execution tree.

Collect every unique variable.

Build a searchable variable index.

Variables should be searchable by name.

---

# Variable Tracking

Allow users to select one or more variables to track.

Provide two display modes.

## Variables Changed

Display only variables modified during the current action.

Highlight actions that changed tracked variables.

## Tracked Variables

Display selected tracked variables on every card.

If the variable changes:

Previous Value

↓

New Value

If unchanged:

Display current value.

Support:

- multiple tracked variables
- Flow variables
- Task variables
- Common Module variables

Handle:

null values

valueIsTooLarge

redacted values

---

# Error Navigation

If errors exist:

Display:

Go To First Error

If multiple:

Provide an error selector.

Selecting an error should:

- Scroll directly to the error.
- Expand all parent Tasks/Common Modules.
- Expand the error card.
- Highlight the card.

---

# Navigation

Support:

Expand All

Collapse All

Previous Match

Next Match

Go To Error

Execution order must remain unchanged.

---

# Action Type Registry

Create a registry mapping execution JSON types to display metadata.

Example:

actionDecision

↓

Decision

actionTransferToAcd

↓

Transfer to ACD

Unknown action types should still render gracefully.

---

# Performance

Requirements:

Download execution once.

Parse execution once.

Build execution model once.

Build variable index once.

Lazy render large execution histories (virtual scrolling if appropriate).

Never re-parse execution during:

- search
- expansion
- navigation
- variable tracking

---

# Existing Flow Execution Compatibility

Do NOT replace existing Flow Execution functionality.

The Flow Selection page must always provide:

Open in Genesys

Open in PS Tool

Both capabilities must coexist.

---

# UI Requirements

Use existing Genesys Spark components.

Match the application's current styling.

Use color-coded Action Types where appropriate.

Example:

Flow Start

Flow End

Decision

Data Action

Transfer

Prompt

Collect Input

Loop

Common Module

Error

Cards should maintain consistent spacing and typography.

---

# Parser Unit Tests (Required)

Create unit tests verifying:

## Timeline Construction

- Chronological ordering using trackingId.
- Nested Task grouping.
- Nested Common Module grouping.
- Nested execution ordering.

## Action Parsing

- Known action types.
- Unknown action types.
- Action Name extraction.
- Action Type extraction.
- trackingId extraction.

## Variable Handling

- Variable discovery.
- Variable indexing.
- Variable change detection.
- Current value reconstruction.
- null values.
- valueIsTooLarge handling.

## Navigation

- Error detection.
- Go To Error target.
- Search by Action Name.
- Search by Action Type.
- Parent expansion.

## Large Executions

- Large execution parsing.
- Memory usage.
- Variable indexing.
- Execution ordering.

---

# Standard Project Requirements

- Update README.md.
- Preserve existing architecture.
- Keep business logic inside src/lib.
- Keep Express routes thin.
- Keep browser behavior inside public/js.
- Follow existing coding conventions.
- Add appropriate logging.
- Add appropriate error handling.
- Reuse existing infrastructure where practical.
- Avoid breaking existing functionality.
- Design all new components to be reusable and extensible.

---

# Expected Deliverables

- Conversation ID entry workflow
- Flow Selection page
- Flow Execution download service
- Execution parser
- Internal execution model
- Action Type registry
- Variable discovery engine
- Variable tracking engine
- Search engine
- Card-based execution viewer
- Task/Common Module grouping
- Error navigation
- Expand/Collapse support
- Parser unit tests
- README update

The completed feature should provide a significantly more efficient execution analysis experience than the native Genesys Replay Mode while remaining fully compatible with the existing Flow Execution functionality.