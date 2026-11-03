import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";
import { renderChatAgentTracePanel, mountChatAgentTraceView } from "./chat-agent-message-trace-view.js";
import { createWebMessagingGuestChat } from "./web-messaging-guest-chat.js";
import { createAgenticVirtualAgentChat } from "./agentic-virtual-agent-chat.js";
import { loadRegistrationState, upsertRegistration } from "./chat-agent-registration.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const mapDeploymentOptions = (deployments) =>
  (deployments || []).map((deployment) => ({
    value: deployment.id,
    label: `${deployment.name || deployment.id} (${deployment.status || "unknown"})`,
    deployment,
  }));

const mapAgentOptions = (agents) =>
  (agents || []).map((agent) => ({
    value: agent.id,
    label: `${agent.name || agent.id}${agent.latestProductionReadyVersion ? ` v${agent.latestProductionReadyVersion}` : ""}`,
    agent,
  }));

const isOriginAllowedForDeployment = (deployment, origin) => {
  if (!deployment) {
    return true;
  }
  if (deployment.allowAllDomains) {
    return true;
  }
  const allowed = Array.isArray(deployment.allowedDomains) ? deployment.allowedDomains : [];
  if (!allowed.length) {
    return false;
  }
  try {
    const { hostname } = new URL(origin);
    return allowed.some((domain) => {
      const normalized = String(domain || "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
};

const renderConversation = (messages, quickReplies) => {
  const bubbles = (messages || [])
    .map(
      (entry) =>
        `<div class="chat-agent-bubble chat-agent-bubble--${escapeHtml(entry.role)}"><span class="chat-agent-bubble__role">${escapeHtml(
          entry.role === "customer" ? "You" : "Agent"
        )}</span><div>${escapeHtml(entry.text)}</div></div>`
    )
    .join("");

  const chips = (quickReplies || [])
    .map(
      (reply) =>
        `<button type="button" class="chat-agent-quick-reply" data-quick-reply="${escapeHtml(
          reply.value || reply.text
        )}">${escapeHtml(reply.text)}</button>`
    )
    .join("");

  return `<div class="chat-agent-conversation">${bubbles || '<p class="muted">No messages yet.</p>'}${
    chips ? `<div class="chat-agent-quick-replies">${chips}</div>` : ""
  }</div>`;
};

const createChatAgentTesterFeature = ({
  state,
  getWebDeployments,
  getWebDeployment,
  getAgenticVirtualAgents,
  addAgenticGuideSessionTurn,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  getCurrentAppDomain,
}) => {
  const rerender = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta?.renderBody) {
      return;
    }
    resultEl.querySelector(".export-results__body").innerHTML = exportMeta.renderBody();
    exportMeta.traceMount?.unsubscribe?.();
    exportMeta.traceMount = mountChatAgentTraceView(resultId, {
      onClear: () => {
        exportMeta.conversationMessages = [];
        exportMeta.quickReplies = [];
      },
    });
  };

  const renderSetup = (resultId, featureState) => {
    const mode = featureState.mode || "webDeployment";
    const deploymentOptions = featureState.deploymentOptions || [];
    const agentOptions = featureState.agentOptions || [];
    const selectedDeploymentId = String(featureState.selectedDeploymentId || "");
    const selectedAgentId = String(featureState.selectedAgentId || "");
    const deploymentDetail = featureState.deploymentDetail;
    const origin = getCurrentAppDomain?.() || window.location.origin;
    const originAllowed = isOriginAllowedForDeployment(deploymentDetail, origin);

    return `<div class="column-editor chat-agent-tester">
      <div class="column-editor__header">Chat Agent Tester</div>
      <div class="sidebar-actions">
        <div class="bulk-control-row">
          <label class="field-label">Mode</label>
          <select class="chat-agent-mode-select" data-result-id="${escapeHtml(resultId)}">
            <option value="webDeployment"${mode === "webDeployment" ? " selected" : ""}>Web Messenger deployment</option>
            <option value="agenticAgent"${mode === "agenticAgent" ? " selected" : ""}>Agentic virtual agent</option>
          </select>
        </div>
        ${
          mode === "webDeployment"
            ? renderGuxFieldSelect({
                escapeHtml,
                inputId: `${resultId}-chat-deployment`,
                className: "chat-agent-deployment-select",
                label: "Messenger deployment",
                optionsHtml: `<option value="">Select deployment</option>${deploymentOptions
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.value)}"${
                        option.value === selectedDeploymentId ? " selected" : ""
                      }>${escapeHtml(option.label)}</option>`
                  )
                  .join("")}`,
                attrs: `data-result-id="${escapeHtml(resultId)}"`,
              })
            : renderGuxFieldSelect({
                escapeHtml,
                inputId: `${resultId}-chat-agent`,
                className: "chat-agent-agent-select",
                label: "Agentic virtual agent",
                optionsHtml: `<option value="">Select agent</option>${agentOptions
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.value)}"${
                        option.value === selectedAgentId ? " selected" : ""
                      }>${escapeHtml(option.label)}</option>`
                  )
                  .join("")}`,
                attrs: `data-result-id="${escapeHtml(resultId)}"`,
              })
        }
        ${
          deploymentDetail && mode === "webDeployment"
            ? `<div class="chat-agent-meta muted">
                <div><strong>Flow:</strong> ${escapeHtml(deploymentDetail.flowName || deploymentDetail.flowId || "—")}</div>
                <div><strong>Status:</strong> ${escapeHtml(deploymentDetail.status || "—")}</div>
                <div><strong>Domains:</strong> ${
                  deploymentDetail.allowAllDomains
                    ? "Allow all domains"
                    : escapeHtml((deploymentDetail.allowedDomains || []).join(", ") || "Restricted (none listed)")
                }</div>
                ${
                  !originAllowed
                    ? `<p class="chat-agent-warning">This PS Tool origin (${escapeHtml(
                        origin
                      )}) may be blocked by the deployment domain policy. Add it in Genesys Admin or enable allow-all for testing.</p>`
                    : ""
                }
              </div>`
            : ""
        }
        ${
          featureState.selectedAgent && mode === "agenticAgent"
            ? `<div class="chat-agent-meta muted">
                <div><strong>Guide ID:</strong> ${escapeHtml(featureState.selectedAgent.guideId || "—")}</div>
                <div><strong>Production version:</strong> ${escapeHtml(
                  featureState.selectedAgent.latestProductionReadyVersion || "—"
                )}</div>
                ${
                  !featureState.selectedAgent.guideId
                    ? `<p class="chat-agent-warning">This agent has no guideId. Guide session turns cannot be sent until the agent is linked to a guide in AI Studio.</p>`
                    : ""
                }
              </div>`
            : ""
        }
        <div class="bulk-control-row bulk-control-row--actions">
          <gux-button class="chat-agent-save-registration" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}">Save registration</gux-button>
          <gux-button class="chat-agent-start-session" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Start session</gux-button>
          <gux-button class="chat-agent-end-session" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}">End session</gux-button>
        </div>
        <p class="chat-agent-status muted" id="${escapeHtml(resultId)}-chat-status">${escapeHtml(
          featureState.chatStatus || "Select a target and start a session."
        )}</p>
        <p class="muted">Conversation ID / session: <span id="${escapeHtml(resultId)}-conversation-id">${escapeHtml(
          featureState.conversationId || "—"
        )}</span></p>
      </div>
      ${renderConversation(featureState.conversationMessages, featureState.quickReplies)}
      <div class="chat-agent-composer">
        <input class="chat-agent-input" id="${escapeHtml(resultId)}-chat-input" type="text" placeholder="Type a message..." />
        <gux-button class="chat-agent-send" type="button" accent="primary" data-result-id="${escapeHtml(
          resultId
        )}">Send</gux-button>
      </div>
      ${renderChatAgentTracePanel({ resultId })}
    </div>`;
  };

  const getExportMeta = (resultId) => state.exportData[resultId];

  const setChatStatus = (resultId, exportMeta, message) => {
    exportMeta.chatStatus = message;
    const statusEl = document.getElementById(`${resultId}-chat-status`);
    if (statusEl) {
      statusEl.textContent = message;
    }
  };

  const ensureChatController = (resultId, exportMeta, credentials) => {
    if (exportMeta.chatController) {
      return exportMeta.chatController;
    }

    if (exportMeta.mode === "agenticAgent") {
      exportMeta.chatController = createAgenticVirtualAgentChat({
        region: credentials.region,
        token: credentials.token,
        guideId: exportMeta.selectedAgent?.guideId,
        virtualAgentId: exportMeta.selectedAgentId,
        addAgenticGuideSessionTurn,
        onStatus: (message) => setChatStatus(resultId, exportMeta, message),
        onConversationMessage: (entry) => {
          exportMeta.conversationMessages = [...(exportMeta.conversationMessages || []), entry];
          rerender(resultId, exportMeta);
        },
      });
      return exportMeta.chatController;
    }

    exportMeta.chatController = createWebMessagingGuestChat({
      region: credentials.region,
      deploymentId: exportMeta.selectedDeploymentId,
      onStatus: (message) => setChatStatus(resultId, exportMeta, message),
      onConversationId: (conversationId) => {
        exportMeta.conversationId = conversationId;
        const el = document.getElementById(`${resultId}-conversation-id`);
        if (el) {
          el.textContent = conversationId;
        }
      },
      onConversationMessage: (entry) => {
        exportMeta.conversationMessages = [...(exportMeta.conversationMessages || []), entry];
        rerender(resultId, exportMeta);
      },
      onQuickReplies: (quickReplies) => {
        exportMeta.quickReplies = quickReplies;
        rerender(resultId, exportMeta);
      },
    });
    return exportMeta.chatController;
  };

  const loadDeploymentDetail = async (exportMeta, credentials) => {
    if (!exportMeta.selectedDeploymentId) {
      exportMeta.deploymentDetail = null;
      return;
    }
    exportMeta.deploymentDetail = await getWebDeployment({
      ...credentials,
      deploymentId: exportMeta.selectedDeploymentId,
    });
  };

  const handleClick = async (event) => {
    const target = event.target;

    const sendButton = target.closest(".chat-agent-send");
    if (sendButton) {
      const resultId = sendButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      const credentials = requireCredentials("Chat Agent Tester");
      if (!exportMeta || !credentials) {
        return true;
      }
      const input = document.getElementById(`${resultId}-chat-input`);
      const text = input?.value || "";
      try {
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.sendText(text);
        if (input) {
          input.value = "";
        }
        exportMeta.quickReplies = [];
        rerender(resultId, exportMeta);
      } catch (error) {
        setChatStatus(resultId, exportMeta, error.message || "Send failed.");
      }
      return true;
    }

    const quickReply = target.closest(".chat-agent-quick-reply");
    if (quickReply) {
      const resultId = quickReply.closest(".export-results")?.id;
      const exportMeta = getExportMeta(resultId);
      const credentials = requireCredentials("Chat Agent Tester");
      if (!exportMeta || !credentials) {
        return true;
      }
      try {
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.sendQuickReply?.(quickReply.dataset.quickReply);
        exportMeta.quickReplies = [];
        rerender(resultId, exportMeta);
      } catch (error) {
        setChatStatus(resultId, exportMeta, error.message || "Quick reply failed.");
      }
      return true;
    }

    const startButton = target.closest(".chat-agent-start-session");
    if (startButton) {
      const resultId = startButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      const credentials = requireCredentials("Chat Agent Tester");
      if (!exportMeta || !credentials) {
        return true;
      }
      exportMeta.chatController?.end?.();
      exportMeta.chatController = null;
      exportMeta.conversationMessages = [];
      exportMeta.quickReplies = [];
      exportMeta.conversationId = "";
      try {
        if (exportMeta.mode === "webDeployment" && !exportMeta.selectedDeploymentId) {
          throw new Error("Select a Web Messenger deployment.");
        }
        if (exportMeta.mode === "agenticAgent" && !exportMeta.selectedAgentId) {
          throw new Error("Select an agentic virtual agent.");
        }
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.start();
        if (exportMeta.mode === "agenticAgent") {
          exportMeta.conversationId = controller.getGuideSessionId?.() || "";
        } else {
          exportMeta.conversationId = controller.getConversationId?.() || "";
        }
        rerender(resultId, exportMeta);
      } catch (error) {
        setChatStatus(resultId, exportMeta, error.message || "Unable to start session.");
        rerender(resultId, exportMeta);
      }
      return true;
    }

    const endButton = target.closest(".chat-agent-end-session");
    if (endButton) {
      const resultId = endButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      if (exportMeta?.chatController) {
        exportMeta.chatController.end();
        exportMeta.chatController = null;
      }
      return true;
    }

    const saveButton = target.closest(".chat-agent-save-registration");
    if (saveButton) {
      const resultId = saveButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      if (!exportMeta || !state.orgId) {
        return true;
      }
      const id =
        exportMeta.mode === "agenticAgent" ? exportMeta.selectedAgentId : exportMeta.selectedDeploymentId;
      if (!id) {
        setChatStatus(resultId, exportMeta, "Select a deployment or agent before saving.");
        return true;
      }
      upsertRegistration(state.orgId, {
        id,
        mode: exportMeta.mode,
        label:
          exportMeta.mode === "agenticAgent"
            ? exportMeta.selectedAgent?.name || id
            : exportMeta.deploymentDetail?.name || id,
        savedAt: new Date().toISOString(),
      });
      setChatStatus(resultId, exportMeta, "Registration saved for this org.");
      return true;
    }

    return false;
  };

  const handleChange = (event) => {
    const modeChange = event.target.closest(".chat-agent-mode-select");
    if (modeChange?.dataset.resultId) {
      const exportMeta = getExportMeta(modeChange.dataset.resultId);
      if (exportMeta) {
        exportMeta.mode = modeChange.value;
        exportMeta.chatController?.end?.();
        exportMeta.chatController = null;
        rerender(modeChange.dataset.resultId, exportMeta);
      }
      return true;
    }

    const deploymentChange = resolveDropdownChange(event.target, "chat-agent-deployment-select");
    if (deploymentChange?.resultId) {
      const exportMeta = getExportMeta(deploymentChange.resultId);
      if (exportMeta) {
        exportMeta.selectedDeploymentId = deploymentChange.value;
        const credentials = requireCredentials("Chat Agent Tester");
        if (credentials && deploymentChange.value) {
          loadDeploymentDetail(exportMeta, credentials).then(() => {
            rerender(deploymentChange.resultId, exportMeta);
          });
        } else {
          exportMeta.deploymentDetail = null;
          rerender(deploymentChange.resultId, exportMeta);
        }
      }
      return true;
    }

    const agentChange = resolveDropdownChange(event.target, "chat-agent-agent-select");
    if (agentChange?.resultId) {
      const exportMeta = getExportMeta(agentChange.resultId);
      if (exportMeta) {
        exportMeta.selectedAgentId = agentChange.value;
        exportMeta.selectedAgent =
          exportMeta.agentOptions.find((option) => option.value === agentChange.value)?.agent || null;
      }
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

      const credentials = requireCredentials("Chat Agent Tester");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Chat Agent Tester",
        "Loading chat targets...",
        renderLoadingState("Fetching Web Messenger deployments and agentic virtual agents...")
      );

      try {
        const [deployments, agents] = await Promise.all([
          getWebDeployments(credentials),
          getAgenticVirtualAgents(credentials),
        ]);

        const registration = loadRegistrationState(state.orgId);
        const deploymentOptions = mapDeploymentOptions(deployments);
        const agentOptions = mapAgentOptions(agents);
        const defaultMode = registration.lastMode || "webDeployment";
        const selectedDeploymentId =
          registration.lastActiveId && defaultMode === "webDeployment"
            ? registration.lastActiveId
            : deploymentOptions[0]?.value || "";
        const selectedAgentId =
          registration.lastActiveId && defaultMode === "agenticAgent"
            ? registration.lastActiveId
            : agentOptions[0]?.value || "";

        const exportMeta = {
          resultId: loadingResultId,
          title: "Chat Agent Tester",
          status: "Select a deployment or agent and start a session.",
          exportType: "chat_agent_tester",
          kind: "chat-agent-tester",
          hideActions: true,
          editable: false,
          mode: defaultMode,
          deploymentOptions,
          agentOptions,
          selectedDeploymentId,
          selectedAgentId,
          selectedAgent: agentOptions.find((option) => option.value === selectedAgentId)?.agent || null,
          deploymentDetail: null,
          conversationMessages: [],
          quickReplies: [],
          conversationId: "",
          chatStatus: "",
          chatController: null,
          traceMount: null,
          renderBody: () => renderSetup(loadingResultId, state.exportData[loadingResultId] || exportMeta),
        };

        state.exportData[loadingResultId] = exportMeta;
        if (selectedDeploymentId) {
          await loadDeploymentDetail(exportMeta, credentials);
        }
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
        rerender(loadingResultId, exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Chat Agent Tester",
          error.message || "Failed to load chat targets",
          renderJsonBlock(error.payload || { error: error.message })
        );
      }
    });
  };

  return {
    handleClick,
    handleChange,
    wireButton,
    loadDeploymentDetail,
    rerender,
  };
};

export { createChatAgentTesterFeature, isOriginAllowedForDeployment, mapDeploymentOptions };
