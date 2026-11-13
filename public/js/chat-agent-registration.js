const registrationStorageKey = (orgId) => `ps-tool:chat-agent-registrations:${orgId || "unknown"}`;

const loadRegistrationState = (orgId) => {
  if (typeof localStorage === "undefined") {
    return { saved: [], lastActiveId: "", lastMode: "webDeployment" };
  }

  try {
    const raw = localStorage.getItem(registrationStorageKey(orgId));
    if (!raw) {
      return { saved: [], lastActiveId: "", lastMode: "webDeployment" };
    }
    const parsed = JSON.parse(raw);
    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      lastActiveId: parsed.lastActiveId || "",
      lastMode: parsed.lastMode || "webDeployment",
    };
  } catch {
    return { saved: [], lastActiveId: "", lastMode: "webDeployment" };
  }
};

const saveRegistrationState = (orgId, state) => {
  if (typeof localStorage === "undefined") {
    return state;
  }
  localStorage.setItem(registrationStorageKey(orgId), JSON.stringify(state));
  return state;
};

const upsertRegistration = (orgId, entry) => {
  const state = loadRegistrationState(orgId);
  const saved = state.saved.filter((item) => item.id !== entry.id);
  saved.unshift(entry);
  return saveRegistrationState(orgId, {
    ...state,
    saved: saved.slice(0, 20),
    lastActiveId: entry.id,
    lastMode: entry.mode || state.lastMode,
  });
};

export { loadRegistrationState, saveRegistrationState, upsertRegistration };
