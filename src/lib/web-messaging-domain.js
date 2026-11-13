import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const regionsPath = path.resolve(__dirname, "../../public/data/genesys_regions.json");

let regionsCache = null;

const loadRegions = () => {
  if (regionsCache) {
    return regionsCache;
  }
  regionsCache = JSON.parse(readFileSync(regionsPath, "utf8"));
  return regionsCache;
};

const getMessagingDomainForRegion = (region) => {
  const normalizedRegion = String(region || "").trim().toLowerCase();
  const match = loadRegions().find((entry) => String(entry.id || "").toLowerCase() === normalizedRegion);
  return match?.domain || null;
};

const buildWebMessagingBaseUrl = (region) => {
  const domain = getMessagingDomainForRegion(region);
  if (!domain) {
    return null;
  }
  return `https://webmessaging.${domain}`;
};

const buildWebMessagingWsUrl = (region, deploymentId, token) => {
  const domain = getMessagingDomainForRegion(region);
  if (!domain || !deploymentId || !token) {
    return null;
  }
  const encodedToken = encodeURIComponent(token);
  return `wss://webmessaging.${domain}/v1/ws/deployment/${encodeURIComponent(deploymentId)}?token=${encodedToken}`;
};

export {
  getMessagingDomainForRegion,
  buildWebMessagingBaseUrl,
  buildWebMessagingWsUrl,
  loadRegions,
};
