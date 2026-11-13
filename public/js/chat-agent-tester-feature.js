import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";
import { renderChatAgentTracePanel, mountChatAgentTraceView } from "./chat-agent-message-trace-view.js";
import { createWebMessagingGuestChat } from "./web-messaging-guest-chat.js";
import { createAgenticVirtualAgentChat } from "./agentic-virtual-agent-chat.js";
import { loadRegistrationState, upsertRegistration } from "./chat-agent-registration.js";
import {
  describeDeploymentDomainPolicy,
  isDeploymentSelectable,
  isOriginAllowedForDeployment,
} from "./web-deployment-origin.js";
import {
  attachMessengerMessageCapture,
  loadAndOpenGenesysMessenger,
  sendMessengerText,
  unloadGenesysMessenger,
} from "./genesys-messenger-loader.js";
import { runConversationAutomation } from "./chat-agent-automation-runner.js";
import {
  appendChatAgentMessage,
  resetChatAgentMessageExport,
} from "./chat-agent-message-store.js";
import { createParsedChatAgentEntry } from "./chat-agent-message-parser.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const mapDeploymentOptions = (deployments, origin) =>
  (deployments || []).map((deployment) => {
    const selectable = isDeploymentSelectable(deployment, origin);
    const suffix = !selectable
      ? deployment.allowAllDomains
        ? " — not active"
        : " — origin not allowed"
      : "";
    return {
      value: deployment.id,
      label: `${deployment.name || deployment.id} (${deployment.status || "unknown"})${suffix}`,
      deployment,
      selectable,
    };
  });

const pickDefaultDeploymentId = (options, preferredId) => {
  if (preferredId && options.some((option) => option.value === preferredId && option.selectable)) {
    return preferredId;
  }
  return options.find((option) => option.selectable)?.value || "";
};

const mapAgentOptions = (agents) =>
  (agents || []).map((agent) => ({
    value: agent.id,
    label: `${agent.name || agent.id}${agent.latestProductionReadyVersion ? ` v${agent.latestProductionReadyVersion}` : ""}`,
    agent,
  }));

