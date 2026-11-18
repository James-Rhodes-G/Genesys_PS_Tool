const evaluateBotResponse = ({ actual = "", expected = "", match = "contains" } = {}) => {
  const normalizedActual = String(actual || "").trim();
  const normalizedExpected = String(expected || "").trim();

  if (!normalizedExpected) {
    return {
      pass: Boolean(normalizedActual),
      reason: normalizedActual ? "Received a non-empty bot response." : "Bot response was empty.",
    };
  }

  if (match === "regex") {
    try {
      const pattern = new RegExp(normalizedExpected, "i");
      const pass = pattern.test(normalizedActual);
      return {
        pass,
        reason: pass
          ? `Response matched /${normalizedExpected}/i.`
          : `Response did not match /${normalizedExpected}/i.`,
      };
    } catch (error) {
      return { pass: false, reason: error.message || "Invalid regex pattern." };
    }
  }

  const pass = normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase());
  return {
    pass,
    reason: pass
      ? `Response contains "${normalizedExpected}".`
      : `Response does not contain "${normalizedExpected}".`,
  };
};

export { evaluateBotResponse };
