import * as bulkAutoAnswer from "./bulk-auto-answer.js";
import * as bulkDisconnect from "./bulk-disconnect.js";
import * as bulkLoadSchedules from "./bulk-load-schedules.js";
import * as bulkLogoff from "./bulk-logoff.js";
import * as bulkPasswordReset from "./bulk-password-reset.js";
import * as bulkPhoneBuild from "./bulk-phone-build.js";
import * as bulkPhoneDelete from "./bulk-phone-delete.js";
import * as bulkPhoneMove from "./bulk-phone-move.js";
import * as bulkPriorityUpdate from "./bulk-priority-update.js";
import * as bulkRoleAssign from "./bulk-role-assign.js";
import * as bulkSkillAssign from "./bulk-skill-assign.js";
import * as userRoleExport from "./user-role-export.js";
import * as userSkillExport from "./user-skill-export.js";

const handlers = {
  "bulk-auto-answer": bulkAutoAnswer,
  "bulk-disconnect": bulkDisconnect,
  "bulk-load-schedules": bulkLoadSchedules,
  "bulk-logoff": bulkLogoff,
  "bulk-password-reset": bulkPasswordReset,
  "bulk-phone-build": bulkPhoneBuild,
  "bulk-phone-delete": bulkPhoneDelete,
  "bulk-phone-move": bulkPhoneMove,
  "bulk-priority-update": bulkPriorityUpdate,
  "bulk-role-assign": bulkRoleAssign,
  "bulk-skill-assign": bulkSkillAssign,
  "user-role-export": userRoleExport,
  "user-skill-export": userSkillExport,
};

const getJobHandler = (type) => handlers[type] || null;

const listJobTypes = () => Object.keys(handlers);

export { getJobHandler, listJobTypes };
