const mapBotFlowOptions = (flows) =>
  (flows || [])
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .map((flow) => ({
      value: flow.id,
      label: `${flow.name || flow.id} ver. ${flow.publishedVersion?.id || ""}`,
      flowName: flow.name || flow.id,
      versionId: flow.publishedVersion?.id || "",
    }));

const getSelectedBotFlow = (flowOptions, flowId) =>
  (flowOptions || []).find((option) => String(option.value) === String(flowId || "")) || null;

const validatePublishedBotFlow = (selectedFlow) => {
  if (!selectedFlow) {
    return "Select a bot flow before continuing.";
  }

  if (!selectedFlow.versionId) {
    return `${selectedFlow.flowName || selectedFlow.label} does not have a published version.`;
  }

  return "";
};

export { getSelectedBotFlow, mapBotFlowOptions, validatePublishedBotFlow };
