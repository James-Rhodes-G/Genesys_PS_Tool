# Feature Request: Common Module Dependency Discovery and Republish

## Objective

Create a new **Common Module Dependency Discovery** page that allows a user to select an Architect flow and identify every flow that currently or historically depends on that flow.

The primary use case is:

> A Common Module has been changed and republished. Show me which flows depend on it, identify which flows are safe to republish, and allow me to republish eligible flows individually or in bulk.

The feature must be designed around the existing PS Tool architecture and Genesys Spark UI.

This feature should not modify or replace existing flow execution functionality.

---

# Documentation Requirements (Mandatory)

Upon completion:

* Update `README.md`.
* Add the new feature to the appropriate feature list.
* Document all new API routes and client modules.
* Document dependency discovery behavior.
* Document flow republish behavior.
* Document validation and publish workflows.
* Document any new caching or session behavior.
* Update architecture documentation if new modules/components are introduced.
* Ensure the README accurately represents the completed implementation.

---

# Page Layout

Use a compact, horizontal desktop-oriented layout.

The page should prioritize horizontal screen real estate over vertical space while retaining sufficient whitespace to avoid a busy appearance.

## Selection Toolbar

Place the selection controls in a single horizontal row:

```text
Flow Type                  Flow                                      Search

[ Select Flow Type ▼ ]     [ Select Flow ▼....................... ] [ Search ]
```

### Flow Type options

The first dropdown must contain:

* Bot Flows
* Common Module Flows
* Inbound Flows
* In-Queue Flows

The second dropdown is dependent on the selected Flow Type.

Do not enable the second dropdown until a Flow Type has been selected.

When a Flow Type is selected:

* Load the available flows for that category.
* Populate the second dropdown.
* Display a loading indicator while the flow list is being retrieved.
* Do not perform dependency discovery yet.

Changing the Flow Type must reset the Flow selection and disable Search until a new Flow is selected.

---

# Search Button

The Search button must remain disabled until:

1. A Flow Type is selected.
2. A Flow is selected.

Selecting both values must enable Search.

Dependency discovery must not begin until the user explicitly clicks Search.

When Search is clicked:

* Disable Search.
* Show a loading indicator.
* Clear or replace the previous dependency results so there is no ambiguity about which search produced the current results.
* Run the dependency discovery request.

When complete:

* Re-enable Search.
* Display the results.

---

# Dependency Discovery

Use the Architect Dependency Tracking API.

Primary endpoint:

```http
GET /api/v2/architect/dependencytracking/consumingresources
```

Use the selected flow's dependency-tracking ID and object type.

For Common Modules, the object type is:

```text
COMMONMODULEFLOW
```

The implementation must support filtering the consuming resource results to the appropriate flow categories:

* Bot Flow
* Common Module Flow
* Inbound Call Flow
* In-Queue Call Flow

Use pagination where required.

Do not assume that one response contains every consuming resource.

Handle HTTP 206 responses appropriately. A 206 response may indicate that dependency tracking data is incomplete or being rebuilt. The UI must not silently present incomplete dependency results as definitive.

---

# Dependency Results

Display results below the selection toolbar.

Add a compact summary/action bar:

```text
Common Module: Customer Lookup
Dependent Flows: 24
Active Dependencies: 17
Republish Eligible: 14

[ Republish All (14) ]
```

The exact counts should be calculated from the returned data.

---

# Flow Result Cards

Each dependent flow is displayed as a collapsed card.

Cards should use the horizontal layout:

```text
▶ Flow Name ↗        Published v42        Active ✓        Eligible ✓        [ Republish ]
```

## Flow Name

The Flow Name must be a hyperlink.

Clicking the Flow Name should open the flow directly in Genesys Architect.

Open the Architect flow in a new browser tab so the dependency results remain available.

The Flow Name hyperlink must exist for:

* Active dependencies.
* Historical-only dependencies.
* Flows with newer unpublished versions.

---

# Current Version Definition

For this feature:

> **Current Version means the currently published version.**

Do not interpret the latest version number as the current version when that version has not been published.

The implementation must distinguish:

* Current published version.
* Older published versions.
* Newer unpublished versions.

Use the flow version API:

