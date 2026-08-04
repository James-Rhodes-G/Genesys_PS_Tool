import { renderGuxFieldText } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createMasterAdminFeature = ({
  state,
  createMasterAdminRole,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  createMasterAdminResultsMeta,
  confirmModal,
}) => {
  const defaultRoleName = "Full Master Admin";
  const defaultDescription = "This contains every domains ALL PERMISSIONS permission";
  const defaultGeneralPermissions = 20;

  const renderSelection = (resultId, featureState) => {
    const roleName = String(featureState.roleName || defaultRoleName);
    const description = String(featureState.description || defaultDescription);

    return `<div class="column-editor">
      <div class="column-editor__header">Create Master Admin</div>
      <div class="sidebar-actions call-spoof-form">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-master-admin-name`,
          className: "master-admin-role-name",
          label: "Role Name",
          value: roleName,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-master-admin-description`,
          className: "master-admin-role-description",
          label: "Description",
          value: description,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        <p class="muted">This creates a role with ${escapeHtml(
          String(defaultGeneralPermissions)
        )} fixed Genesys general permissions plus wildcard permission policies for every authorization domain in the org.</p>
        <div class="bulk-skill-actions">
          <gux-button class="master-admin-create-apply" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Create Master Admin Role</gux-button>
        </div>
      </div>
    </div>`;
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const createButton = target.closest(".master-admin-create-apply");
    if (!createButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = createButton.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return true;
    }

    const resultEl = document.getElementById(resultId);
    const roleNameInput = resultEl?.querySelector(".master-admin-role-name");
    const descriptionInput = resultEl?.querySelector(".master-admin-role-description");
    const roleName = String(
      roleNameInput instanceof HTMLInputElement ? roleNameInput.value : exportMeta.roleName || ""
    ).trim();
    const description = String(
      descriptionInput instanceof HTMLInputElement ? descriptionInput.value : exportMeta.description || ""
    ).trim();

    exportMeta.roleName = roleName;
    exportMeta.description = description;
    if (!roleName) {
      confirmModal.open({
        resultId,
        title: "Role Name Required",
        bodyHtml: "<p>Enter a role name before creating the master admin role.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    const credentials = requireCredentials("Create Master Admin");
    if (!credentials) {
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm Master Admin Creation",
      bodyHtml: `<p>Create role <strong>${escapeHtml(
        roleName
      )}</strong> with org-wide wildcard permission policies for every authorization domain.</p><p>Description: ${escapeHtml(
        description || defaultDescription
      )}</p>`,
      confirmLabel: "Create Role",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        const resultEl = resultId ? document.getElementById(resultId) : null;
        if (!resultId || !exportMeta || !resultEl) {
          close();
          return;
        }

        close();
        resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
          `Creating ${roleName}...`
        );

        try {
          const role = await createMasterAdminRole({
            ...credentials,
            roleName,
            description,
          });

          const resultRows = [
            {
              roleName: role.roleName || roleName,
              roleId: role.roleId || "",
              description: role.description || description,
              generalPermissionCount: role.generalPermissionCount || defaultGeneralPermissions,
              permissionPolicyCount: role.permissionPolicyCount || 0,
              status: "success",
              error: "",
            },
          ];

          finishExportResult(
            resultId,
            "Create Master Admin",
            "Role created successfully",
            "",
            createMasterAdminResultsMeta(
              resultId,
              resultRows,
              "Create Master Admin",
              "Role created successfully"
            )
          );
        } catch (error) {
          finishExportResult(
            resultId,
            "Create Master Admin",
            error.message || "Master admin creation failed",
            renderJsonBlock(error.payload || { error: error.message || "Master admin creation failed" })
          );
        }
      },
    });

    return true;
  };

  const handleChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.classList.contains("master-admin-role-name")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.roleName = target.value;
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("master-admin-role-description")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.description = target.value;
      return true;
    }

    return false;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = requireCredentials("Create Master Admin");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Create Master Admin",
        "Loading create-role workflow...",
        renderLoadingState("Preparing master admin role creation workspace...")
      );

      const exportMeta = {
        resultId: loadingResultId,
        title: "Create Master Admin",
        status: "Ready to create role",
        exportType: "master_admin_setup",
        kind: "create-master-admin",
        editable: false,
        roleName: defaultRoleName,
        description: defaultDescription,
        renderBody: () =>
          renderSelection(loadingResultId, state.exportData[loadingResultId] || {
            roleName: defaultRoleName,
            description: defaultDescription,
          }),
      };

      state.exportData[loadingResultId] = exportMeta;
      finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
    });
  };

  return {
    handleClick,
    handleChange,
    wireButton,
  };
};

export { createMasterAdminFeature };
