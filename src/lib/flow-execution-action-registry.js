const ACTION_TYPE_REGISTRY = {
  actionFlowStart: { label: "Flow Start", tone: "start" },
  actionFlowEnd: { label: "Flow End", tone: "end" },
  actionDecision: { label: "Decision", tone: "decision" },
  actionSwitch: { label: "Switch", tone: "decision" },
  actionDataAction: { label: "Data Action", tone: "data" },
  actionTransferToAcd: { label: "Transfer to ACD", tone: "transfer" },
  actionTransferToFlow: { label: "Transfer to Flow", tone: "transfer" },
  actionTransferToUser: { label: "Transfer to User", tone: "transfer" },
  actionPlayPrompt: { label: "Prompt", tone: "prompt" },
  actionCollectInput: { label: "Collect Input", tone: "input" },
  actionLoop: { label: "Loop", tone: "loop" },
  actionLoopEntry: { label: "Loop Entry", tone: "loop" },
  actionLoopExit: { label: "Loop Exit", tone: "loop" },
  actionTask: { label: "Task", tone: "task" },
  actionCommonModule: { label: "Common Module", tone: "module" },
  actionCallCommonModule: { label: "Call Common Module", tone: "module" },
  actionCommonModuleEntry: { label: "Common Module Entry", tone: "module" },
  actionCommonModuleExit: { label: "Common Module Exit", tone: "module" },
  actionUpdateData: { label: "Update Data", tone: "variable" },
  actionDataTableLookup: { label: "Data Table Lookup", tone: "data" },
  actionSetParticipantData: { label: "Set Participant Data", tone: "data" },
  actionPlayAudio: { label: "Play Audio", tone: "prompt" },
  actionJumpToTask: { label: "Jump to Task", tone: "task" },
  startedTask: { label: "Task Start", tone: "task" },
  endedTask: { label: "Task End", tone: "task" },
  actionGetParticipantData: { label: "Get Participant Data", tone: "data" },
  actionUpdateParticipantData: { label: "Update Participant Data", tone: "data" },
  actionDisconnect: { label: "Disconnect", tone: "end" },
  actionEndFlow: { label: "End Flow", tone: "end" },
};

const normalizeActionTypeKey = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "")
    .replace(/^action/i, "action");

const resolveActionTypeMetadata = (actionType) => {
  const key = String(actionType || "").trim();
  if (!key) {
    return { label: "Unknown Action", tone: "unknown", key: "unknown" };
  }

  const direct = ACTION_TYPE_REGISTRY[key];
  if (direct) {
    return { ...direct, key };
  }

  const normalized = normalizeActionTypeKey(key);
  const normalizedMatch = ACTION_TYPE_REGISTRY[normalized];
  if (normalizedMatch) {
    return { ...normalizedMatch, key };
  }

  const humanized = key
    .replace(/^action/i, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();

  return {
    label: humanized || key,
    tone: "unknown",
    key,
  };
};

const isGroupActionType = (actionType) => {
  const key = String(actionType || "");
  return /task|commonmodule/i.test(key) && !/entry|exit/i.test(key);
};

export { ACTION_TYPE_REGISTRY, isGroupActionType, resolveActionTypeMetadata };
