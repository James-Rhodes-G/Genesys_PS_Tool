import {
  mountNotificationMessageParserView,
  renderNotificationMessageParserPanel,
} from "./notification-message-parser-view.js";

const createNotificationMessageParserFeature = ({
  state,
  startExportResult,
  finishExportResult,
  renderLoadingState,
}) => {
  const controllers = new Map();

  const getController = (resultId) => controllers.get(resultId) || null;

  const mountParserView = (resultId) => {
    const existing = controllers.get(resultId);
    if (existing) {
      existing.destroy();
    }

    const controller = mountNotificationMessageParserView(resultId);
    if (controller) {
      controllers.set(resultId, controller);
    }

    return controller;
  };

  const openParserPanel = () => {
    const existingEntry = Object.entries(state.exportData || {}).find(
      ([, exportMeta]) => exportMeta?.exportType === "notification_message_parser"
    );

    if (existingEntry) {
      const [resultId] = existingEntry;
      const resultEl = document.getElementById(resultId);
      if (resultEl) {
        resultEl.open = true;
        resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        mountParserView(resultId);
        return resultId;
      }

      controllers.get(resultId)?.destroy?.();
      controllers.delete(resultId);
      delete state.exportData[resultId];
    }

    const resultId = startExportResult(
      "Parsed Messages",
      "Live message review",
      renderLoadingState("Loading parsed messages...")
    );

    const exportMeta = {
      resultId,
      title: "Parsed Messages",
      status: "Ready",
      exportType: "notification_message_parser",
      kind: "notification-message-parser",
      hideActions: true,
      editable: false,
      renderBody: () => renderNotificationMessageParserPanel({ resultId }),
    };

    state.exportData[resultId] = exportMeta;
    finishExportResult(resultId, exportMeta.title, exportMeta.status, "", exportMeta);
    mountParserView(resultId);
    return resultId;
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const actionButton = target.closest("[data-parser-action]");
    if (!actionButton) {
      return false;
    }

    const resultId = actionButton.getAttribute("data-result-id") || "";
    const controller = getController(resultId);
    if (!controller) {
      return false;
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
        return false;
    }

    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", () => {
      openParserPanel();
    });
  };

  return {
    handleClick,
    openParserPanel,
    wireButton,
  };
};

export { createNotificationMessageParserFeature };