```http
GET /api/v2/flows/{flowId}/versions
```

to determine the flow's available version history.

---

# Result Ordering

Results must always be ordered as follows:

## 1. Active Dependencies

Flows whose current published version references the selected Common Module.

Sort alphabetically by Flow Name.

## 2. Historical / Inactive Dependencies

Flows whose current published version does not reference the selected Common Module, but whose historical versions did.

Sort alphabetically by Flow Name.

Do not intermix the two groups.

---

# Result Status Columns

Each flow card must show compact status indicators.

Display:

* Published Version
* Active Dependency
* Republish Eligibility

Use:

* `✓` for true/active.
* `✕` for false/inactive.

Example:

```text
▶ Customer Service ↗       Published v42       ✓       ✓       [ Republish ]
```

The first indicator answers:

> Does the current published version depend on the selected Common Module?

The second indicator answers:

> Is this flow eligible for republish?

---

# Republish Eligibility

A flow is eligible for republish only when:

1. The current published version depends on the selected Common Module.
2. No newer flow version exists after the current published version.

Eligible flow:

```text
▶ Customer Service ↗       Published v42       ✓       ✓       [ Republish ]
```

Not eligible:

```text
▶ Billing IVR ↗            Published v18       ✓       ✕
```

Historical-only:

```text
▶ Legacy Routing ↗         Published v31       ✕       ✕
```

No Republish button should be displayed for an ineligible flow.

---

# Newer Unpublished Versions

If the current published version depends on the selected Common Module but one or more newer versions exist after it, the flow remains an **active dependency**, but it is **not eligible for republish**.

Example:

```text
▶ Billing IVR ↗            Published v18       ✓       ✕
```

The card must be expandable.

When expanded, clearly identify:

* Current published version.
* Newer unpublished version(s).
* Which version contains the dependency.
* Why republish is unavailable.

Use a concise explanation such as:

```text
Republish unavailable.

The published version depends on this Common Module,
but a newer unpublished version exists.
```

Do not provide a Republish button.

Do not include the flow in Republish All.

---

# Historical-Only Dependencies

If the current published version does not depend on the selected Common Module, but one or more previous versions did:

* Display the card in the inactive/historical section.
* Render the card in a muted/greyed-out appearance.
* Display `Active Dependency: ✕`.
* Display `Republish Eligibility: ✕`.
* Do not display a Republish button.
* Keep the card expandable.

The purpose is to show why the flow was identified by dependency discovery even though it is not currently eligible for republish.

Expanded state should clearly show the historical versions that had the dependency.

Example:

```text
▼ Legacy Customer Routing ↗    Published v31    ✕    ✕

   Version       State         Dependency
   28            Historical       ✓
   27            Historical       ✓
   26            Historical       ✓
```

The inactive card itself must make it obvious that the dependency is historical only.

---

# Expanded Version History

When an active or inactive flow card is expanded:

Display the relevant flow versions.

At minimum show:

* Version
* State
* Dependency Status

Use states such as:

* Published
* Unpublished
* Historical

The version history should specifically explain why a flow is or is not available for republish.

Do not show unrelated versions unnecessarily.

For historical dependency cards, display historical versions that contain the dependency.

For active dependencies with newer unpublished versions, display those newer versions because their existence affects republish eligibility.

---

# Individual Republish

Eligible flow cards must contain a Republish button.

Example:

```text
▶ Customer Service ↗       Published v42       ✓       ✓       [ Republish ]
```

Clicking Republish must use the existing confirmation modal pattern.

Confirmation should identify:

* Flow Name.
* Current published version.
* Selected Common Module.

Do not begin checkout until the user confirms.

---

# Republish Workflow

The republish workflow must be implemented as a controlled sequence.

## Step 1 - Checkout

Checkout the eligible flow using:

```http
POST /api/v2/flows/actions/checkout
```

Use the selected flow.

The checkout response produces a new working version / version ID.

Capture that new version ID.

Do not assume that the existing published version ID remains the working version.

---

## Step 2 - Validate

Validate the checked-out flow using:

```http
POST /api/v2/flows/actions/validate?flow={flowId}&flowType={flowType}
```

Example:

