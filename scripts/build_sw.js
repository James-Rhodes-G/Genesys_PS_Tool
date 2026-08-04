import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const swPath = path.join(projectRoot, "public", "service-worker.js");

try {
  const contents = await readFile(swPath, "utf-8");
  if (!contents.includes("CACHE_NAME")) {
    throw new Error("Missing CACHE_NAME in service-worker.js");
  }
  console.log(`Service worker ready: ${swPath}`);
} catch (error) {
  console.error("Service worker build check failed.");
  console.error(error.message);
  process.exit(1);
}
