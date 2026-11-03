let regionsPromise = null;

const loadGenesysRegions = async () => {
  if (!regionsPromise) {
    regionsPromise = fetch("/data/genesys_regions.json")
      .then((response) => response.json())
      .catch(() => []);
  }
  return regionsPromise;
};

const getMessagingDomainForRegion = async (region) => {
  const normalizedRegion = String(region || "").trim().toLowerCase();
  const regions = await loadGenesysRegions();
  const match = regions.find((entry) => String(entry.id || "").toLowerCase() === normalizedRegion);
  return match?.domain || null;
};

const buildWebMessagingTokenUrl = async (region, deploymentId) => {
  const domain = await getMessagingDomainForRegion(region);
  if (!domain || !deploymentId) {
    return null;
  }
  return `https://webmessaging.${domain}/v1/tokens/deployment/${encodeURIComponent(deploymentId)}`;
};

const buildWebMessagingWsUrl = async (region, deploymentId, token) => {
  const candidates = await buildWebMessagingWsCandidates(region, deploymentId, token);
  return candidates[0] || null;
};

const buildWebMessagingWsCandidates = async (region, deploymentId, token) => {
  const domain = await getMessagingDomainForRegion(region);
  if (!domain || !deploymentId) {
    return [];
  }

  const encodedDeployment = encodeURIComponent(deploymentId);
  const candidates = [];

  if (token) {
    candidates.push(
      `wss://webmessaging.${domain}/v1/ws/deployment/${encodedDeployment}?token=${encodeURIComponent(token)}`
    );
  }
  candidates.push(`wss://webmessaging.${domain}/v1?deploymentId=${encodedDeployment}`);
  return candidates;
};

export {
  loadGenesysRegions,
  getMessagingDomainForRegion,
  buildWebMessagingTokenUrl,
  buildWebMessagingWsUrl,
  buildWebMessagingWsCandidates,
};