const renderAutomationResults = (results, summary) => {
  if (!results?.length) {
    return `<p class="muted chat-agent-automation-empty">No automation run yet.</p>`;
  }

  const rows = results
    .map(
      (entry) =>
        `<tr class="chat-agent-automation-row chat-agent-automation-row--${entry.pass ? "pass" : "fail"}">
          <td>${escapeHtml(entry.utterance)}</td>
          <td>${escapeHtml(entry.expected || "—")}</td>
          <td>${escapeHtml(entry.actual || "—")}</td>
          <td>${entry.pass ? "Pass" : "Fail"}</td>
        </tr>`
    )
    .join("");

  return `<p class="chat-agent-automation-summary"><strong>${escapeHtml(summary || "")}</strong></p>
    <table class="chat-agent-automation-table">
      <thead><tr><th>Sent</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
  getWebMessengerEmbed,
  getWebMessagingDeploymentToken,
  getAgenticVirtualAgents,
  addAgenticGuideSessionTurn,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  getCurrentAppDomain,
}) => {
  const attachMessengerCapture = (resultId, exportMeta) => {
    exportMeta.messengerCaptureCleanup?.();
    exportMeta.messengerCaptureActive = false;

    exportMeta.messengerCaptureCleanup = attachMessengerMessageCapture((entry) => {
      appendChatAgentMessage(
        createParsedChatAgentEntry({
          direction: entry.role === "customer" ? "outbound" : "inbound",
          category: entry.role === "customer" ? "outbound" : "inbound",
          eventType: "messengerSdkMessage",
          summaryText: entry.text,
          data: entry.raw || entry,
        }),
        {
          deploymentId: exportMeta.selectedDeploymentId,
          mode: "webDeployment",
        }
      );

      exportMeta.conversationMessages = [...(exportMeta.conversationMessages || []), entry];
      rerender(resultId, exportMeta);
    });
    exportMeta.messengerCaptureActive = true;
  };

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
    const selectedOption = deploymentOptions.find((option) => option.value === selectedDeploymentId);
    const canUseSelectedDeployment = selectedOption?.selectable !== false;

    const showGuestApiChat =
      mode === "webDeployment" &&
      Boolean(
        featureState.chatController ||
          featureState.apiSessionActive ||
          (featureState.conversationMessages && featureState.conversationMessages.length)
      );

    const messengerTranscriptReady =
      mode === "webDeployment" &&
      featureState.messengerLoaded &&
      Boolean(featureState.conversationMessages?.length);

    const renderRightChatColumn = () => {
      if (mode === "agenticAgent" || showGuestApiChat) {
        return `<section class="chat-agent-tester__chat" aria-label="Chat">
          <div class="chat-agent-tester__chat-header">
            <h3 class="chat-agent-tester__chat-title">Chat</h3>
            <p class="muted chat-agent-tester__session-id">Session: <span id="${escapeHtml(
              resultId
            )}-conversation-id">${escapeHtml(featureState.conversationId || "—")}</span></p>
          </div>
          ${renderConversation(featureState.conversationMessages, featureState.quickReplies)}
          <div class="chat-agent-composer">
            <input class="chat-agent-input" id="${escapeHtml(resultId)}-chat-input" type="text" placeholder="Type a message..." />
            <gux-button class="chat-agent-send" type="button" accent="primary" data-result-id="${escapeHtml(
              resultId
            )}">Send</gux-button>
          </div>
          ${renderChatAgentTracePanel({ resultId })}
        </section>`;
      }

      if (mode === "webDeployment" && featureState.messengerLoaded) {
        return `<section class="chat-agent-tester__chat chat-agent-tester__chat--messenger" aria-label="Messenger">
          <div class="chat-agent-tester__chat-header">
            <h3 class="chat-agent-tester__chat-title">Web Messenger (SDK capture)</h3>
          </div>
          ${
            messengerTranscriptReady
              ? `${renderConversation(featureState.conversationMessages, featureState.quickReplies)}${renderChatAgentTracePanel({ resultId })}`
              : `<div class="chat-agent-messenger-placeholder">
            <p><strong>Messenger is open on this page.</strong></p>
            <p class="muted">Bot and agent replies are read via <code>MessagingService.messagesReceived</code> for automation. Use the launcher or run <strong>Response automation</strong> on the left.</p>
          </div>`
          }
        </section>`;
      }

      return `<section class="chat-agent-tester__chat chat-agent-tester__chat--empty" aria-label="Chat">
        <div class="chat-agent-tester__chat-header">
          <h3 class="chat-agent-tester__chat-title">Chat</h3>
        </div>
        <div class="chat-agent-messenger-placeholder">
          <p class="muted">${
            mode === "webDeployment"
              ? "Load Messenger on the left for the official widget, or expand Advanced and start an API session to chat in this panel."
              : "Start a session to chat here."
          }</p>
        </div>
      </section>`;
    };

    return `<div class="column-editor chat-agent-tester">
      <div class="column-editor__header">Chat Agent Tester</div>
      <div class="chat-agent-tester__layout">
      <aside class="chat-agent-tester__sidebar sidebar-actions">
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
                      }${option.selectable ? "" : " disabled"}>${escapeHtml(option.label)}</option>`
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
                <div><strong>Domains:</strong> ${escapeHtml(describeDeploymentDomainPolicy(deploymentDetail))}</div>
                <div><strong>PS Tool origin:</strong> ${escapeHtml(origin)}</div>
                ${
                  !originAllowed
                    ? `<p class="chat-agent-warning">This PS Tool origin (${escapeHtml(
                        origin
                      )}) is not allowed by the deployment domain policy. Add it in Genesys Admin or enable allow-all for testing.</p>`
                    : ""
                }
                ${
                  !canUseSelectedDeployment
                    ? `<p class="chat-agent-warning">Selected deployment cannot be used from this PS Tool origin. Choose an allowed deployment from the list.</p>`
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
          ${
            mode === "webDeployment"
              ? `<gux-button class="chat-agent-load-messenger" type="button" accent="primary" data-result-id="${escapeHtml(
                  resultId
                )}">Load Messenger</gux-button>
                <gux-button class="chat-agent-close-messenger" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}">Close Messenger</gux-button>`
              : `<gux-button class="chat-agent-start-session" type="button" accent="primary" data-result-id="${escapeHtml(
                  resultId
                )}">Start session</gux-button>
                <gux-button class="chat-agent-end-session" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}">End session</gux-button>`
          }
        </div>
        <p class="chat-agent-status muted" id="${escapeHtml(resultId)}-chat-status">${escapeHtml(
          featureState.chatStatus ||
            (mode === "webDeployment"
              ? "Select a deployment and load Messenger to preview the customer experience."
              : "Select a target and start a session.")
        )}</p>
        <details class="chat-agent-automation-panel">
          <summary>Response automation</summary>
          <p class="muted">Send each line automatically and evaluate the latest bot reply in the browser. Optional <code>| expected text</code> (contains, case-insensitive).</p>
          <p class="muted">Agentic: start session first. Web Messenger: load Messenger (SDK capture). Guest API: start API session.</p>
          <label class="field-label" for="${escapeHtml(resultId)}-automation-script">Script</label>
          <textarea
            class="chat-agent-automation-script"
            id="${escapeHtml(resultId)}-automation-script"
            rows="7"
            placeholder="Hello&#10;I need help | help&#10;/regex/i pattern as expected uses regex mode if it starts with /"
          >${escapeHtml(featureState.automationScript || "")}</textarea>
          <div class="bulk-control-row bulk-control-row--actions">
            <gux-button class="chat-agent-run-automation" type="button" accent="primary" data-result-id="${escapeHtml(
              resultId
            )}"${featureState.automationRunning ? " disabled" : ""}>Run automation</gux-button>
          </div>
          <div id="${escapeHtml(resultId)}-automation-results" class="chat-agent-automation-results">
            ${renderAutomationResults(featureState.automationResults, featureState.automationSummary)}
          </div>
        </details>
        ${
          mode === "webDeployment"
            ? `<details class="chat-agent-advanced-api">
              <summary>Advanced: guest API session</summary>
              <p class="muted">In-panel chat via the guest token API (may fail on localhost). Messages appear in the chat column on the right.</p>
              <div class="bulk-control-row bulk-control-row--actions">
                <gux-button class="chat-agent-start-session" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}">Start API session</gux-button>
                <gux-button class="chat-agent-end-session" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}">End API session</gux-button>
              </div>
            </details>`
            : ""
        }
      </aside>
      ${renderRightChatColumn()}
      </div>
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

  const ensureAutomationReady = async (resultId, exportMeta, credentials) => {
    if (exportMeta.mode === "agenticAgent") {
      if (!exportMeta.selectedAgentId) {
        throw new Error("Select an agentic virtual agent.");
      }
      if (!exportMeta.chatController) {
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.start();
      }
      return;
    }

    if (exportMeta.mode === "webDeployment") {
      if (exportMeta.apiSessionActive && exportMeta.chatController) {
        return;
      }
      if (exportMeta.messengerLoaded && exportMeta.messengerCaptureActive) {
        return;
      }
      throw new Error("Load Messenger or start an Advanced API session before running automation.");
    }
  };

  const createAutomationSender = (resultId, exportMeta, credentials) => {
    if (exportMeta.mode === "agenticAgent" || exportMeta.apiSessionActive) {
      return async (text) => {
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.sendText(text);
        rerender(resultId, exportMeta);
      };
    }

    if (exportMeta.messengerLoaded) {
      return async (text) => {
        sendMessengerText(text);
      };
    }

    throw new Error("No automation send path is available.");
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
      requestGuestToken: () =>
        getWebMessagingDeploymentToken({
          region: credentials.region,
          token: credentials.token,
          deploymentId: exportMeta.selectedDeploymentId,
          origin: getCurrentAppDomain?.() || window.location.origin,
        }),
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

    const runAutomationButton = target.closest(".chat-agent-run-automation");
    if (runAutomationButton) {
      const resultId = runAutomationButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      const credentials = requireCredentials("Chat Agent Tester");
      if (!exportMeta || !credentials || exportMeta.automationRunning) {
        return true;
      }

      const scriptEl = document.getElementById(`${resultId}-automation-script`);
      const scriptText = scriptEl?.value || "";
      exportMeta.automationScript = scriptText;
      exportMeta.automationRunning = true;
      exportMeta.automationResults = [];
      exportMeta.automationSummary = "Running…";
      rerender(resultId, exportMeta);

      void (async () => {
        try {
          await ensureAutomationReady(resultId, exportMeta, credentials);
          const sendUtterance = createAutomationSender(resultId, exportMeta, credentials);
          const outcome = await runConversationAutomation({
            scriptText,
            sendUtterance,
            getConversationMessages: () => exportMeta.conversationMessages || [],
            onStepComplete: () => {
              rerender(resultId, exportMeta);
            },
          });
          exportMeta.automationResults = outcome.results;
          exportMeta.automationSummary = outcome.summary;
          setChatStatus(
            resultId,
            exportMeta,
            outcome.allPassed ? `Automation passed (${outcome.summary})` : `Automation finished (${outcome.summary})`
          );
        } catch (error) {
          exportMeta.automationSummary = error.message || "Automation failed.";
          setChatStatus(resultId, exportMeta, exportMeta.automationSummary);
        } finally {
          exportMeta.automationRunning = false;
          rerender(resultId, exportMeta);
        }
      })();

      return true;
    }

    const loadMessengerButton = target.closest(".chat-agent-load-messenger");
    if (loadMessengerButton) {
      const resultId = loadMessengerButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      const credentials = requireCredentials("Chat Agent Tester");
      if (!exportMeta || !credentials) {
        return true;
      }
      try {
        if (!exportMeta.selectedDeploymentId) {
          throw new Error("Select a Web Messenger deployment.");
        }
        const origin = getCurrentAppDomain?.() || window.location.origin;
        const selected = exportMeta.deploymentOptions?.find(
          (option) => option.value === exportMeta.selectedDeploymentId
        );
        if (!isDeploymentSelectable(selected?.deployment || exportMeta.deploymentDetail, origin)) {
          throw new Error(
            "Selected deployment is not available for this PS Tool origin (restricted domains or inactive)."
          );
        }
        const embed = await getWebMessengerEmbed({
          ...credentials,
          deploymentId: exportMeta.selectedDeploymentId,
        });
        if (!embed?.deploymentId || !embed?.environment || !embed?.scriptUrl) {
          throw new Error("Messenger embed configuration was incomplete.");
        }
        if (
          exportMeta.messengerLoaded ||
          document.querySelector("script[data-genesys-bootstrap]")
        ) {
          await unloadGenesysMessenger();
        }
        exportMeta.messengerLoaded = false;
        await loadAndOpenGenesysMessenger(embed);
        exportMeta.messengerLoaded = true;
        exportMeta.conversationMessages = [];
        resetChatAgentMessageExport({
          deploymentId: exportMeta.selectedDeploymentId,
          mode: "webDeployment",
        });
        attachMessengerCapture(resultId, exportMeta);
        setChatStatus(
          resultId,
          exportMeta,
          "Messenger loaded — SDK capture active for automation and transcript."
        );
        rerender(resultId, exportMeta);
      } catch (error) {
        setChatStatus(resultId, exportMeta, error.message || "Unable to load Messenger preview.");
        rerender(resultId, exportMeta);
      }
      return true;
    }

    const closeMessengerButton = target.closest(".chat-agent-close-messenger");
    if (closeMessengerButton) {
      const resultId = closeMessengerButton.dataset.resultId;
      const exportMeta = getExportMeta(resultId);
      if (exportMeta) {
        void unloadGenesysMessenger().then(() => {
          exportMeta.messengerCaptureCleanup?.();
          exportMeta.messengerCaptureActive = false;
          exportMeta.messengerLoaded = false;
          exportMeta.conversationMessages = [];
          setChatStatus(resultId, exportMeta, "Messenger closed and unloaded.");
          rerender(resultId, exportMeta);
        });
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
        if (exportMeta.mode === "webDeployment") {
          const origin = getCurrentAppDomain?.() || window.location.origin;
          const selected = exportMeta.deploymentOptions?.find(
            (option) => option.value === exportMeta.selectedDeploymentId
          );
          if (!isDeploymentSelectable(selected?.deployment || exportMeta.deploymentDetail, origin)) {
            throw new Error(
              "Selected deployment is not available for this PS Tool origin (restricted domains or inactive)."
            );
          }
        }
        if (exportMeta.mode === "agenticAgent" && !exportMeta.selectedAgentId) {
          throw new Error("Select an agentic virtual agent.");
        }
        const controller = ensureChatController(resultId, exportMeta, credentials);
        await controller.start();
        if (exportMeta.mode === "agenticAgent") {
          exportMeta.conversationId = controller.getGuideSessionId?.() || "";
        } else {
          exportMeta.apiSessionActive = true;
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
        exportMeta.apiSessionActive = false;
        exportMeta.conversationMessages = [];
        exportMeta.quickReplies = [];
        exportMeta.conversationId = "";
        rerender(resultId, exportMeta);
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
      if (exportMeta.mode === "webDeployment") {
        const origin = getCurrentAppDomain?.() || window.location.origin;
        const selected = exportMeta.deploymentOptions?.find((option) => option.value === id);
        if (!isDeploymentSelectable(selected?.deployment || exportMeta.deploymentDetail, origin)) {
          setChatStatus(resultId, exportMeta, "Cannot save a deployment that is restricted for this origin.");
          return true;
        }
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
        exportMeta.apiSessionActive = false;
        if (exportMeta.messengerLoaded) {
          void unloadGenesysMessenger();
          exportMeta.messengerLoaded = false;
        }
        rerender(modeChange.dataset.resultId, exportMeta);
      }
      return true;
    }

    const deploymentChange = resolveDropdownChange(event.target, "chat-agent-deployment-select");
    if (deploymentChange?.resultId) {
      const exportMeta = getExportMeta(deploymentChange.resultId);
      if (exportMeta) {
        exportMeta.selectedDeploymentId = deploymentChange.value;
        if (exportMeta.messengerLoaded) {
          void unloadGenesysMessenger();
          exportMeta.messengerLoaded = false;
        }
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
        const [deploymentSummaries, agents] = await Promise.all([
          getWebDeployments(credentials),
          getAgenticVirtualAgents(credentials),
        ]);

        const origin = getCurrentAppDomain?.() || window.location.origin;
        const deployments = await Promise.all(
          (deploymentSummaries || []).map(async (summary) => {
            try {
              return await getWebDeployment({
                ...credentials,
                deploymentId: summary.id,
              });
            } catch {
              return summary;
            }
          })
        );

        const registration = loadRegistrationState(state.orgId);
        const deploymentOptions = mapDeploymentOptions(deployments, origin);
        const agentOptions = mapAgentOptions(agents);
        const defaultMode = registration.lastMode || "webDeployment";
        const preferredDeploymentId =
          registration.lastActiveId && defaultMode === "webDeployment" ? registration.lastActiveId : "";
        const selectedDeploymentId = pickDefaultDeploymentId(deploymentOptions, preferredDeploymentId);
        const selectedAgentId =
          registration.lastActiveId && defaultMode === "agenticAgent"
            ? registration.lastActiveId
            : agentOptions[0]?.value || "";

        const exportMeta = {
          resultId: loadingResultId,
          title: "Chat Agent Tester",
          status: deploymentOptions.some((option) => option.selectable)
            ? "Select a deployment or agent and start a session."
            : `No Messenger deployments are usable from ${origin}. Adjust domain access in Genesys or use allow-all for testing.`,
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
          messengerLoaded: false,
          messengerCaptureActive: false,
          apiSessionActive: false,
          automationScript: "",
          automationResults: [],
          automationSummary: "",
          automationRunning: false,
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

export { createChatAgentTesterFeature, mapDeploymentOptions };
