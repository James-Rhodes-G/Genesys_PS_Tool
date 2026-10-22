# Genesys PS Tool Launcher Extension

Thin Chrome side panel that launches PS Tool web features from Genesys Cloud. The extension does not run export or bulk logic locally — it calls the web app launch API and opens deep links.

## Load Unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Configuration

Open **Extension options** (linked from the side panel footer) or right-click the extension icon → **Options**.

| Setting | Default | Purpose |
| --- | --- | --- |
| PS Tool base URL | `http://localhost:3000` | Web app origin for signed launch requests |
| Launch HMAC secret | empty | Must match `LAUNCH_HMAC_SECRET` in server `.env` when set |

Quick Navigation buttons (Roles, People, Queues, etc.) are configured per-button with label, URL, and optional new-tab behavior. Relative URLs are opened against the active Genesys tab origin.

## Usage

1. Log into Genesys Cloud in a normal browser tab (`apps.*` subdomain).
2. Click the extension toolbar icon to open the side panel.
3. Confirm org name and username appear in the header. **Org Info** shows Org ID and Region only (copyable); bearer tokens are not displayed or stored in the extension.
4. Click any **Export**, **Bulk**, or **Quick Actions** button to launch the matching web feature.

The side panel closes automatically when the active tab leaves the Genesys `apps.*` subdomain.

Each feature launch calls **`POST /api/launch/start`** with the current Genesys session token (in memory only). The server returns a one-time launch URL; the extension does **not** store bearer tokens, link tokens, or pair context in `chrome.storage`.

## Quick Navigation vs Launch

| Button type | Behavior |
| --- | --- |
| Quick Nav 1–6 | Opens Genesys admin URLs (same tab or new tab) |
| Export / Bulk / Reports | Opens PS Tool via `/launch?code=...` after `POST /api/launch/start` |

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
