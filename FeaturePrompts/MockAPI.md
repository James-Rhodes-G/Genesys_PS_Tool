
# Feature Request: Mock API Framework for the PS Tool

## Objective

Implement a **Mock API Framework** within the PS Tool that allows Professional Services engineers to quickly create reusable HTTP endpoints for testing Genesys Cloud Data Actions, Architect integrations, and external integrations.

This feature is for **PS Tool administration only** and is **not** intended for administration of the Genesys Cloud platform.

The implementation should be modular, secure, extensible, and designed to support future enhancements without requiring major architectural changes.

---

# Documentation Requirements (Mandatory)

Upon completion:

* Update `README.md`.
* Document the new Mock API feature.
* Document all new routes.
* Document endpoint lifecycle.
* Document URL format.
* Document request logging.
* Document retention.
* Update the Architecture section.
* Update feature lists.
* Update any configuration documentation.
* Ensure the README accurately reflects the completed implementation.

---

# Feature Scope

Version 1 includes:

* Mock API creation
* Mock API editing
* Mock API deletion
* Mock API archiving
* Mock API recovery
* Mock API cloning
* Persistent storage
* Request logging
* Request inspection
* Configurable responses
* Endpoint expiration
* Automatic cleanup

Version 1 explicitly excludes:

* Dynamic response scripting
* Conditional request matching
* Shared/team mock APIs
* Mock API variables
* Request replay
* Administration of Genesys Cloud resources

---

# Endpoint Structure

Every endpoint must be reachable using the following format:

```
/mockAPI/{userpart}/{endpointSlug}
```

Example:

```
/mockAPI/jrhodes/customer-create
```

Where:

* userpart = authenticated user's email local-part
* endpointSlug = user-defined endpoint name

---

# Endpoint Naming Rules

Endpoint slug

Maximum length:

64 characters

Allowed:

* a-z
* 0-9
* *

Automatically normalize:

* lowercase
* replace spaces with "-"
* collapse repeated "-"
* remove leading/trailing "-"

Disallow:

* spaces
* slashes
* query strings
* special characters

Reserved names

Do not allow:

* admin
* logs
* archive
* internal

Additional reserved names may be added by the implementation.

Enforce uniqueness:

(userpart, method, endpointSlug)

---

# Ownership

Version 1 supports only

Personal endpoints.

No shared endpoints.

No organization-wide endpoints.

Store ownership information including:

* owner user
* owner session
* owner organization

Only the owner may manage the endpoint.

---

# Endpoint Lifecycle

Each endpoint has the following states:

* Draft
* Active
* Expired
* Archived
* Deleted

---

## Activity Timeout

An endpoint remains active for

**2 hours after the most recent request.**

Every successful request updates:

lastUsedAt

---

## Maximum Lifetime

Regardless of activity,

After **24 hours**

the endpoint automatically becomes

Expired

The user must explicitly reactivate it.

---

## Retention

Expired endpoints remain recoverable.

They should not immediately disappear.

The server should automatically purge endpoints according to the configured retention policy to prevent indefinite database growth.

Design the implementation so retention periods can be easily configured later without schema changes.

---

# Configurable Responses

Each endpoint stores

* HTTP Status Code
* Response Headers
* Response Body
* Artificial Delay

---

## HTTP Status Codes

Users must be able to configure

**any valid HTTP status code.**

Examples include:

Success

* 200
* 201
* 202
* 204

Redirect

* 301
* 302
* 307

Client Errors

* 400
* 401
* 403
* 404
* 405
* 409
* 415
* 422
* 429

Server Errors

* 500
* 501
* 502
* 503
* 504

The UI should present a searchable list of common HTTP response codes while still allowing entry of any valid status code.

---

# Response Body

Support configurable Content-Type.

At minimum:

* application/json (default)
* text/plain
* text/html
* application/xml

When Content-Type is JSON

Validate the response body before saving.

Other content types should not require JSON validation.

---

# Response Headers

