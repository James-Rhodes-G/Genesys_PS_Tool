import { requireAdminSession } from "../middleware/admin-session.js";

/** @deprecated Use requireAdminSession — local operator cookie session. */
const isAdminAuthRequired = () => true;

/** @deprecated Use req.adminOperator from loadAdminSession middleware. */
const isOperator = (req) => Boolean(req.adminOperator?.username);

const requireOperator = requireAdminSession;

export { isAdminAuthRequired, isOperator, requireOperator, requireAdminSession };
