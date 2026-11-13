const TEARDOWN_DELAY_MS = 350;
const MESSENGER_READY_FALLBACK_MS = 2500;

const GENESYS_DOM_SELECTORS = [
  "#genesys-messenger",
  "#genesys-thirdparty",
  "#genesys-messenger-container",
  'iframe[name="genesysMessengerLauncherFrame"]',
  'iframe[id^="genesys"]',
  '[id*="genesys-messenger"]',
];

let bootstrapGeneration = 0;
let lifecyclePromise = Promise.resolve();

const runLifecycle = (task) => {
  const next = lifecyclePromise.then(task);
  lifecyclePromise = next.catch(() => {});
  return next;
};

const isGenesysHostedUrl = (value) =>
  /genesys-bootstrap|genesys\.min\.js|webmessaging|messenger\.(js|css)/i.test(String(value || "")) ||
  (/pure\.cloud|mypurecloud/i.test(String(value || "")) && /apps\.|webmessaging\./i.test(String(value || "")));

const runGenesysCommand = (command, ...args) => {
  if (typeof window.Genesys !== "function") {
    return;
  }
  try {
    window.Genesys("command", command, ...args);
  } catch {
    // Widget may already be torn down.
  }
};

const removeGenesysInjectedDom = () => {
  GENESYS_DOM_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src") || iframe.src || "";
    const name = iframe.getAttribute("name") || "";
    if (/genesys|pure\.cloud|mypurecloud/i.test(src) || /genesys/i.test(name)) {
      iframe.remove();
    }
  });
};

const removeGenesysScripts = () => {
  document.querySelectorAll("script[data-genesys-bootstrap]").forEach((script) => script.remove());
  document.querySelectorAll("script[src]").forEach((script) => {
    const src = script.getAttribute("src") || "";
    if (isGenesysHostedUrl(src)) {
      script.remove();
    }
  });
};

const resetGenesysGlobals = () => {
  try {
    delete window.Genesys;
    delete window._genesysJs;
  } catch {
    window.Genesys = undefined;
    window._genesysJs = undefined;
  }
};

const initGenesysStub = ({ environment, deploymentId }) => {
  window._genesysJs = "Genesys";
  window.Genesys = function genesysQueue() {
    (window.Genesys.q = window.Genesys.q || []).push(arguments);
  };
  window.Genesys.q = [];
  window.Genesys.t = Date.now();
  window.Genesys.c = { environment, deploymentId };
};

const buildBootstrapScriptUrl = (scriptUrl, generation) => {
  try {
    const url = new URL(scriptUrl, window.location.origin);
    url.searchParams.set("_ps_reload", String(generation));
    return url.toString();
  } catch {
    const joiner = scriptUrl.includes("?") ? "&" : "?";
    return `${scriptUrl}${joiner}_ps_reload=${generation}`;
  }
};

const loadGenesysBootstrap = ({ scriptUrl, environment, deploymentId }) =>
  new Promise((resolve, reject) => {
    if (!scriptUrl || !environment || !deploymentId) {
      reject(new Error("Missing Messenger embed configuration."));
      return;
    }

    bootstrapGeneration += 1;
    const generation = bootstrapGeneration;
    const resolvedScriptUrl = buildBootstrapScriptUrl(scriptUrl, generation);

    initGenesysStub({ environment, deploymentId });

    const script = document.createElement("script");
    script.async = true;
    script.charset = "utf-8";
    script.src = resolvedScriptUrl;
    script.dataset.genesysBootstrap = scriptUrl;
    script.dataset.genesysBootstrapGeneration = String(generation);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Genesys Messenger script."));
    document.head.appendChild(script);
  });

const openGenesysMessenger = () =>
  new Promise((resolve, reject) => {
    if (typeof window.Genesys !== "function") {
      reject(new Error("Genesys bootstrap is not available."));
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(fallbackTimer);
      try {
        window.Genesys("command", "Messenger.open");
      } catch {
        // Launcher may still appear without an explicit open.
      }
      resolve();
    };

    try {
      window.Genesys("subscribe", "Messenger.ready", finish);
    } catch {
      finish();
      return;
    }

    const fallbackTimer = window.setTimeout(finish, MESSENGER_READY_FALLBACK_MS);
  });

const closeGenesysMessenger = () => {
  runGenesysCommand("Messenger.close");
};

const isGenesysMessengerPresent = () =>
  typeof window.Genesys === "function" ||
  Boolean(document.querySelector("script[data-genesys-bootstrap]")) ||
  Boolean(document.querySelector("#genesys-messenger, iframe[name='genesysMessengerLauncherFrame']"));

const teardownGenesysMessenger = async () => {
  const hadMessenger = isGenesysMessengerPresent();

  if (hadMessenger) {
    runGenesysCommand("Messenger.close");
    runGenesysCommand("MessagingService.clearConversation");
    await new Promise((resolve) => {
      window.setTimeout(resolve, TEARDOWN_DELAY_MS);
    });
  }

  removeGenesysInjectedDom();
  removeGenesysScripts();
  resetGenesysGlobals();
  bootstrapGeneration += 1;
};

const unloadGenesysMessenger = () => runLifecycle(() => teardownGenesysMessenger());

const loadAndOpenGenesysMessenger = (embed) =>
  runLifecycle(async () => {
    await loadGenesysBootstrap(embed);
    await openGenesysMessenger();
  });

const mapMessengerSdkMessage = (message) => {
  const text = String(message?.text || "").trim();
  if (!text) {
    return null;
  }

  const direction = String(message?.direction || "").toLowerCase();
  const entity = String(message?.originatingEntity || "").toLowerCase();

  if (direction === "inbound") {
    return { role: "customer", text, raw: message, entity: message.originatingEntity || "Customer" };
  }

  if (direction === "outbound" || entity === "bot" || entity === "human") {
    return {
      role: "bot",
      text,
      raw: message,
      entity: message.originatingEntity || "Bot",
    };
  }

  return null;
};

const attachMessengerMessageCapture = (onConversationMessage) => {
  if (typeof window.Genesys !== "function") {
    return () => {};
  }

  window.Genesys("subscribe", "MessagingService.messagesReceived", ({ data }) => {
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    messages.forEach((message) => {
      const mapped = mapMessengerSdkMessage(message);
      if (!mapped) {
        return;
      }
      onConversationMessage?.({
        ...mapped,
        timestamp: new Date().toISOString(),
      });
    });
  });

  return () => {};
};

const sendMessengerText = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return;
  }

  runGenesysCommand("MessagingService.sendMessage", {
    message: {
      type: "Text",
      text: trimmed,
    },
  });
};

export {
  loadAndOpenGenesysMessenger,
  closeGenesysMessenger,
  unloadGenesysMessenger,
  loadGenesysBootstrap,
  attachMessengerMessageCapture,
  sendMessengerText,
  mapMessengerSdkMessage,
};
