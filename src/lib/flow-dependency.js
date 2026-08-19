import { genesysPaginatedRequest, genesysRequest } from "./genesys.js";
import { genesysRequestWithMeta } from "./flow-dependency-request.js";
import {
  ALL_CONSUMING_FLOW_TYPES,
  ELIGIBILITY,
  VERSION_STATE,
  getFlowTypeDefinition,
  mapConsumingResourceTypeToFlowTypeKey,
  normalizeDependencyObjectType,
  resolveDependencyObjectType,
} from "./flow-dependency-types.js";

const normalizeVersionLabel = (value) => String(value ?? "").trim();

const compareVersionLabels = (left, right) => {
  const leftLabel = normalizeVersionLabel(left);
  const rightLabel = normalizeVersionLabel(right);
  if (!leftLabel || !rightLabel) {
    return 0;
  }

  const leftNumber = Number(leftLabel);
  const rightNumber = Number(rightLabel);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: "base" });
};

const buildArchitectFlowUrl = ({ appDomain, flowId }) => {
  const safeDomain = String(appDomain || "").trim();
  const safeFlowId = encodeURIComponent(String(flowId || "").trim());
  if (!safeDomain || !safeFlowId) {
    return "";
  }
  return `https://apps.${safeDomain}/architect/#/flows/${safeFlowId}`;
};

const normalizeFlowSummary = (flow) => ({
  id: String(flow?.id || "").trim(),
  name: String(flow?.name || flow?.id || "").trim(),
  type: normalizeDependencyObjectType(flow?.type || flow?.flowType),
  publishedVersionId: String(flow?.publishedVersion?.id || "").trim(),
  dependencyTrackingId: String(flow?.dependencyTrackingId || flow?.id || "").trim(),
});

const listArchitectFlowsByType = async ({ region, token, flowTypeKey }) => {
  const definition = getFlowTypeDefinition(flowTypeKey);
  if (!definition) {
    throw new Error("A valid flow type is required.");
  }

  const flows = await genesysPaginatedRequest({
    region,
    token,
    path: `/api/v2/flows?type=${encodeURIComponent(definition.listQueryType)}`,
    pageSize: 100,
  });

  return flows
    .map(normalizeFlowSummary)
    .filter((flow) => flow.id)
    .sort((left, right) => left.name.localeCompare(right.name));
};

