import { isGroupActionType, resolveActionTypeMetadata } from "./flow-execution-action-registry.js";
import {
  convertGenesysRenderedDocument,
  isGenesysRenderedFlowDocument,
} from "./flow-execution-genesys-parser.js";

const CHILD_COLLECTION_KEYS = [
  "actions",
  "executionSteps",
  "steps",
  "children",
  "nestedActions",
  "subActions",
  "childActions",
  "executedActions",
  "items",
];

const ACTION_ROOT_PATHS = [
  "flow.execution",
  "execution.actions",
  "execution.executionSteps",
  "execution.steps",
  "flowExecution.actions",
  "flowExecution.executionSteps",
  "renderedExecutionData.execution.actions",
  "renderedExecutionData.execution.executionSteps",
  "renderedExecutionData.actions",
  "renderedExecutionData.executionHistory",
  "renderedExecutionData.history",
  "executionData.actions",
  "executionData.executionHistory",
  "executionHistory",
  "history",
  "executionItems",
  "executionRecords",
  "executedActions",
  "flowActions",
  "actions",
  "executionSteps",
  "steps",
  "flowInstance.execution.actions",
  "flowInstance.executionHistory",
  "data.execution.actions",
  "data.actions",
];

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

const pickFirst = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] != null && source[key] !== "") {
      return source[key];
    }
  }
  return null;
};

const formatNamedObjectDisplay = (entry) => {
  if (entry == null || typeof entry !== "object") {
    return null;
  }

  if (typeof entry.name === "string" && entry.name) {
    return entry.name;
  }

  const keys = Object.keys(entry);
  if (
    keys.length &&
    keys.every((key) => {
      const value = entry[key];
      return value && typeof value === "object" && typeof value.name === "string" && value.name;
    })
  ) {
    return keys.map((key) => `${key}: ${entry[key].name}`).join("\n");
  }

  return null;
};

const normalizeVariableEntry = (entry) => {
  if (entry == null) {
    return { displayValue: "null", rawValue: null, state: "null" };
  }

  if (typeof entry === "object") {
    if (entry.valueIsTooLarge) {
      return { displayValue: "[Value too large]", rawValue: null, state: "tooLarge" };
    }
    if (entry.redacted) {
      return { displayValue: "[Redacted]", rawValue: null, state: "redacted" };
    }
    if ("value" in entry) {
      return normalizeVariableEntry(entry.value);
    }
    const namedDisplay = formatNamedObjectDisplay(entry);
    if (namedDisplay) {
      return { displayValue: namedDisplay, rawValue: entry, state: "namedObject" };
    }
    return { displayValue: JSON.stringify(entry), rawValue: entry, state: "object" };
  }

  return { displayValue: String(entry), rawValue: entry, state: "value" };
};

const normalizeVariables = (variables = {}) => {
  const output = {};
  Object.entries(variables || {}).forEach(([name, entry]) => {
    output[name] = normalizeVariableEntry(entry);
  });
  return output;
};

const collectChildActions = (rawAction) => {
  const children = [];
  CHILD_COLLECTION_KEYS.forEach((key) => {
    asArray(rawAction?.[key]).forEach((child) => children.push(child));
  });
  return children;
};

const getByPath = (source, path) =>
  String(path || "")
    .split(".")
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), source);

const normalizeExecutionDocument = (raw) => {
  let value = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return raw;
    }
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  const wrapperKeys = [
    "renderedExecutionData",
    "executionData",
    "executionDocument",
    "document",
    "payload",
    "result",
    "data",
  ];

  for (const key of wrapperKeys) {
    const wrapped = value[key];
    if (wrapped == null) {
      continue;
    }

    if (typeof wrapped === "string") {
      try {
        return normalizeExecutionDocument(JSON.parse(wrapped));
      } catch {
        continue;
      }
    }

    if (typeof wrapped === "object") {
      const normalized = normalizeExecutionDocument(wrapped);
      if (normalized !== wrapped || Object.keys(normalized || {}).length) {
        return normalized;
      }
    }
  }

  if (Array.isArray(value.executions) && value.executions.length === 1 && typeof value.executions[0] === "object") {
    return normalizeExecutionDocument(value.executions[0]);
  }

  return value;
};

