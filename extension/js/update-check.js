import { getSettings } from "./launch.js";

const bannerEl = () => document.getElementById("update-banner");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildMessage = (payload) => {
  const latest = payload.latestVersion;
  const serverBehind = payload.server?.updateAvailable;
  const extensionBehind = payload.extension?.updateAvailable;

  if (serverBehind && extensionBehind) {
    return `Updates available (latest v${latest}): update the PS Tool server and reload the Chrome extension.`;
  }
  if (serverBehind) {
    return `PS Tool server update available: you're on v${payload.server.current}, latest is v${latest}. Pull and restart the server.`;
  }
  if (extensionBehind) {
    return `Extension update available: you're on v${payload.extension.current}, latest is v${latest}. Reload the extension from the release.`;
  }
  return "";
};

export const refreshUpdateBanner = async () => {
  const element = bannerEl();
  if (!element) {
    return;
  }

  try {
    const { baseUrl } = await getSettings();
    const extensionVersion = chrome.runtime.getManifest().version;
    const url = `${baseUrl}/api/app/update?extensionVersion=${encodeURIComponent(extensionVersion)}`;
    const response = await fetch(url);
    if (!response.ok) {
      element.hidden = true;
      element.textContent = "";
      return;
    }

    const payload = await response.json();
    if (!payload.updateAvailable) {
      element.hidden = true;
      element.textContent = "";
      return;
    }

    const message = buildMessage(payload);
    const releaseLink = payload.releaseUrl
      ? ` <a href="${escapeHtml(payload.releaseUrl)}" target="_blank" rel="noreferrer">View release</a>`
      : "";
    element.innerHTML = `<strong>Update available.</strong> ${escapeHtml(message)}${releaseLink}`;
    element.hidden = false;
  } catch (_error) {
    element.hidden = true;
    element.textContent = "";
  }
};
