const MODAL_ID = "ps-tool-session-auth-modal";

const ensureModal = () => {
  let modal = document.getElementById(MODAL_ID);
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "ps-tool-modal hidden";
  modal.innerHTML = `
    <div class="ps-tool-modal__backdrop" data-dismiss="true"></div>
    <div class="ps-tool-modal__panel" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ID}-title">
      <h2 id="${MODAL_ID}-title">Session required</h2>
      <p class="ps-tool-modal__body">
        Your Genesys connection is missing or expired. Open Genesys Cloud in Chrome and launch this feature again from the PS Tool extension.
      </p>
      <div class="ps-tool-modal__actions">
        <button type="button" class="btn primary" data-dismiss="true">OK</button>
      </div>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.dismiss === "true") {
      modal.classList.add("hidden");
    }
  });

  document.body.appendChild(modal);
  return modal;
};

const showVaultSessionRequiredModal = (message) => {
  const modal = ensureModal();
  const body = modal.querySelector(".ps-tool-modal__body");
  if (body && message) {
    body.textContent = message;
  }
  modal.classList.remove("hidden");
};

const isVaultSessionRequiredPayload = (payload) =>
  payload?.code === "VAULT_SESSION_REQUIRED" ||
  (typeof payload?.error === "string" && payload.error.includes("Re-launch"));

export { isVaultSessionRequiredPayload, showVaultSessionRequiredModal };