const looksLikeActionType = (value) =>
  typeof value === "string" &&
  (/^action/i.test(value) || /^(flowstart|flowend|decision|switch|transfer|prompt|task|loop)/i.test(value));

const isActionLike = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const trackingId = pickFirst(value, ["trackingId", "trackingID", "stepNumber", "sequence", "order"]);
  const actionType = pickFirst(value, ["actionType", "type", "actionKey", "objectType"]);
  const actionName = pickFirst(value, ["actionName", "name", "label", "displayName"]);
  const hasChildren = collectChildActions(value).length > 0;

  if (trackingId != null && (actionName || looksLikeActionType(actionType) || hasChildren)) {
    return true;
  }

  return Boolean(actionName && (looksLikeActionType(actionType) || hasChildren));
};

const findBestActionArray = (value, depth = 0, best = { score: 0, items: [], path: "" }) => {
  if (depth > 10 || value == null) {
    return best;
  }

  if (Array.isArray(value)) {
    const actionLike = value.filter(isActionLike);
    if (actionLike.length > best.score) {
      best = { score: actionLike.length, items: actionLike, path: `array(depth:${depth})` };
    }

    value.forEach((entry) => {
      best = findBestActionArray(entry, depth + 1, best);
    });
    return best;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((entry) => {
      best = findBestActionArray(entry, depth + 1, best);
    });
  }

  return best;
};

const findActionRoots = (raw) => {
  let normalized = normalizeExecutionDocument(raw);
  let actionRootPath = null;

  if (isGenesysRenderedFlowDocument(normalized)) {
    normalized = convertGenesysRenderedDocument(normalized);
    actionRootPath = "flow.execution";
  }

  for (const path of ACTION_ROOT_PATHS) {
    const candidate = getByPath(normalized, path);
    if (Array.isArray(candidate) && candidate.some(isActionLike)) {
      return { actions: candidate, actionRootPath: path };
    }
  }

  if (Array.isArray(normalized?.executions)) {
    for (const [index, execution] of normalized.executions.entries()) {
      for (const path of ["actions", "executionSteps", "steps", "executionHistory", "history"]) {
        const candidate = execution?.[path];
        if (Array.isArray(candidate) && candidate.some(isActionLike)) {
          return { actions: candidate, actionRootPath: `executions[${index}].${path}` };
        }
      }
    }
  }

  const actionMap = normalized?.actionsByTrackingId || normalized?.actionMap;
  if (actionMap && typeof actionMap === "object" && !Array.isArray(actionMap)) {
    const mapped = Object.values(actionMap).filter(isActionLike);
    if (mapped.length) {
      return { actions: mapped, actionRootPath: "actionsByTrackingId" };
    }
  }

  const discovered = findBestActionArray(normalized);
  if (discovered.score > 0) {
    return { actions: discovered.items, actionRootPath: discovered.path };
  }

  if (Array.isArray(normalized)) {
    const items = normalized.filter(isActionLike);
    if (items.length) {
      return { actions: items, actionRootPath: "[]" };
    }
  }

  if (isActionLike(normalized)) {
    return { actions: [normalized], actionRootPath: "root" };
  }

  return { actions: [], actionRootPath: null };
};

