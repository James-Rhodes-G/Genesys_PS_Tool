import { Router } from "express";
import { getAppInfo, getDbSizes, getPlatformSnapshot } from "../lib/platform-metrics.js";
import { getMaintenanceMode } from "../lib/maintenance-mode.js";

const createHealthRouter = ({ sessionDb, adminDb, getMaintenanceModeFromDb }) => {
  const router = Router();

  router.get("/health", async (_req, res) => {
    try {
      await sessionDb.get("SELECT 1");
      const appInfo = getAppInfo();
      const maintenance = getMaintenanceModeFromDb
        ? await getMaintenanceModeFromDb(adminDb)
        : { mode: await getMaintenanceMode() };
      res.json({
        status: "ok",
        ...appInfo,
        maintenanceMode: maintenance.mode,
        databases: { session: true, admin: Boolean(adminDb) },
      });
    } catch (error) {
      res.status(503).json({ status: "error", error: error.message });
    }
  });

  router.get("/ready", async (_req, res) => {
    const checks = [];
    let ready = true;

    try {
      await sessionDb.get("SELECT 1");
      checks.push({ name: "session_db", ok: true });
    } catch (error) {
      ready = false;
      checks.push({ name: "session_db", ok: false, error: error.message });
    }

    const vaultKey = process.env.VAULT_ENCRYPTION_KEY;
    if (!vaultKey || vaultKey.length < 32) {
      ready = false;
      checks.push({ name: "vault_key", ok: false, error: "VAULT_ENCRYPTION_KEY not configured" });
    } else {
      checks.push({ name: "vault_key", ok: true });
    }

    if (process.env.NODE_ENV === "production" && !process.env.LAUNCH_HMAC_SECRET) {
      ready = false;
      checks.push({ name: "launch_hmac", ok: false, error: "LAUNCH_HMAC_SECRET required in production" });
    } else {
      checks.push({ name: "launch_hmac", ok: true });
    }

    const maintenance = getMaintenanceModeFromDb
      ? await getMaintenanceModeFromDb(adminDb)
      : { mode: await getMaintenanceMode() };
    if (maintenance.mode !== "off") {
      ready = false;
      checks.push({ name: "maintenance", ok: false, mode: maintenance.mode });
    } else {
      checks.push({ name: "maintenance", ok: true });
    }

    res.status(ready ? 200 : 503).json({ ready, checks, ...getAppInfo() });
  });

  return router;
};

export { createHealthRouter };
