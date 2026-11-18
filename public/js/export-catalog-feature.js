const CATALOG_EXPORT_BUTTONS = [
  {
    buttonId: "genesys-export-divisions",
    title: "Export: Divisions",
    countLabel: "divisions",
    exportType: "divisions",
    preferredColumns: ["name", "id", "home", "description"],
    loaderKey: "getDivisions",
  },
  {
    buttonId: "genesys-export-wrapup-codes",
    title: "Export: Wrap-Up Codes",
    countLabel: "wrap-up codes",
    exportType: "wrapup_codes",
    preferredColumns: ["name", "id", "division.name", "description"],
    loaderKey: "getWrapupCodes",
  },
  {
    buttonId: "genesys-export-sites",
    title: "Export: Sites",
    countLabel: "sites",
    exportType: "sites",
    preferredColumns: ["name", "id", "location.name", "managed"],
    loaderKey: "getSites",
  },
  {
    buttonId: "genesys-export-locations",
    title: "Export: Locations",
    countLabel: "locations",
    exportType: "locations",
    preferredColumns: ["name", "id", "state"],
    loaderKey: "getLocations",
  },
  {
    buttonId: "genesys-export-teams",
    title: "Export: Teams",
    countLabel: "teams",
    exportType: "teams",
    preferredColumns: ["name", "id", "memberCount", "description"],
    loaderKey: "getTeams",
  },
  {
    buttonId: "genesys-export-campaigns",
    title: "Export: Campaigns",
    countLabel: "campaigns",
    exportType: "campaigns",
    preferredColumns: ["name", "id", "division.name", "campaignStatus", "dialingMode"],
    loaderKey: "getCampaigns",
  },
];

const wireCatalogExportButtons = ({
  wireExportButton,
  createSimpleExportMeta,
  loaders,
}) => {
  for (const config of CATALOG_EXPORT_BUTTONS) {
    const button = document.getElementById(config.buttonId);
    const loader = loaders[config.loaderKey];
    if (!button || typeof loader !== "function") {
      continue;
    }

    wireExportButton(button, {
      title: config.title,
      loadingStatus: `Loading ${config.countLabel}...`,
      loadingMessage: `Fetching catalog export (${config.exportType})...`,
      countLabel: config.countLabel,
      failureMessage: `${config.title} failed`,
      loader,
      createExportMeta: (resultId, rows, title, status) =>
        createSimpleExportMeta(resultId, rows, title, status, config.exportType, config.preferredColumns),
    });
  }
};

export { CATALOG_EXPORT_BUTTONS, wireCatalogExportButtons };