const parseActionNode = (rawAction, context, parentTrackingId = null) => {
  const trackingId = Number(rawAction?.trackingId ?? rawAction?.trackingID ?? rawAction?.id ?? context.nextTrackingId++);
  const actionType = pickFirst(rawAction, ["actionType", "type", "actionKey"]) || "unknownAction";
  const actionName =
    pickFirst(rawAction, ["actionName", "name", "label", "displayName"]) || actionType || "Unknown Action";
  const typeMeta = resolveActionTypeMetadata(actionType);
  const childActions = collectChildActions(rawAction).filter(isActionLike);
  const isGroup = childActions.length > 0 || isGroupActionType(actionType);
  const variables = normalizeVariables(rawAction?.variables || rawAction?.outputVariables || {});

  const node = {
    id: `track-${trackingId}`,
    trackingId,
    parentTrackingId,
    actionType,
    actionName,
    displayType: typeMeta.label,
    typeTone: typeMeta.tone,
    timestamp: pickFirst(rawAction, ["timestamp", "startTime", "startDateTime", "eventDateTime"]) || "",
    durationMs: Number(pickFirst(rawAction, ["durationMs", "duration", "elapsedMs"]) ?? 0) || 0,
    taskName: pickFirst(rawAction, ["taskName", "task"]) || "",
    commonModuleName: pickFirst(rawAction, ["commonModuleName", "commonModule", "moduleName"]) || "",
    actionId: pickFirst(rawAction, ["actionId", "id"]) || "",
    executionId: pickFirst(rawAction, ["executionId", "flowExecutionId"]) || context.executionId || "",
    inputData: rawAction?.inputData ?? rawAction?.input ?? null,
    outputData: rawAction?.outputData ?? rawAction?.output ?? null,
    variables,
    changedVariables: {},
    metadata: rawAction?.metadata || rawAction?.meta || {},
    outputPath: pickFirst(rawAction, ["outputPath", "result", "path", "branch"]) || "",
    errors: asArray(rawAction?.errors || rawAction?.errorMessages),
    warnings: asArray(rawAction?.warnings || rawAction?.warningMessages),
    isGroup,
    groupKind: /commonmodule/i.test(actionType)
      ? "commonModule"
      : /task/i.test(actionType)
        ? "task"
        : childActions.length
          ? "group"
          : null,
    childCount: childActions.length,
    children: [],
    flatIndex: -1,
  };

  node.children = childActions.map((child) => parseActionNode(child, context, trackingId));
  if (!node.childCount) {
    node.childCount = node.children.length;
  }

  return node;
};

const flattenTimeline = (nodes, output = []) => {
  nodes.forEach((node) => {
    node.flatIndex = output.length;
    output.push(node);
    if (node.isGroup && node.children.length) {
      flattenTimeline(node.children, output);
    }
  });
  return output;
};

const computeVariableChanges = (flatNodes) => {
  const previousValues = new Map();

  flatNodes.forEach((node) => {
    const changedVariables = {};
    Object.entries(node.variables).forEach(([name, entry]) => {
      const previous = previousValues.get(name);
      const serialized = JSON.stringify(entry.rawValue);
      const previousSerialized = previous ? JSON.stringify(previous.rawValue) : null;

      if (previousSerialized !== serialized) {
        changedVariables[name] = {
          previous: previous || { displayValue: "—", rawValue: null, state: "unset" },
          current: entry,
        };
      }

      previousValues.set(name, entry);
    });

    node.changedVariables = changedVariables;
  });
};

const buildVariableIndex = (flatNodes) => {
  const names = new Set();
  flatNodes.forEach((node) => {
    Object.keys(node.variables).forEach((name) => names.add(name));
  });
  return [...names].sort((left, right) => left.localeCompare(right));
};

const buildVariableHistory = (flatNodes) => {
  const history = {};
  const previousValues = new Map();

  flatNodes.forEach((node) => {
    Object.entries(node.variables || {}).forEach(([name, entry]) => {
      const serialized = JSON.stringify(entry.rawValue);
      const previous = previousValues.get(name);
      const previousSerialized = previous ? JSON.stringify(previous.rawValue) : null;

      if (previousSerialized !== serialized) {
        if (!history[name]) {
          history[name] = [];
        }
        history[name].push({
          actionId: String(node.actionId ?? node.trackingId ?? ""),
          trackingId: node.trackingId,
          actionName: node.actionName,
          newValue: entry,
          displayValue: entry.displayValue,
        });
      }

      previousValues.set(name, entry);
    });
  });

  return history;
};

