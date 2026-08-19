const FLOW_TYPE_CATALOG = {
  bot: {
    key: "bot",
    label: "Bot Flows",
    listQueryType: "bot,digitalbot",
    dependencyObjectType: "BOTFLOW",
    validateFlowType: "bot",
    consumingResourceTypes: new Set(["BOTFLOW", "DIGITALBOTFLOW"]),
  },
  commonmodule: {
    key: "commonmodule",
    label: "Common Module Flows",
    listQueryType: "commonmodule",
    dependencyObjectType: "COMMONMODULEFLOW",
    validateFlowType: "commonmodule",
    consumingResourceTypes: new Set(["COMMONMODULEFLOW"]),
  },
  inbound: {
    key: "inbound",
    label: "Inbound Flows",
    listQueryType: "inboundcall",
    dependencyObjectType: "INBOUNDCALLFLOW",
    validateFlowType: "inboundcall",
    consumingResourceTypes: new Set(["INBOUNDCALL", "INBOUNDCALLFLOW"]),
  },
  inqueue: {
    key: "inqueue",
    label: "In-Queue Flows",
    listQueryType: "inqueuecall",
    dependencyObjectType: "INQUEUECALLFLOW",
    validateFlowType: "inqueuecall",
    consumingResourceTypes: new Set(["INQUEUECALL", "INQUEUECALLFLOW"]),
  },
};

const FLOW_TYPE_OPTIONS = Object.values(FLOW_TYPE_CATALOG).map(({ key, label }) => ({ key, label }));

const ALL_CONSUMING_FLOW_TYPES = new Set(
  Object.values(FLOW_TYPE_CATALOG).flatMap((entry) => [...entry.consumingResourceTypes])
);

const ELIGIBILITY = {
  ELIGIBLE: "ELIGIBLE",
  NEWER_VERSION_EXISTS: "NEWER_VERSION_EXISTS",
  HISTORICAL_DEPENDENCY_ONLY: "HISTORICAL_DEPENDENCY_ONLY",
  NOT_A_DEPENDENCY: "NOT_A_DEPENDENCY",
};

const VERSION_STATE = {
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  HISTORICAL: "Historical",
};

const normalizeFlowTypeKey = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return FLOW_TYPE_CATALOG[key] ? key : "";
};

const getFlowTypeDefinition = (flowTypeKey) => FLOW_TYPE_CATALOG[normalizeFlowTypeKey(flowTypeKey)] || null;

const normalizeDependencyObjectType = (resourceType) => String(resourceType || "").trim().toUpperCase();

const DEPENDENCY_OBJECT_TYPE_ALIASES = {
  INBOUNDCALL: "INBOUNDCALLFLOW",
  INQUEUECALL: "INQUEUECALLFLOW",
  BOT: "BOTFLOW",
  DIGITALBOT: "DIGITALBOTFLOW",
  COMMONMODULE: "COMMONMODULEFLOW",
};

const resolveDependencyObjectType = (resourceType) => {
  const normalized = normalizeDependencyObjectType(resourceType);
  return DEPENDENCY_OBJECT_TYPE_ALIASES[normalized] || normalized;
};

const mapConsumingResourceTypeToFlowTypeKey = (resourceType) => {
  const normalized = resolveDependencyObjectType(resourceType);
  for (const definition of Object.values(FLOW_TYPE_CATALOG)) {
    if (definition.consumingResourceTypes.has(normalized) || definition.consumingResourceTypes.has(normalizeDependencyObjectType(resourceType))) {
      return definition.key;
    }
  }
  return "";
};

export {
  ALL_CONSUMING_FLOW_TYPES,
  ELIGIBILITY,
  FLOW_TYPE_CATALOG,
  FLOW_TYPE_OPTIONS,
  VERSION_STATE,
  getFlowTypeDefinition,
  mapConsumingResourceTypeToFlowTypeKey,
  normalizeDependencyObjectType,
  normalizeFlowTypeKey,
  resolveDependencyObjectType,
};