const fetchConsumingResourcesPage = async ({ region, token, id, objectType, pageNumber, pageSize }) => {
  const query = new URLSearchParams({
    id: String(id || "").trim(),
    objectType: resolveDependencyObjectType(objectType),
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  return genesysRequestWithMeta({
    region,
    token,
    path: `/api/v2/architect/dependencytracking/consumingresources?${query.toString()}`,
  });
};

const getConsumingResources = async ({ region, token, id, objectType, pageSize = 100 }) => {
  let pageNumber = 1;
  let pageCount = 1;
  const entities = [];
  let partialResults = false;

  while (pageNumber <= pageCount) {
    const { data, partial } = await fetchConsumingResourcesPage({
      region,
      token,
      id,
      objectType,
      pageNumber,
      pageSize,
    });

    partialResults = partialResults || partial;
    if (Array.isArray(data?.entities)) {
      entities.push(...data.entities);
    }

    pageCount = Number(data?.pageCount || 1);
    pageNumber += 1;
  }

  return { entities, partialResults };
};

const getFlowDetail = async ({ region, token, flowId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/flows/${encodeURIComponent(flowId)}`,
  });

const isConsumingFlowEntity = (entry) => {
  const type = resolveDependencyObjectType(entry?.type || entry?.objectType);
  return (
    ALL_CONSUMING_FLOW_TYPES.has(type) ||
    ALL_CONSUMING_FLOW_TYPES.has(normalizeDependencyObjectType(entry?.type || entry?.objectType))
  );
};

const groupConsumingResources = (entities) => {
  const groups = new Map();

  entities.forEach((entry) => {
    const flowId = String(entry?.id || "").trim();
    if (!flowId || !isConsumingFlowEntity(entry)) {
      return;
    }

    if (!groups.has(flowId)) {
      groups.set(flowId, {
        flowId,
        flowName: String(entry?.name || flowId).trim(),
        flowType: normalizeDependencyObjectType(entry?.type || entry?.objectType),
        entries: [],
      });
    }

    groups.get(flowId).entries.push(entry);
  });

  return [...groups.values()].sort((left, right) => left.flowName.localeCompare(right.flowName));
};

const collectDependencyVersions = (group) =>
  [...new Set(group.entries.map((entry) => normalizeVersionLabel(entry?.version)).filter(Boolean))].sort((left, right) =>
    compareVersionLabels(right, left)
  );

const buildVersionDetails = ({ dependencyVersions, publishedVersionId }) =>
  dependencyVersions.map((versionId) => {
    if (publishedVersionId && versionId === publishedVersionId) {
      return {
        versionId,
        state: VERSION_STATE.PUBLISHED,
        hasDependency: true,
      };
    }

    if (publishedVersionId && compareVersionLabels(versionId, publishedVersionId) < 0) {
      return {
        versionId,
        state: VERSION_STATE.HISTORICAL,
        hasDependency: true,
      };
    }

    return {
      versionId,
      state: VERSION_STATE.UNPUBLISHED,
      hasDependency: true,
    };
  });

const buildEligibility = ({ activeDependency, newerUnpublishedVersions }) => {
  if (!activeDependency) {
    return {
      eligibility: ELIGIBILITY.HISTORICAL_DEPENDENCY_ONLY,
      eligibilityReason: "The current published version does not depend on this module.",
    };
  }

  if (newerUnpublishedVersions.length) {
    return {
      eligibility: ELIGIBILITY.NEWER_VERSION_EXISTS,
      eligibilityReason:
        "Republish unavailable. The published version depends on this Common Module, but a newer unpublished version exists.",
    };
  }

  return {
    eligibility: ELIGIBILITY.ELIGIBLE,
    eligibilityReason: "Eligible for republish.",
  };
};

const buildFlowDependencyResult = ({ group, flowDetail, appDomain }) => {
  const flowTypeKey = mapConsumingResourceTypeToFlowTypeKey(group.flowType);
  const dependencyVersions = collectDependencyVersions(group);
  const publishedVersionId = normalizeVersionLabel(flowDetail?.publishedVersion?.id);
  const workingVersionId = normalizeVersionLabel(flowDetail?.version?.id);

  const publishedHasDependency = publishedVersionId
    ? dependencyVersions.includes(publishedVersionId)
    : false;

  const newerUnpublishedVersions = dependencyVersions
    .filter((versionId) => publishedVersionId && compareVersionLabels(versionId, publishedVersionId) > 0)
    .map((versionId) => ({
      versionId,
      state: VERSION_STATE.UNPUBLISHED,
      hasDependency: true,
    }));

  if (
    workingVersionId &&
    publishedVersionId &&
    compareVersionLabels(workingVersionId, publishedVersionId) > 0 &&
    !newerUnpublishedVersions.some((entry) => entry.versionId === workingVersionId)
  ) {
    newerUnpublishedVersions.push({
      versionId: workingVersionId,
      state: VERSION_STATE.UNPUBLISHED,
      hasDependency: dependencyVersions.includes(workingVersionId),
    });
  }

  const historicalDependencyVersions = dependencyVersions
    .filter((versionId) => publishedVersionId && compareVersionLabels(versionId, publishedVersionId) < 0)
    .map((versionId) => ({
      versionId,
      state: VERSION_STATE.HISTORICAL,
      hasDependency: true,
    }));

  const { eligibility, eligibilityReason } = buildEligibility({
    activeDependency: publishedHasDependency,
    newerUnpublishedVersions,
  });

  return {
    flowId: group.flowId,
    flowName: group.flowName,
    flowType: group.flowType,
    flowTypeKey,
    publishedVersionId,
    activeDependency: publishedHasDependency,
    eligibility,
    eligibilityReason,
    newerUnpublishedVersions,
    historicalDependencyVersions,
    versionDetails: buildVersionDetails({ dependencyVersions, publishedVersionId }),
    architectUrl: buildArchitectFlowUrl({ appDomain, flowId: group.flowId }),
  };
};

const buildDependencySummary = (results, selectedFlow) => {
  const activeResults = results.filter((entry) => entry.activeDependency);
  const eligibleResults = results.filter((entry) => entry.eligibility === ELIGIBILITY.ELIGIBLE);
  const historicalResults = results.filter(
    (entry) => entry.eligibility === ELIGIBILITY.HISTORICAL_DEPENDENCY_ONLY
  );
  const newerVersionResults = results.filter((entry) => entry.eligibility === ELIGIBILITY.NEWER_VERSION_EXISTS);

  return {
    selectedFlowId: selectedFlow.id,
    selectedFlowName: selectedFlow.name,
    selectedFlowType: selectedFlow.type,
    sourceModule: {
      id: selectedFlow.id,
      name: selectedFlow.name,
      version: "published",
    },
    totalDependentFlows: results.length,
    activeDependencies: activeResults.length,
    republishEligible: eligibleResults.length,
    historicalOnly: historicalResults.length,
    newerUnpublished: newerVersionResults.length,
  };
};

const orderDependencyResults = (results) => {
  const active = results
    .filter((entry) => entry.activeDependency)
    .sort((left, right) => left.flowName.localeCompare(right.flowName));
  const inactive = results
    .filter((entry) => !entry.activeDependency)
    .sort((left, right) => left.flowName.localeCompare(right.flowName));

  return { active, inactive, ordered: [...active, ...inactive] };
};

const discoverFlowDependencies = async ({
  region,
  token,
  selectedFlowId,
  sourceFlowTypeKey,
  appDomain,
}) => {
  const sourceDefinition = getFlowTypeDefinition(sourceFlowTypeKey);
  if (!sourceDefinition) {
    throw new Error("A valid source flow type is required.");
  }

  const selectedFlowIdNormalized = String(selectedFlowId || "").trim();
  if (!selectedFlowIdNormalized) {
    throw new Error("A source flow must be selected.");
  }

  const flows = await listArchitectFlowsByType({ region, token, flowTypeKey: sourceDefinition.key });
  const selectedFlow = flows.find((flow) => flow.id === selectedFlowIdNormalized);
  if (!selectedFlow) {
    throw new Error("The selected flow could not be found.");
  }

  const { entities, partialResults } = await getConsumingResources({
    region,
    token,
    id: selectedFlow.dependencyTrackingId || selectedFlow.id,
    objectType: sourceDefinition.dependencyObjectType,
  });

  const groups = groupConsumingResources(entities);
  const analyzed = [];

  for (const group of groups) {
    const flowDetail = await getFlowDetail({ region, token, flowId: group.flowId });
    analyzed.push(buildFlowDependencyResult({ group, flowDetail, appDomain }));
  }

  const { active, inactive, ordered } = orderDependencyResults(analyzed);

  return {
    partialResults,
    warning: partialResults
      ? "Dependency tracking returned partial results (HTTP 206). Results may be incomplete until the dependency database rebuild completes."
      : "",
    summary: buildDependencySummary(ordered, selectedFlow),
    activeResults: active,
    inactiveResults: inactive,
    results: ordered,
    selectedFlow,
  };
};

const refreshDependencyResult = async ({ region, token, result, appDomain }) => {
  const flowDetail = await getFlowDetail({ region, token, flowId: result.flowId });
  const group = {
    flowId: result.flowId,
    flowName: result.flowName,
    flowType: result.flowType,
    entries: (result.versionDetails || []).map((entry) => ({
      id: result.flowId,
      name: result.flowName,
      type: result.flowType,
      version: entry.versionId,
    })),
  };

  return buildFlowDependencyResult({ group, flowDetail, appDomain });
};

export {
  buildArchitectFlowUrl,
  buildDependencySummary,
  buildFlowDependencyResult,
  collectDependencyVersions,
  compareVersionLabels,
  discoverFlowDependencies,
  getConsumingResources,
  groupConsumingResources,
  listArchitectFlowsByType,
  orderDependencyResults,
  refreshDependencyResult,
};
