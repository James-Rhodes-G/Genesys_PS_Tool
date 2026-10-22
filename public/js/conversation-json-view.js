import { renderJsonTree, setAllJsonTreeExpanded } from "./json-tree.js";

const renderConversationJsonPanelHtml = (value, { resultId = "", maxOpenDepth = 0, escapeHtml }) => {
  const safeEscape = escapeHtml || ((text) => String(text));
  const tree = renderJsonTree(value, { maxOpenDepth });

  return `<div class="conversation-json-view log-output__json">
    <div class="conversation-json-view__toolbar">
      <button type="button" class="secondary conversation-json-view__action" data-conversation-json-action="expand-all" data-result-id="${safeEscape(
        resultId
      )}">Expand all</button>
      <button type="button" class="secondary conversation-json-view__action" data-conversation-json-action="collapse-all" data-result-id="${safeEscape(
        resultId
      )}">Collapse all</button>
    </div>
    ${tree.outerHTML}
  </div>`;
};

const handleConversationJsonToolbarClick = (event) => {
  const button = event.target.closest("[data-conversation-json-action]");
  if (!button) {
    return false;
  }

  const resultId = button.getAttribute("data-result-id");
  const resultEl = resultId ? document.getElementById(resultId) : null;
  const panel = resultEl?.querySelector(".conversation-json-view") || button.closest(".conversation-json-view");
  const tree = panel?.querySelector(".json-tree");
  if (!tree) {
    return false;
  }

  const action = button.getAttribute("data-conversation-json-action");
  setAllJsonTreeExpanded(tree, action === "expand-all");
  return true;
};

export { handleConversationJsonToolbarClick, renderConversationJsonPanelHtml };
