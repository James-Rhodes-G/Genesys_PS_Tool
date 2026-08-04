const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createOrgPickerModal = ({
  modalEl,
  searchInputEl,
  listEl,
  statusEl,
  cancelBtn,
  signInBtn,
}) => {
  let state = {
    organizations: [],
    currentOrganizationId: "",
    filteredOrganizations: [],
    searchQuery: "",
    onSelect: null,
    onSignIn: null,
    onCancel: null,
  };

  const close = () => {
    if (!modalEl) {
      return;
    }

    modalEl.open = false;
    modalEl.removeAttribute("open");
    state = {
      organizations: [],
      currentOrganizationId: "",
      filteredOrganizations: [],
      searchQuery: "",
      onSelect: null,
      onSignIn: null,
      onCancel: null,
    };

    if (searchInputEl) {
      searchInputEl.value = "";
    }

    if (listEl) {
      listEl.innerHTML = "";
    }

    if (statusEl) {
      statusEl.textContent = "";
    }

    if (signInBtn) {
      signInBtn.hidden = false;
    }
  };

  const buildFilteredOrganizations = (query) => {
    const normalizedQuery = String(query || "").trim();
    const normalizedQueryLower = normalizedQuery.toLowerCase();

    let filtered = !normalizedQueryLower
      ? [...state.organizations]
      : state.organizations.filter((organization) => {
          const haystack = `${organization.name} ${organization.id}`.toLowerCase();
          return haystack.includes(normalizedQueryLower);
        });

    if (normalizedQuery && UUID_PATTERN.test(normalizedQuery) && !filtered.some((entry) => entry.id === normalizedQuery)) {
      filtered = [
        {
          id: normalizedQuery,
          name: "Use organization ID",
          source: "manual",
        },
        ...filtered,
      ];
    }

    return filtered;
  };

  const renderList = () => {
    if (!listEl) {
      return;
    }

    if (!state.filteredOrganizations.length) {
      listEl.innerHTML =
        '<p class="muted org-picker-list__empty">No organizations loaded yet. Sign in to your primary organization, or paste a client organization ID in search.</p>';
      return;
    }

    listEl.innerHTML = state.filteredOrganizations
      .map((organization) => {
        const isCurrent = organization.id === state.currentOrganizationId;
        const badge = isCurrent ? '<span class="org-picker-list__badge">Current token</span>' : "";
        const sourceLabel =
          organization.source === "trustor"
            ? "Authorized organization"
            : organization.source === "configured"
              ? "Configured organization"
              : organization.source === "manual"
                ? "Organization ID"
                : "Signed-in organization";

        return `<button
          type="button"
          class="org-picker-list__item"
          data-org-id="${escapeHtml(organization.id)}"
          role="option"
          aria-selected="false"
        >
          <span class="org-picker-list__name">${escapeHtml(organization.name)}</span>
          <span class="org-picker-list__meta">${escapeHtml(sourceLabel)} · ${escapeHtml(organization.id)}</span>
          ${badge}
        </button>`;
      })
      .join("");
  };

  const applySearch = (query) => {
    state.searchQuery = query;
    state.filteredOrganizations = buildFilteredOrganizations(query);
    renderList();
  };

  const open = ({
    organizations = [],
    currentOrganizationId = "",
    onSelect = null,
    onSignIn = null,
    onCancel = null,
    statusMessage = "",
    initialSearch = "",
    showSignIn = true,
  }) => {
    if (!modalEl || !listEl) {
      throw new Error("Organization picker is unavailable on this page.");
    }

    state = {
      organizations: Array.isArray(organizations) ? organizations : [],
      currentOrganizationId,
      filteredOrganizations: [],
      searchQuery: initialSearch,
      onSelect,
      onSignIn,
      onCancel,
    };

    if (statusEl) {
      statusEl.textContent = statusMessage;
    }

    if (searchInputEl) {
      searchInputEl.value = initialSearch;
    }

    if (signInBtn) {
      signInBtn.hidden = !showSignIn;
    }

    applySearch(initialSearch);
    modalEl.open = true;
    modalEl.setAttribute("open", "true");

    if (searchInputEl) {
      searchInputEl.focus();
      if (initialSearch) {
        searchInputEl.select();
      }
    }
  };

  const update = ({
    organizations = [],
    currentOrganizationId = "",
    statusMessage = "",
    showSignIn = true,
  }) => {
    state.organizations = Array.isArray(organizations) ? organizations : [];
    state.currentOrganizationId = currentOrganizationId;

    if (statusEl && statusMessage) {
      statusEl.textContent = statusMessage;
    }

    if (signInBtn) {
      signInBtn.hidden = !showSignIn;
    }

    applySearch(state.searchQuery || searchInputEl?.value || "");
  };

  const bind = () => {
    if (searchInputEl) {
      searchInputEl.addEventListener("input", () => {
        applySearch(searchInputEl.value);
      });

      searchInputEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || typeof state.onSelect !== "function") {
          return;
        }

        const query = searchInputEl.value.trim();
        if (!UUID_PATTERN.test(query)) {
          return;
        }

        const organization =
          state.filteredOrganizations.find((entry) => entry.id === query) ||
          state.organizations.find((entry) => entry.id === query) || {
            id: query,
            name: "Use organization ID",
            source: "manual",
          };

        const onSelect = state.onSelect;
        close();
        onSelect(organization);
      });
    }

    if (listEl) {
      listEl.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-org-id]");

        if (!button || typeof state.onSelect !== "function") {
          return;
        }

        const organization =
          state.organizations.find((entry) => entry.id === button.dataset.orgId) ||
          state.filteredOrganizations.find((entry) => entry.id === button.dataset.orgId);

        if (!organization) {
          return;
        }

        const onSelect = state.onSelect;
        close();
        await onSelect(organization);
      });
    }

    if (signInBtn) {
      signInBtn.addEventListener("click", () => {
        if (typeof state.onSignIn !== "function") {
          return;
        }

        const onSignIn = state.onSignIn;
        close();
        onSignIn();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        if (typeof state.onCancel === "function") {
          state.onCancel();
        }

        close();
      });
    }

    if (modalEl) {
      modalEl.addEventListener("guxdismiss", () => {
        if (typeof state.onCancel === "function") {
          state.onCancel();
        }

        close();
      });
    }
  };

  return {
    bind,
    close,
    open,
    update,
  };
};

export { createOrgPickerModal, UUID_PATTERN };
