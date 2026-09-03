const parseAdminEmails = () => {
  const raw = process.env.PS_TOOL_ADMIN_EMAILS || "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
};

const adminEmails = parseAdminEmails();
const adminKey = process.env.PS_TOOL_ADMIN_KEY || "";
const adminHeader = process.env.PS_TOOL_ADMIN_HEADER || "x-ps-tool-admin";

const isAdminAuthRequired = () => adminEmails.size > 0 || Boolean(adminKey);

const isOperator = (req) => {
  if (adminKey && req.get(adminHeader) === adminKey) {
    return true;
  }
  const email = String(
    req.genesysCredentials?.userEmail ||
    req.genesysCredentials?.userName ||
    req.body?.userEmail ||
    ""
  ).toLowerCase();
  if (email && adminEmails.has(email)) {
    return true;
  }
  if (!isAdminAuthRequired()) {
    return true;
  }
  return false;
};

const requireOperator = (req, res, next) => {
  if (isOperator(req)) {
    return next();
  }
  return res.status(403).json({ error: "Operator access required." });
};

export { isAdminAuthRequired, isOperator, requireOperator };
