const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

const isGenesysRenderedFlowDocument = (raw) => Array.isArray(raw?.flow?.execution);

const convertGenesysVariableList = (list) => {
  const variables = {};
  asArray(list).forEach((entry) => {
    if (!entry?.variableName) {
      return;
    }
    variables[entry.variableName] = { value: entry.value };
  });
  return variables;
};

const extractGenesysVariables = (payload = {}) => ({
  ...convertGenesysVariableList(payload.variables),
  ...convertGenesysVariableList(payload.outputVariables),
  ...convertGenesysVariableList(
    asArray(payload.statements).map((statement) => ({
      variableName: statement.variableName,
      value: statement.value,
    }))
  ),
});

const unwrapGenesysEvent = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const keys = Object.keys(entry);
  if (!keys.length) {
    return null;
  }

  const eventType = keys[0];
  return { eventType, payload: entry[eventType] || {} };
};

const parseGenesysEventNode = (entry, context) => {
  const event = unwrapGenesysEvent(entry);
  if (!event) {
    return null;
  }

  const { eventType, payload } = event;

  if (/^action/i.test(eventType)) {
    const childEntries = Array.isArray(payload.execution) ? payload.execution : [];
    const children = childEntries.map((child) => parseGenesysEventNode(child, context)).filter(Boolean);
    const commonModuleName =
      eventType === "actionCallCommonModule"
        ? payload.inputData?.commonModule?.flowName || payload.actionName || ""
        : "";

    return {
      trackingId: payload.trackingId ?? context.nextTrackingId++,
      actionType: eventType,
      actionName: payload.actionName || eventType,
      actionId: payload.actionId || "",
      executionId: payload.executionId || "",
      timestamp: payload.dateTime || payload.timestamp || "",
      durationMs: Number(payload.durationMs) || 0,
      taskName: context.taskName || "",
      commonModuleName,
      inputData: payload.inputData ?? null,
      outputData: payload.outputData ?? null,
      outputPath: payload.outputPathName || payload.outputPathId || "",
      variables: extractGenesysVariables(payload),
      errors: asArray(payload.errors),
      warnings: asArray(payload.warnings),
      metadata: {
        flowMilestone: payload.inputData?.flowMilestone?.name || null,
        hasAudio: Boolean(payload.audio),
      },
      ...(children.length ? { actions: children } : {}),
    };
  }

  if (eventType === "startedTask") {
    context.taskName = payload.taskName || context.taskName;
    return {
      trackingId: context.nextTrackingId++,
      actionType: "startedTask",
      actionName: payload.taskName || "Task Start",
      timestamp: payload.dateTime || "",
      taskName: payload.taskName || "",
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "endedTask") {
    const taskName = context.taskName;
    context.taskName = "";
    return {
      trackingId: context.nextTrackingId++,
      actionType: "endedTask",
      actionName: taskName ? `End ${taskName}` : "Task End",
      timestamp: payload.dateTime || "",
      taskName,
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "startedFlow") {
    return {
      trackingId: context.nextTrackingId++,
      actionType: "actionFlowStart",
      actionName: "Flow Start",
      timestamp: payload.dateTime || "",
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "endedFlow") {
    return {
      trackingId: context.nextTrackingId++,
      actionType: "actionFlowEnd",
      actionName: "Flow End",
      timestamp: payload.dateTime || "",
      outputPath: payload.flowExitReason || "",
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "startedCommonModule") {
    context.commonModuleName = payload.commonModuleName || context.commonModuleName;
    return {
      trackingId: context.nextTrackingId++,
      actionType: "startedCommonModule",
      actionName: "Common Module Start",
      timestamp: payload.dateTime || "",
      commonModuleName: context.commonModuleName,
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "endedCommonModule") {
    const commonModuleName = context.commonModuleName;
    context.commonModuleName = "";
    return {
      trackingId: context.nextTrackingId++,
      actionType: "endedCommonModule",
      actionName: commonModuleName ? `End ${commonModuleName}` : "Common Module End",
      timestamp: payload.dateTime || "",
      commonModuleName,
      variables: extractGenesysVariables(payload),
    };
  }

  if (eventType === "eventLoop") {
    return {
      trackingId: context.nextTrackingId++,
      actionType: "eventLoop",
      actionName: "Loop Event",
      timestamp: payload.dateTime || "",
      outputPath: payload.outputPathId || "",
      variables: extractGenesysVariables(payload),
    };
  }

  return {
    trackingId: context.nextTrackingId++,
    actionType: eventType,
    actionName: eventType,
    timestamp: payload.dateTime || "",
    variables: extractGenesysVariables(payload),
  };
};

const convertGenesysRenderedDocument = (raw) => {
  const flow = raw?.flow;
  if (!flow || !Array.isArray(flow.execution)) {
    return null;
  }

  const context = {
    nextTrackingId: 1,
    taskName: "",
    commonModuleName: "",
  };

  const actions = flow.execution.map((entry) => parseGenesysEventNode(entry, context)).filter(Boolean);
  const endEvent = [...actions].reverse().find((node) => node.actionType === "actionFlowEnd");

  return {
    flowInstance: {
      id: flow.executionId || "",
      conversationId: flow.conversationId || "",
      flowName: flow.flowName || "",
      flowType: flow.flowType || "",
      flowVersion: flow.flowVersion || "",
      startDateTime: flow.startDateTime || "",
      endDateTime: flow.endDateTime || "",
      flowExitReason: endEvent?.outputPath || "",
    },
    execution: { actions },
  };
};

export {
  convertGenesysRenderedDocument,
  extractGenesysVariables,
  isGenesysRenderedFlowDocument,
  parseGenesysEventNode,
  unwrapGenesysEvent,
};
