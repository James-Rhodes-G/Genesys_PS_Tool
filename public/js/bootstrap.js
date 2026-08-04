import { registerSparkComponents } from "/spark/index.js";
import { initializeAppNav } from "./app-nav.js";
import { initializeGenesysApp } from "./genesys-app.js";

const initialize = async () => {
  try {
    await registerSparkComponents();
  } catch (error) {
    console.error("Failed to register Spark components:", error);
  }

  initializeAppNav();
  initializeGenesysApp();
};

if (document.readyState === "loading") {
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      initialize().catch((error) => {
        console.error("Failed to initialize app:", error);
      });
    },
    { once: true }
  );
} else {
  initialize().catch((error) => {
    console.error("Failed to initialize app:", error);
  });
}
