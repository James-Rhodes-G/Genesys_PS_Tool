const encoder = new TextEncoder();

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashBody = async (body) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(body ?? {})));
  return toHex(digest);
};

export const buildSignedHeaders = async ({ secret, method, path, body }) => {
  if (!secret) {
    return {};
  }

  const timestamp = String(Date.now());
  const bodyHash = await hashBody(body);
  const payload = `${timestamp}:${method}:${path}:${bodyHash}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return {
    "X-PS-Tool-Timestamp": timestamp,
    "X-PS-Tool-Signature": toHex(signatureBuffer),
  };
};

export const signedFetch = async ({ baseUrl, path, method = "GET", body, secret }) => {
  const headers = {
    "Content-Type": "application/json",
    ...(await buildSignedHeaders({ secret, method, path, body })),
  };

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};
