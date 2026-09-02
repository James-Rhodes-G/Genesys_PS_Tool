# Genesys PS Tool Launcher Extension

Thin Chrome side panel that launches PS Tool web features from Genesys Cloud. The extension does not run export or bulk logic locally — it pairs once with the web app and opens deep links.

## Load Unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Configuration

Open **Extension options** (linked from the side panel footer) or right-click the extension icon → **Options**.

| Setting | Default | Purpose |
| --- | --- | --- |
| PS Tool base URL | `http://localhost:3000` | Web app origin for pair/handoff |
| Launch HMAC secret | empty | Must match `LAUNCH_HMAC_SECRET` in server `.env` when set |

Quick Navigation buttons (Roles, People, Queues, etc.) are configured per-button with label, URL, and optional new-tab behavior. Relative URLs are opened against the active Genesys tab origin.

## Usage

1. Log into Genesys Cloud in a normal browser tab (`apps.*` subdomain).
2. Click the extension toolbar icon to open the side panel.
3. Confirm org name and username appear in the header. Click Org ID, Region, or Token in **Org Info** to copy.
4. Click any **Export**, **Bulk**, or **Quick Actions** button to launch the matching web feature.

The side panel closes automatically when the active tab leaves the Genesys `apps.*` subdomain.

On first launch (or after credentials change), the extension silently calls `POST /api/launch/pair`. Subsequent launches send only the stored `linkToken`.

## Quick Navigation vs Launch

| Button type | Behavior |
| --- | --- |
| Quick Nav 1–6 | Opens Genesys admin URLs (same tab or new tab) |
| Export / Bulk / Reports | Opens PS Tool via `/launch?code=...` handoff |

## URL Parameters

The web app receives these after bootstrap:

| Param | Example | Purpose |
| --- | --- | --- |
| `feature` | `genesys-users` | Opens the matching nav panel after connect |
| `conversationId` | `abc-123-def` | Pre-fills conversation ID for report features |

## Requirements

- Chrome with Manifest V3 side panel support
- Active Genesys Cloud session in the focused tab
- PS Tool server running with `VAULT_ENCRYPTION_KEY` configured

See [`docs/launch-endpoint.md`](../docs/launch-endpoint.md) for the full security model and API reference.