```http
POST /api/v2/flows/actions/validate?flow=6d6582b2-f0a5-4408-b9ed-bd3f5305962b&flowType=inboundcall
```

Example response:

```json
{
  "id": "74bcb708-bc1c-4504-8b4f-681d7e6cd574",
  "complete": false,
  "actionName": "VALIDATE",
  "actionStatus": "STARTED"
}
```

The validation operation is asynchronous.

---

## Step 3 - Poll Validation Status

Poll:

```http
GET /api/v2/flows/{flowId}/validate/{validationJobId}
```

Continue polling until the validation completes.

Success example:

```json
{
  "id": "74bcb708-bc1c-4504-8b4f-681d7e6cd574",
  "complete": true,
  "actionName": "VALIDATE",
  "actionStatus": "SUCCESS",
  "flowId": "6d6582b2-f0a5-4408-b9ed-bd3f5305962b",
  "flowType": "INBOUNDCALL",
  "started": "2026-08-17T14:08:51.158Z",
  "completed": "2026-08-17T14:08:52.563Z",
  "results": {}
}
```

The implementation must not publish unless:

```text
complete == true
AND
actionStatus == SUCCESS
```

Validation results must be preserved for display/logging.

---

# Common Module Version Resolution

The purpose of checkout + validation is to allow Architect to resolve the currently available Common Module version for the checked-out flow before publishing.

Do not attempt to determine the selected Common Module version solely from the standard flow metadata.

The authoritative flow definition can be downloaded as YAML when needed for inspection.

The implementation should not require YAML parsing for the normal republish workflow unless it is needed for validation or troubleshooting.

---

# Validation Failure

If validation fails:

* Do not publish.
* Mark the republish attempt as failed.
* Display the validation failure.
* Preserve the checked-out version.
* Do not retry publishing automatically.

Unexpected or malformed validation responses must also fail safely without publishing.

---

# Step 4 - Publish

Only after successful validation, publish the checked-out version.

Use:

```http
POST /api/v2/flows/actions/publish
```

Provide:

* Flow ID.
* Checked-out version ID.

The publish operation is asynchronous.

Track the publish operation until completion.

Do not report success until the publish operation completes successfully.

---

# Republish Progress

Individual republish should display progress through:

```text
Checkout
   ↓
Validate
   ↓
Publish
   ↓
Complete
```

For each stage, display:

* Current state.
* Success.
* Failure.
* Error details where available.

Use the application's existing progress/reporting patterns.

---

# Republish All

A button must always be visible at the top of the results when eligible flows exist.

Example:

```text
[ Republish All (14) ]
```

Republish All includes only flows where:

* Active Dependency = `✓`
* Republish Eligibility = `✓`

Explicitly exclude:

* Historical-only dependencies.
* Flows with newer unpublished versions.
* Any other ineligible flow.

Before execution, display a confirmation modal showing:

```text
Eligible flows: 14

Excluded:
3  Newer unpublished version
2  Historical dependency only

14 flows will be republished.
```

The button label should reflect the number of eligible flows.

---

# Bulk Republish Execution

Use the application's existing bulk-workflow patterns.

Requirements:

* Progress indicator.
* Individual flow status.
* Success count.
* Failure count.
* Failure reason.
* Final summary.
* CSV export if consistent with existing bulk-action result behavior.

Each flow must independently go through:

```text
Checkout
→ Validate
→ Publish
```

One failure must not prevent other eligible flows from continuing unless the existing bulk-action architecture requires an explicit stop behavior.

Do not publish any flow whose validation fails.

---

# Error Handling

Handle:

* Dependency API errors.
* Pagination errors.
* HTTP 206 / incomplete dependency tracking.
* Flow version retrieval errors.
* Checkout failures.
* Validation failures.
* Validation timeouts.
* Publish failures.
* Publish timeouts.
* Invalid/missing version IDs.
* Unexpected API response shapes.

Do not display incomplete dependency results as complete.

---

# Loading States

Provide visible loading indicators for potentially slow operations.

Required loading states:

* Loading Flow Type flow list.
* Dependency discovery.
* Checkout.
* Validation.
* Publish.
* Republish All.

The interface must make it obvious when an operation is still running.

