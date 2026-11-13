import https from "https";
import { URL } from "url";
import { buildWebMessagingBaseUrl } from "./web-messaging-domain.js";

const extractGuestToken = (payload) =>
  payload?.jwt || payload?.token || payload?.accessToken || payload?.access_token || "";

const httpPostJson = ({ url, headers, body }) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ?? "{}";
    const requestHeaders = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      Accept: "application/json",
      "User-Agent": "genesys-ps-tool",
      ...headers,
    };

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: requestHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsedBody = {};
          try {
            parsedBody = raw ? JSON.parse(raw) : {};
          } catch {
            parsedBody = { raw };
          }
          resolve({ status: res.statusCode || 0, body: parsedBody, headers: res.headers });
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });

const requestGuestToken = async ({ baseUrl, deploymentId, origin, path, body }) => {
  const url = `${baseUrl}${path}`;
  const response = await httpPostJson({
    url,
    body: JSON.stringify(body ?? {}),
    headers: {
      Origin: origin,
      Referer: `${origin.replace(/\/$/, "")}/`,
    },
  });

  return { url, ...response };
};

const fetchGuestDeploymentToken = async ({ region, deploymentId, origin }) => {
  const baseUrl = buildWebMessagingBaseUrl(region);
  if (!baseUrl) {
    throw new Error(`Unsupported Genesys region for Web Messaging: ${region}`);
  }

  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) {
    throw new Error("Origin is required to request a Web Messaging guest token.");
  }

  const attempts = [
    {
      path: `/v1/tokens/deployment/${encodeURIComponent(deploymentId)}`,
      body: {},
    },
    {
      path: "/v1/tokens",
      body: { deploymentId },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const result = await requestGuestToken({
      baseUrl,
      deploymentId,
      origin: normalizedOrigin,
      path: attempt.path,
      body: attempt.body,
    });

    if (result.status >= 200 && result.status < 300) {
      const token = extractGuestToken(result.body);
      if (!token) {
        lastError = new Error("Web Messaging token response did not include a JWT.");
        continue;
      }
      return {
        token,
        payload: result.body,
        origin: normalizedOrigin,
        tokenUrl: result.url,
      };
    }

    lastError = new Error(
      result.body?.message ||
        result.body?.error ||
        `Web Messaging token request failed (${result.status}) for ${result.url}.`
    );
    lastError.status = result.status;
    lastError.details = result.body;

    if (result.status !== 403 && result.status !== 404) {
      break;
    }
  }

  const message =
    lastError?.message ||
    `Web Messaging token request failed. Ensure deployment ${deploymentId} is Active in region ${region} and allows origin ${normalizedOrigin}.`;
  const error = new Error(message);
  error.status = lastError?.status || 502;
  error.details = lastError?.details || null;
  throw error;
};

export { fetchGuestDeploymentToken, extractGuestToken };
