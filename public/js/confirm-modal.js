const createConfirmModal = ({
  modalEl,
  titleEl,
  bodyEl,
  cancelBtn,
  confirmBtn,
}) => {
  let state = {
    resultId: "",
    onConfirm: null,
  };

  const close = () => {
    if (!modalEl) {
      return;
    }

    modalEl.open = false;
    modalEl.removeAttribute("open");
    state = {
      resultId: "",
      onConfirm: null,
    };

    if (confirmBtn) {
      confirmBtn.hidden = false;
      confirmBtn.textContent = "Confirm";
    }

    if (cancelBtn) {
      cancelBtn.textContent = "Cancel";
    }
  };

  const open = ({
    resultId = "",
    title,
    bodyHtml,
    confirmLabel = "Confirm",
    confirmHidden = false,
    cancelLabel = "Cancel",
    onConfirm = null,
  }) => {
    if (!modalEl || !titleEl || !bodyEl || !confirmBtn) {
      return;
    }

    state = {
      resultId,
      onConfirm,
    };

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.hidden = Boolean(confirmHidden);

    if (cancelBtn) {
      cancelBtn.textContent = cancelLabel;
    }

    modalEl.open = true;
    modalEl.setAttribute("open", "true");
  };

  const bind = () => {
    if (modalEl) {
      modalEl.addEventListener("guxdismiss", () => {
        close();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        close();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        const onConfirm = state.onConfirm;
        const resultId = state.resultId;
        if (typeof onConfirm !== "function") {
          close();
          return;
        }

        await onConfirm({ resultId, close });
      });
    }
  };

  return {
    bind,
    close,
    open,
  };
};

export { createConfirmModal };
