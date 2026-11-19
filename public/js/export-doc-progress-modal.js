import { renderLoadingState, updateLoadingProgress } from "./loading-message.js";

const createDocExportProgressModal = ({ modalEl, titleEl, bodyEl, closeBtn }) => {
  let isOpen = false;

  const setCloseVisible = (visible) => {
    if (closeBtn) {
      closeBtn.hidden = !visible;
    }
  };

  const open = ({ title = "Documentation export", primaryMessage, additionalGuidance, current, total }) => {
    if (!modalEl || !bodyEl) {
      return;
    }
    isOpen = true;
    if (titleEl) {
      titleEl.textContent = title;
    }
    bodyEl.innerHTML = renderLoadingState({
      primaryMessage: primaryMessage || "Starting documentation export...",
      additionalGuidance: additionalGuidance || "This may take several minutes for large organizations.",
      value: Number.isFinite(total) && total > 0 ? current : undefined,
      max: Number.isFinite(total) && total > 0 ? total : undefined,
    });
    setCloseVisible(false);
    modalEl.open = true;
    modalEl.setAttribute("open", "true");
  };

  const update = ({ primaryMessage, additionalGuidance, current, total }) => {
    if (!isOpen || !bodyEl) {
      return;
    }
    updateLoadingProgress(bodyEl, {
      primaryMessage,
      additionalGuidance,
      value: current,
      max: total,
    });
  };

  const showError = (message) => {
    if (!bodyEl) {
      return;
    }
    bodyEl.innerHTML = `<p class="error">${String(message || "Documentation export failed.")}</p>`;
    setCloseVisible(true);
  };

  const close = () => {
    if (!modalEl) {
      return;
    }
    isOpen = false;
    modalEl.open = false;
    modalEl.removeAttribute("open");
    setCloseVisible(false);
  };

  const bind = () => {
    if (closeBtn) {
      closeBtn.addEventListener("click", () => close());
    }
    if (modalEl) {
      modalEl.addEventListener("guxdismiss", () => {
        if (!isOpen) {
          close();
        }
      });
    }
  };

  return { open, update, showError, close, bind, get isOpen() {
    return isOpen;
  } };
};

export { createDocExportProgressModal };