const normalizeSearchTerm = (value) => String(value || "").trim().toLowerCase();

const nodeMatchesSearch = (node, term) => {
  if (!term) {
    return false;
  }

  return [node.actionName, node.displayType, node.actionType, node.outputPath, node.taskName, node.commonModuleName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
};

const findSearchMatches = (model, query) => {
  const term = normalizeSearchTerm(query);
  if (!term || !model?.flatNodes?.length) {
    return [];
  }

  return model.flatNodes
    .filter((node) => nodeMatchesSearch(node, term))
    .map((node) => ({
      flatIndex: node.flatIndex,
      trackingId: node.trackingId,
      actionName: node.actionName,
      displayType: node.displayType,
    }));
};

const findErrorTargets = (model) => {
  if (!model?.flatNodes?.length) {
    return [];
  }

  return model.flatNodes
    .filter((node) => Array.isArray(node.errors) && node.errors.length)
    .map((node) => ({
      flatIndex: node.flatIndex,
      trackingId: node.trackingId,
      actionName: node.actionName,
      displayType: node.displayType,
      errors: node.errors,
    }));
};

const collectAncestorTrackingIds = (model, trackingId) => {
  const ancestors = new Set();
  let current = model.flatNodes.find((node) => node.trackingId === trackingId);

  while (current?.parentTrackingId != null) {
    ancestors.add(current.parentTrackingId);
    current = model.flatNodes.find((node) => node.trackingId === current.parentTrackingId);
  }

  return ancestors;
};

const buildExpandedTrackingIds = (model, { searchQuery = "", focusTrackingId = null } = {}) => {
  const expanded = new Set();
  const matches = findSearchMatches(model, searchQuery);

  matches.forEach((match) => {
    collectAncestorTrackingIds(model, match.trackingId).forEach((trackingId) => expanded.add(trackingId));
  });

  if (focusTrackingId != null) {
    collectAncestorTrackingIds(model, focusTrackingId).forEach((trackingId) => expanded.add(trackingId));
    expanded.add(focusTrackingId);
  }

  return expanded;
};

const filterVariableNames = (variableIndex, query) => {
  const term = normalizeSearchTerm(query);
  if (!term) {
    return variableIndex || [];
  }

  return (variableIndex || []).filter((name) => name.toLowerCase().includes(term));
};

const getVariableStateAtNode = (model, node) => model?.variableStateByFlatIndex?.[node.flatIndex] || {};

const getTrackedVariableDisplay = (node, trackedVariables, mode = "tracked", model = null) => {
  const names = trackedVariables || [];
  if (!names.length) {
    return [];
  }

  const stateAtNode = getVariableStateAtNode(model, node);

  if (mode === "changed") {
    return names
      .filter((name) => node.changedVariables?.[name])
      .map((name) => ({
        name,
        previous: node.changedVariables[name].previous,
        current: node.changedVariables[name].current,
      }));
  }

  return names.map((name) => ({
    name,
    current: stateAtNode[name] || { displayValue: "—", rawValue: null, state: "unset" },
    changed: Boolean(node.changedVariables?.[name]),
    previous: node.changedVariables?.[name]?.previous || null,
  }));
};

const getFinalVariableStates = (model) => {
  const names = model?.variableIndex || [];
  const lastIndex = Math.max((model?.flatNodes?.length || 0) - 1, 0);
  const lastState = model?.variableStateByFlatIndex?.[lastIndex] || {};

  return names.map((name) => ({
    name,
    current: lastState[name] || { displayValue: "—", rawValue: null, state: "unset" },
  }));
};

const getVariableHistoryEntries = (model, variableName) => model?.variableHistory?.[variableName] || [];

export {
  buildExpandedTrackingIds,
  collectAncestorTrackingIds,
  filterVariableNames,
  findErrorTargets,
  findSearchMatches,
  getFinalVariableStates,
  getTrackedVariableDisplay,
  getVariableHistoryEntries,
  getVariableStateAtNode,
  nodeMatchesSearch,
};
