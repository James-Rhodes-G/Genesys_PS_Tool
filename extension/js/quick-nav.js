import { DEFAULT_QUICK_NAV } from "./constants.js";

const getQuickNavConfig = async () => {
  const stored = await chrome.storage.local.get("quickNav");
  if (!stored.quickNav || Object.keys(stored.quickNav).length === 0) {
    await chrome.storage.local.set({ quickNav: DEFAULT_QUICK_NAV });
    return DEFAULT_QUICK_NAV;
  }
  return { ...DEFAULT_QUICK_NAV, ...stored.quickNav };
};

const openTabNextToCurrent = async (url) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const current = tabs[0];
  const index = typeof current?.index === "number" ? current.index + 1 : undefined;
  await chrome.tabs.create({ url, active: true, index });
};

export const wireQuickNavButtons = async () => {
  const config = await getQuickNavConfig();
  const buttons = document.querySelectorAll("[data-quick-nav]");

  buttons.forEach((button) => {
    const id = button.dataset.quickNav;
    const label = config[`${id}_Label`] || "";
    const url = config[`${id}_URL`] || "";
    const openNewTab = Boolean(config[`${id}_radio`]);

    if (!label) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.textContent = label;
    button.addEventListener("click", async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const current = tabs[0];
      if (!current?.url) {
        return;
      }

      if (/^https?:\/\//i.test(url)) {
        await openTabNextToCurrent(url);
        return;
      }

      const target = `${new URL(current.url).origin}${url}`;
      if (openNewTab) {
        await openTabNextToCurrent(target);
      } else {
        await chrome.tabs.update(current.id, { url: target });
      }
    });
  });
};

export { getQuickNavConfig };
