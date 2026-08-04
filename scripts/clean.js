import { unlink } from "fs/promises";
import { initDb, clearLogs, dbPath } from "../src/data/db.js";
import { initSessionDb, clearSessionData, sessionDbPath } from "../src/data/session-db.js";

const removeDbFile = async (filePath) => {
  try {
    await unlink(filePath);
    console.log(`Removed ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

try {
  const db = await initDb();
  await clearLogs(db);
  await db.close();
  console.log(`Cleared logs -> ${dbPath}`);

  const sessionDb = await initSessionDb();
  const sessions = await sessionDb.all(`SELECT session_id AS sessionId FROM session_connections`);
  for (const session of sessions) {
    await clearSessionData(sessionDb, session.sessionId);
  }
  await sessionDb.close();
  console.log(`Cleared org-scoped session exports -> ${sessionDbPath}`);

  await removeDbFile(dbPath);
  await removeDbFile(sessionDbPath);
} catch (error) {
  console.error("Clean failed:", error.message);
  process.exit(1);
}
