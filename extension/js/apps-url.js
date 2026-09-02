const isAppsSubdomainUrl = (url) => {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).hostname.startsWith("apps.");
  } catch {
    return false;
  }
};

export { isAppsSubdomainUrl };
