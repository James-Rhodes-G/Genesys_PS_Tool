import { mountNotificationMessageParserView, renderNotificationMessageParserPanel } from "./notification-message-parser-view.js";

let controller = null;

const mountStandaloneParser = () => {
  const panel = document.getElementById("parserPanelRoot");
  if (!panel) {
    return;
  }

  panel.innerHTML = renderNotificationMessageParserPanel();
  controller?.destroy?.();
  controller = mountNotificationMessageParserView("");
};

document.getElementById("parserPanelRoot")?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest("[data-parser-action]");
  if (!actionButton || !controller) {
    return;
  }

  event.preventDefault();

  switch (actionButton.getAttribute("data-parser-action")) {
    case "expand-cards":
      controller.expandAllCards();
      break;
    case "collapse-cards":
      controller.collapseAllCards();
      break;
    case "expand-json":
      controller.expandAllJson();
      break;
    case "collapse-json":
      controller.collapseAllJson();
      break;
    case "clear":
      controller.clearImport();
      break;
    default:
      break;
  }
});

mountStandaloneParser();