Allow users to configure response headers.

Recommended limits

Maximum headers

20

Maximum header value

2 KB

Reject invalid header names.

---

# Artificial Delay

Allow configurable response delay.

Supported values

* Immediate
* 250ms
* 500ms
* 1 second
* 2 seconds
* 5 seconds
* 10 seconds
* 30 seconds

Maximum delay

30 seconds

Delay should occur before the configured response is returned.

---

# Request Logging

Every request must be logged.

Store:

* Timestamp
* Method
* Path
* Query String
* Request Headers
* Request Body
* Response Code
* Response Headers
* Response Body
* Response Time
* Request IP (if available)
* Mock Endpoint ID

---

# Request Inspection

The user must be able to inspect every request.

Display

```
Timestamp

Method

Path

Headers

Body

Response Code

Response Headers

Response Body
```

This should function similarly to a lightweight Postman history viewer.

---

# Security

Management operations require authenticated PS Tool access.

Creating

Editing

Deleting

Archiving

Recovering

Viewing logs

All require authentication.

---

## Endpoint Invocation

The mock endpoint itself

**must NOT require PS Tool authentication.**

Endpoints must be callable from

* Genesys Cloud Data Actions
* Architect
* External HTTP clients

---

## Ownership Validation

The server must ensure

Only the owning user can

* edit
* archive
* recover
* delete

another user's endpoint must never be modifiable.

---

## Logging Security

Do not permanently store

* Authorization headers
* OAuth tokens
* Cookies
* Sensitive credentials

These values should be redacted before storage.

---

## Request Limits

Apply reasonable limits.

Recommended defaults

Response body

256 KB

Headers

20

Header size

2 KB

Active endpoints per user

25

Rolling request history

1000 requests per endpoint

These values should be configurable.

---

# UI

Create a new

Mock API

page.

Sections

## Active Endpoints

Display

* Name
* Method
* URL
* Status
* Last Used
* Expires
* Hit Count

Actions

* Edit
* Clone
* Archive
* Delete
* Copy URL

---

## Expired / Archived

Display

Recoverable endpoints.

Actions

* Restore
* Clone
* Delete

---

## Request History

Display

Recent requests.

Selecting a request displays

* Request Headers
* Request Body
* Response Headers
* Response Body

---

# Backend

Create a reusable Mock API framework.

Suggested modules

```
src/routes/mock-api.js

src/lib/mock-api.js

src/data/mock-api-db.js
```

Do not place business logic inside routes.

Keep routes thin.

---

# Database

Persist

Mock Definitions

Store

* Owner
* Session
* Organization
* URL
* Method
* Status
* Response
* Headers
* Delay
* Lifecycle timestamps

Persist

Request Logs

Store

* Endpoint
* Request
* Response
* Timestamp

Design the schema for future expansion.

---

# Performance

The framework should

* Route requests quickly
* Never block the UI
* Use lazy loading where appropriate
* Support future pagination of request logs

---

# Future Expansion (Not Included)

The architecture should allow future implementation of:

* Dynamic responses
* Request matching
* Variables
* Shared endpoints
* Workspace endpoints
* Request replay
* Admin management UI
* Response scripting
* Rule engine integration

Do **not** implement these features in Version 1, but structure the code so they can be added later without significant refactoring.

---

# Acceptance Criteria

The implementation is complete when:

* Users can create reusable mock endpoints.
* Endpoints are reachable via `/mockAPI/{userpart}/{endpointSlug}`.
* Any valid HTTP response code can be configured.
* Multiple response content types are supported.
* Artificial response delay is supported.
* Every request is logged.
* Request headers and bodies can be inspected.
* Sensitive values are redacted from stored logs.
* Endpoints expire after 2 hours of inactivity and after a maximum of 24 hours, requiring manual reactivation.
* Expired endpoints are recoverable.
* Data is scoped to the owning user.
* The implementation is modular and extensible.
* `README.md` is updated to document the completed feature.