Disable duplicate actions while an operation is in progress.

---

# Result Refresh

After a successful republish:

* Update the flow's displayed published version.
* Update dependency/eligibility status where practical.
* Do not require the user to repeat the entire dependency selection process just to see the immediate result.
* Preserve the user's current page context.

---

# UI Design

Use Genesys Spark components.

Favor horizontal screen usage over vertical stacking.

The overall page should feel compact but not crowded.

Preferred layout:

```text
Flow Type                   Flow                                      Search
[ Common Module Flows ▼ ]   [ Customer Lookup ▼.................... ] [ Search ]

Customer Lookup    24 flows    17 active    14 eligible       [ Republish All (14) ]

▶ Customer Service ↗       Published v42     ✓     ✓     [ Republish ]
▶ Billing IVR ↗            Published v18     ✓     ✕
▶ Support Routing ↗        Published v27     ✓     ✓     [ Republish ]

▶ Legacy Routing ↗         Published v31     ✕     ✕
▶ Old Customer Flow ↗      Published v16     ✕     ✕
```

Inactive/historical cards should use a muted appearance.

Do not create unnecessary large sections or vertical whitespace.

---

# Architecture

Follow the existing application architecture.

Business logic:

```text
src/lib/*
```

Express routes:

```text
src/routes/*
```

Browser behavior:

```text
public/js/*
```

Keep Express routes thin.

Create reusable dependency-discovery and republish services rather than embedding the logic directly in UI code.

---

# Internal Data Model

Create a normalized dependency result model so the UI does not depend directly on Genesys response structures.

Each flow result should contain enough information to determine:

* flow ID
* flow name
* flow type
* current published version
* available versions
* active dependency status
* historical dependency versions
* newer unpublished versions
* republish eligibility
* eligibility reason
* Architect URL

Use explicit internal eligibility states, for example:

```text
ELIGIBLE
NEWER_VERSION_EXISTS
HISTORICAL_DEPENDENCY_ONLY
```

The UI should map these states to the appropriate check marks, muted styling, and button visibility.

---

# Testing Requirements

Add tests for:

## Dependency Discovery

* Correct Common Module lookup.
* Correct flow category filtering.
* Pagination.
* Active dependency identification.
* Historical-only dependency identification.
* HTTP 206 handling.

## Version Analysis

* Current published version detection.
* Historical dependency detection.
* Newer unpublished version detection.
* Republish eligibility.

## Checkout

* Correct checkout request.
* New version ID extraction.
* Checkout failure handling.

## Validation

* Validation request.
* Validation polling.
* Successful validation.
* Failed validation.
* Timeout behavior.
* Publish prevention after validation failure.

## Publish

* Correct version ID passed to publish.
* Publish polling.
* Successful publish.
* Publish failure handling.

## Bulk Republish

* Only eligible flows are selected.
* Historical-only flows are excluded.
* Flows with newer unpublished versions are excluded.
* One failed flow does not incorrectly report as successful.
* Final success/failure counts are accurate.

---

# Standard Project Requirements

* Update `README.md`.
* Preserve existing functionality.
* Use existing Genesys Spark components.
* Follow existing coding conventions.
* Add logging and appropriate error handling.
* Reuse existing bulk workflow/progress infrastructure where appropriate.
* Keep new functionality modular and extensible.
* Do not introduce breaking changes.

---

# Expected Deliverables

* Common Module Dependency Discovery page.
* Flow Type selector.
* Flow selector.
* Dependency Search workflow.
* Dependency results and summary.
* Alphabetically ordered active/inactive groups.
* Expandable flow cards.
* Flow hyperlinks to Architect.
* Published/newer/historical version display.
* Active Dependency and Republish Eligibility indicators.
* Individual Republish.
* Republish All.
* Checkout workflow.
* Validation workflow.
* Validation polling.
* Publish workflow.
* Bulk progress/results.
* Error handling.
* Automated tests.
* README update.

The completed feature should allow a Professional Services user to select a Common Module, immediately understand which flows are affected, distinguish active versus historical dependencies, identify flows that are unsafe to republish because newer unpublished work exists, and safely republish eligible flows using the Genesys checkout → validate → publish workflow.
