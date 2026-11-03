const normalizeDomainEntry = (domain) =>
  String(domain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

const resolveAllowAllDomains = (entity) => {
  if (!entity || typeof entity !== "object") {
    return false;
  }

  const configuration = entity.configuration || entity.config || {};
  const flags = [
    entity.allDomainsAllowed,
    entity.allowAllDomains,
    entity.allow_all_domains,
    configuration.allDomainsAllowed,
    configuration.allowAllDomains,
  ];

  if (flags.some((value) => value === true)) {
    return true;
  }

  const restriction = String(
    entity.domainRestriction || entity.domainRestrictions || configuration.domainRestriction || ""
  ).toLowerCase();

  if (restriction.includes("allowall") || restriction === "none") {
    return true;
  }

  if (entity.restrictDomains === false || entity.restrictDomainAccess === false) {
    return true;
  }

  return false;
};

const readAllowedDomains = (entity) => {
  if (!entity || typeof entity !== "object") {
    return [];
  }
  const configuration = entity.configuration || entity.config || {};
  const list =
    entity.allowedDomains ||
    entity.allowed_domains ||
    entity.domains ||
    configuration.allowedDomains ||
    configuration.domains ||
    [];

  return Array.isArray(list) ? list : [];
};

const isOriginAllowedForDeployment = (deployment, origin) => {
  if (!deployment) {
    return false;
  }

  if (resolveAllowAllDomains(deployment)) {
    return true;
  }

  const allowed = readAllowedDomains(deployment);
  if (!allowed.length) {
    return false;
  }

  try {
    const { hostname, port, protocol } = new URL(origin);
    const originHost = port && port !== "80" && port !== "443" ? `${hostname}:${port}` : hostname;

    return allowed.some((domain) => {
      const normalized = normalizeDomainEntry(domain);
      if (!normalized) {
        return false;
      }
      if (normalized.includes(":")) {
        return originHost.toLowerCase() === normalized;
      }
      return (
        hostname.toLowerCase() === normalized || hostname.toLowerCase().endsWith(`.${normalized}`)
      );
    });
  } catch {
    return false;
  }
};

const isDeploymentSelectable = (deployment, origin) => {
  if (!deployment?.id) {
    return false;
  }
  const status = String(deployment.status || "").toLowerCase();
  if (status && status !== "active") {
    return false;
  }
  return isOriginAllowedForDeployment(deployment, origin);
};

export {
  isDeploymentSelectable,
  isOriginAllowedForDeployment,
  normalizeDomainEntry,
  readAllowedDomains,
  resolveAllowAllDomains,
};
