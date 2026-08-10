
# Feature Request: Organization Dashboard

## Objective

Add a new **Dashboard** page to the Genesys Professional Services Tool that becomes the landing page after a successful connection.

The dashboard should provide an at-a-glance health summary of the connected organization while remaining fast, modular, and easy to expand with additional widgets in the future.

This page is intended to be **read-only**. It should summarize the organization and provide drill-down links into the existing exports and workflows. It should not duplicate existing functionality or become another page for performing administrative actions.

---

# Navigation

After a successful connection:

* Automatically navigate to the Dashboard.
* Add a new **Dashboard** item as the **first item** in the existing left navigation.
* Do **not** rename, reorder, or otherwise modify any existing navigation items.
* The current landing page should remain unchanged and accessible through the existing menu.

---

# Architecture

The dashboard must be built as a collection of independent widgets.

Each widget should be completely self-contained and expose a consistent interface.

Example:

```javascript
{
    id,
    title,
    initialize(),
    load(),
    refresh(),
    render(container),
    dispose()
}
```

The dashboard page should simply host and arrange the widgets.

Adding future widgets should require only registering the widget rather than modifying dashboard logic.

---

# Widget Requirements

Every widget must:

* Load independently
* Render independently
* Handle its own errors
* Handle its own loading state
* Never block the rendering of other widgets
* Support refresh
* Display cache information when applicable

---

# Cache Requirements

The dashboard should aggressively reuse existing caches.

If data already exists:

* Use it immediately.
* Display the age of the cached data.

If data does not exist:

* Render the widget immediately.
* Display "Not Loaded".
* Provide a **Load** button.

The widget should never delay rendering while waiting on data.

Each widget should clearly display one of:

* Cached (age)
* Live
* Loading
* Not Loaded
* Error

Example:

```
Users
2,415

Cached
17 minutes ago

Refresh
```

or

```
Phone Inventory

Not Loaded

Load Phone Inventory
```

---

# Widget 1 - Organization Snapshot

Purpose:

Provide basic connection information.

Display:

* Organization Name
* Organization ID
* Region
* Connected User
* Connection Time

Display cache ages for:

* User Cache
* Phone Cache
* Site Cache
* Division Cache
* Data Table Cache

Do not provide refresh buttons here.

This is informational only.

---

# Widget 2 - Inventory

Purpose:

Provide quick inventory counts.

Display:

* Users
* Queues
* Skills
* Roles
* Groups
* Phones
* Prompts
* Data Tables

Each row should contain:

Resource Name

Count

Status

Cache Age

Open Export

Example:

```
Users

2,415

Cached
8 minutes ago

Open Export
```

If inventory is not loaded:

```
Users

Not Loaded

Load

Open Export
```

Inventory should **not** execute the full export workflow.

Instead, it should use lightweight inventory queries or existing cached information.

If data is already cached, reuse it.

If data is missing, only load the minimum information required for inventory.

---

# Widget 3 - Health Checks

Purpose:

Identify potential configuration problems.

Initial health checks:

Users

* Users without Roles
* Users without Skills
* Users without Phones

Phones

* WebRTC Phones with no corresponding User

Queues

* Queues with no Members

Each metric should display:

Issue

Count

Status

Cache Age(s)

Load (if necessary)

Open Related Export

Example:

```
Users without Phones

12

Requires Phone Inventory

Load Phone Inventory

Open Users Export
```

Health checks should **reuse existing caches whenever possible**.

If required data is missing:

Only load the minimum dependencies required for that specific health check.

Example:

Users without Phones depends on:

* User Cache
* Phone Inventory

Do not trigger unrelated exports.

Health checks should declare their dependencies instead of embedding loading logic.

Example conceptually:

```
dependsOn:

Users

Phones
```

---

# Widget 4 - Organization Limits

Create a full-width table.

Retrieve:

GET /api/v2/organizations/limits/docs

Display:

* Resource
* Current Usage
* Maximum
* Percentage Used
* Warning Status

Sort descending by utilization.

Highlight resources approaching limits.

---

# Widget 5 - Telephony Metrics

Retrieve:

GET /api/v2/telephony/calls/metrics

This widget is always live.

Never cache.

Display:

* Active Calls
* Calls Waiting
* Calls Connected
* Other metrics returned by the endpoint that are appropriate for an operational dashboard

Display:

Last Updated

Refresh

---

# Widget 6 - Session Activity

Display only activity that occurred **during the current PS Tool session**.

Do not retrieve historical Audit Logs.

Examples:

* Bulk Role Assignment
* Bulk Skill Assignment
* Password Reset
* User Logoff
* Phone Build
* Phone Move
* Phone Removal
* Phone Site Migration
* Bulk Disconnect
* Priority Update
* Load Schedules
* Master Admin Creation
* Call Spoof

Display:

Timestamp

Action

Affected Count

Success

Failure

---

# Widget Layout

Suggested order:

1. Organization Snapshot
2. Inventory
3. Health Checks
4. Organization Limits
5. Telephony Metrics
6. Session Activity

Widgets should use the existing Genesys Spark components and match the styling of the rest of the application.

---

# Design Goals

The dashboard should answer:

> "What is the current health and state of this organization?"

It should **not** become another workflow page.

Any actions beyond loading or refreshing data should navigate the user to the existing export or workflow pages.

---

# Performance Requirements

* Dashboard shell renders immediately.
* Widgets load independently.
* Widgets never block one another.
* Cached data is always preferred.
* Expensive queries should only execute when needed.
* Reuse existing session and resource caches whenever possible.
* Avoid creating duplicate API requests if data is already cached.

---

# Extensibility

The widget framework should be generic enough that future widgets can be added without modifying the dashboard page.

Future widgets may include:

* Flow Health
* Queue Health
* License Usage
* Notification Status
* Custom Widgets
* User-configurable Dashboard Layout

Design the dashboard framework with future expansion in mind, even if only the initial widgets are implemented in this feature.
