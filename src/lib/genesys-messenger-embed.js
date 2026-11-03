import { getMessagingDomainForRegion } from "./web-messaging-domain.js";

const MESSENGER_ENVIRONMENT_BY_DOMAIN = {
  "mypurecloud.com": "use1",
  "usw2.pure.cloud": "usw2",
  "cac1.pure.cloud": "cac1",
  "sae1.pure.cloud": "sae1",
  "mxc1.pure.cloud": "mxc1",
  "mypurecloud.de": "prod-euc1",
  "mypurecloud.ie": "prod-euw1",
  "euw2.pure.cloud": "euw2",
  "euc2.pure.cloud": "euc2",
  "mec1.pure.cloud": "mec1",
  "aps1.pure.cloud": "aps1",
  "mypurecloud.jp": "apne1",
  "apne2.pure.cloud": "apne2",
  "apne3.pure.cloud": "apne3",
  "apse1.pure.cloud": "apse1",
  "mypurecloud.com.au": "apse2",
  "use2.us-gov-pure.cloud": "use2",
};

const getAppsHostForRegion = (region) => {
  const domain = getMessagingDomainForRegion(region);
  if (!domain) {
    return null;
  }
  return `https://apps.${domain}`;
};

const getMessengerEnvironmentForRegion = (region) => {
  const domain = getMessagingDomainForRegion(region);
  if (!domain) {
    return null;
  }
  return MESSENGER_ENVIRONMENT_BY_DOMAIN[domain] || domain.split(".")[0];
};

const resolveMessengerDeploymentKey = (entity) =>
  String(
    entity?.messengerDeploymentKey ||
      entity?.deploymentKey ||
      entity?.key ||
      entity?.id ||
      ""
  ).trim();

const buildMessengerEmbedConfig = ({ region, deploymentEntity }) => {
  const appsHost = getAppsHostForRegion(region);
  const environment = getMessengerEnvironmentForRegion(region);
  const deploymentId = resolveMessengerDeploymentKey(deploymentEntity);

  if (!appsHost || !environment || !deploymentId) {
    throw new Error("Unable to build Messenger embed configuration for this deployment.");
  }

  return {
    deploymentId,
    environment,
    scriptUrl: `${appsHost}/genesys-bootstrap/genesys.min.js`,
    appsHost,
    snippet: typeof deploymentEntity?.snippet === "string" ? deploymentEntity.snippet : "",
  };
};

export {
  buildMessengerEmbedConfig,
  getAppsHostForRegion,
  getMessengerEnvironmentForRegion,
  resolveMessengerDeploymentKey,
};
