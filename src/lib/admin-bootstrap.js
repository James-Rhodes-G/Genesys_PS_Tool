import { hashPassword } from "./admin-operator-auth.js";
import { countOperators, getOperatorByUsername, upsertOperator } from "../data/admin-db.js";

const ensureBootstrapOperator = async (adminDb) => {
  const username = String(process.env.PS_TOOL_ADMIN_USERNAME || "").trim();
  const password = String(process.env.PS_TOOL_ADMIN_PASSWORD || "");
  if (!username || !password) {
    return { bootstrapped: false, reason: "missing_env" };
  }

  const total = await countOperators(adminDb);
  const existing = await getOperatorByUsername(adminDb, username);

  if (total > 0 && existing) {
    return { bootstrapped: false, reason: "already_configured" };
  }

  const passwordHash = await hashPassword(password);
  await upsertOperator(adminDb, { username, passwordHash });
  return { bootstrapped: true, username };
};

export { ensureBootstrapOperator };
