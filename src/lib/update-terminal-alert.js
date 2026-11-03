const WIDTH = 70;
const border = "=".repeat(WIDTH);

const ansi = (code, text) => (process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text);

const printServerUpdateAlert = ({ current, latest, releaseUrl }) => {
  const title = ansi("1;33", "  PS TOOL — SERVER UPDATE AVAILABLE");
  const lines = [
    border,
    title,
    border,
    `  Installed:  v${current}`,
    `  Latest:     v${latest}`,
    "",
    "  Update the Node server (pull the latest release and restart).",
    "",
    releaseUrl ? `  Release: ${releaseUrl}` : "  Release: see GitHub releases for this repository.",
    border,
  ];

  for (const line of lines) {
    console.warn(line);
  }
};

export { printServerUpdateAlert };
