import { buildPhoneSiteMoveBody } from "../../genesys.js";

const PHONE_SITE_MOVE_QUERY =
  "expand=site,phoneBaseSettings,lines&fields=properties.*,lines.properties.*,lines.edgeGroup,webRtcUser";

const buildItems = (payload = {}) => {
  const phoneIds = Array.isArray(payload.phoneIds) ? payload.phoneIds.filter(Boolean) : [];
  const siteId = String(payload.siteId || "").trim();
  const siteName = String(payload.siteName || "").trim();

  if (phoneIds.length === 0) {
    throw new Error("phoneIds must be a non-empty array.");
  }

  if (!siteId) {
    throw new Error("siteId is required.");
  }

  return phoneIds.map((phoneId) => ({
    itemId: String(phoneId),
    payload: {
      phoneId: String(phoneId),
      siteId,
      siteName,
    },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { phoneId, siteId, siteName } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: phoneId,
    workerId: ctx.workerId,
  };

  const phone = await apiClient.get(
    `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}?${PHONE_SITE_MOVE_QUERY}`,
    { itemContext }
  );

  const body = buildPhoneSiteMoveBody(phone, { siteId, siteName });
  const updatedPhone = await apiClient.put(
    `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}`,
    body,
    { itemContext }
  );

  return {
    phoneId,
    phoneName: updatedPhone?.name || phone?.name || phoneId,
    siteId: String(siteId || "").trim(),
  };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    phoneId: row.itemId,
    status: row.status,
    error: row.error || "",
    phoneName: row.result?.phoneName || "",
    siteId: row.result?.siteId || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