const buildVariableStateTimeline = (flatNodes) => {
  const cumulative = new Map();

  return flatNodes.map((node) => {
    Object.entries(node.variables || {}).forEach(([name, entry]) => {
      cumulative.set(name, entry);
    });
    return Object.fromEntries(cumulative);
  });
};

const countErrors = (flatNodes) =>
  flatNodes.reduce((total, node) => total + (Array.isArray(node.errors) ? node.errors.length : 0), 0);

const countWarnings = (flatNodes) =>
  flatNodes.reduce((total, node) => total + (Array.isArray(node.warnings) ? node.warnings.length : 0), 0);

const computeDurationMs = (summary, flatNodes) => {
  if (summary.startTime && summary.endTime) {
    const start = Date.parse(summary.startTime);
    const end = Date.parse(summary.endTime);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return end - start;
    }
  }

  return flatNodes.reduce((total, node) => total + (Number(node.durationMs) || 0), 0);
};

const buildSummary = (raw, flatNodes, context) => {
  const flowInstance = raw?.flowInstance || raw?.instance || raw?.flow || {};
  const startTime =
    pickFirst(flowInstance, ["startDateTime", "startTime"]) ||
    pickFirst(raw, ["startDateTime", "startTime"]) ||
    flatNodes[0]?.timestamp ||
    "";
  const endTime =
    pickFirst(flowInstance, ["endDateTime", "endTime"]) ||
    pickFirst(raw, ["endDateTime", "endTime"]) ||
    flatNodes[flatNodes.length - 1]?.timestamp ||
    "";

  return {
    conversationId: context.conversationId || pickFirst(flowInstance, ["conversationId"]) || "",
    executionId:
      context.instanceId ||
      pickFirst(flowInstance, ["id", "flowInstanceId", "executionId"]) ||
      flatNodes[0]?.executionId ||
      "",
    flowName: context.flowName || pickFirst(flowInstance, ["flowName", "name"]) || "",
    flowType: context.flowType || pickFirst(flowInstance, ["flowType", "type"]) || "",
    flowVersion: context.flowVersion || pickFirst(flowInstance, ["flowVersion", "version"]) || "",
    startTime,
    endTime,
    executionTimeMs: computeDurationMs({ startTime, endTime }, flatNodes),
    actionsExecuted: flatNodes.length,
    errors: countErrors(flatNodes),
    warnings: countWarnings(flatNodes),
    flowExitReason:
      pickFirst(flowInstance, ["flowExitReason", "exitReason"]) ||
      pickFirst(raw, ["flowExitReason", "exitReason"]) ||
      "",
  };
};

const parseExecutionJson = (raw, context = {}) => {
  const parserContext = {
    conversationId: context.conversationId || "",
    instanceId: context.instanceId || "",
    flowName: context.flowName || "",
    flowType: context.flowType || "",
    flowVersion: context.flowVersion || "",
    executionId: context.executionId || "",
    nextTrackingId: 1,
  };

  const normalized = normalizeExecutionDocument(raw);
  const { actions: roots, actionRootPath } = findActionRoots(normalized);
  const nodes = roots.map((action) => parseActionNode(action, parserContext));
  const flatNodes = flattenTimeline(nodes);
  computeVariableChanges(flatNodes);
  const variableHistory = buildVariableHistory(flatNodes);
  const variableStateByFlatIndex = buildVariableStateTimeline(flatNodes);

  const summary = buildSummary(normalized, flatNodes, {
    ...context,
    instanceId: parserContext.instanceId,
  });

  return {
    summary,
    nodes,
    flatNodes,
    variableIndex: buildVariableIndex(flatNodes),
    variableHistory,
    variableStateByFlatIndex,
    meta: {
      actionRootPath,
      documentKeys:
        normalized && typeof normalized === "object" && !Array.isArray(normalized)
          ? Object.keys(normalized)
          : [],
    },
  };
};

export {
  buildVariableIndex,
  collectChildActions,
  findActionRoots,
  flattenTimeline,
  normalizeExecutionDocument,
  normalizeVariableEntry,
  parseActionNode,
  parseExecutionJson,
};
