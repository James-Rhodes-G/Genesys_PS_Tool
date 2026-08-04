import { renderGuxTable } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MAX_CONFIRM_USERS = 50;

const renderBulkConfirmUserTable = (users) => {
  const visibleUsers = users.slice(0, MAX_CONFIRM_USERS);
  const hiddenCount = Math.max(0, users.length - visibleUsers.length);

  const overflowHtml = hiddenCount
    ? `<p class="muted bulk-confirm-overflow">And ${escapeHtml(hiddenCount)} more user(s) not shown.</p>`
    : "";

  return `<div class="bulk-confirm-user-list">
    ${renderGuxTable({
      columns: [
        { key: "name", header: "Name" },
        { key: "userName", header: "User Name" },
        { key: "id", header: "ID" },
      ],
      rows: visibleUsers.map((user) => ({
        name: user.name || "",
        userName: user.userName || user.username || "",
        id: user.id || "",
      })),
      renderCell: (column, row) => escapeHtml(String(row[column.key] ?? "")),
      escapeHtml,
      shell: true,
      emptyMessage: "No users selected.",
    })}
    ${overflowHtml}
  </div>`;
};

const renderBulkConfirmBody = ({
  actionDescription,
  changeHeading,
  changes,
  users,
  totalOperations,
}) => {
  const changesHtml = changes.length
    ? `<ul class="bulk-confirm-changes">${changes
        .map((change) => `<li>${change}</li>`)
        .join("")}</ul>`
    : '<p class="muted">No changes queued.</p>';

  return `<div class="bulk-confirm-body">
    <p>${actionDescription}</p>
    <h4 class="bulk-confirm-heading">${escapeHtml(changeHeading)} (${changes.length})</h4>
    ${changesHtml}
    <h4 class="bulk-confirm-heading">Selected Users (${users.length})</h4>
    ${renderBulkConfirmUserTable(users)}
    <p class="muted bulk-confirm-summary">Total updates to apply: ${escapeHtml(totalOperations)}</p>
  </div>`;
};

const renderSkillAssignConfirmBody = ({ skillAssignments, users }) => {
  const changes = skillAssignments.map(
    (assignment) =>
      `<strong>${escapeHtml(assignment.skillName)}</strong> at proficiency ${escapeHtml(assignment.proficiency)}`
  );
  const totalOperations = skillAssignments.length * users.length;

  return renderBulkConfirmBody({
    actionDescription: `You are about to assign skills to <strong>${escapeHtml(users.length)}</strong> user(s). Review the changes below before continuing.`,
    changeHeading: "Skills to Assign",
    changes,
    users,
    totalOperations,
  });
};

const renderRoleAssignConfirmBody = ({ roleAssignments, users }) => {
  const changes = roleAssignments.map(
    (assignment) =>
      `<strong>${escapeHtml(assignment.roleName)}</strong> in division ${escapeHtml(assignment.divisionName)}`
  );
  const totalOperations = roleAssignments.length * users.length;

  return renderBulkConfirmBody({
    actionDescription: `You are about to assign roles to <strong>${escapeHtml(users.length)}</strong> user(s). Review the changes below before continuing.`,
    changeHeading: "Role Assignments",
    changes,
    users,
    totalOperations,
  });
};

const renderAutoAnswerConfirmBody = ({ acdAutoAnswer, users }) =>
  renderBulkConfirmBody({
    actionDescription: `You are about to set ACD Auto Answer to <strong>${escapeHtml(
      String(acdAutoAnswer)
    )}</strong> for <strong>${escapeHtml(users.length)}</strong> user(s). Review the selection below before continuing.`,
    changeHeading: "Auto Answer Setting",
    changes: [`Set ACD Auto Answer to ${escapeHtml(String(acdAutoAnswer))}`],
    users,
    totalOperations: users.length,
  });

const renderLogoffConfirmBody = ({ users }) =>
  renderBulkConfirmBody({
    actionDescription: `You are about to log off <strong>${escapeHtml(
      users.length
    )}</strong> user(s) from their Genesys app sessions. Review the selection below before continuing.`,
    changeHeading: "Logoff Action",
    changes: ["Log off selected users from Genesys app session"],
    users,
    totalOperations: users.length,
  });

const renderDisconnectConfirmBody = ({ interactions }) => {
  const previewRows = interactions.slice(0, 10);
  const previewHtml = previewRows.length
    ? `<ul class="bulk-confirm-changes">${previewRows
        .map((interaction) => {
          const labelParts = [
            interaction.conversationId,
            interaction.mediaType,
            interaction.ani || interaction.dnis,
            formatInteractionDuration(interaction.startTime),
          ].filter(Boolean);
          return `<li>${escapeHtml(labelParts.join(" · "))}</li>`;
        })
        .join("")}</ul>`
    : "";
  const overflowHtml =
    interactions.length > previewRows.length
      ? `<p class="muted bulk-confirm-overflow">And ${escapeHtml(
          interactions.length - previewRows.length
        )} more interaction(s) not shown.</p>`
      : "";

  return `<div class="bulk-confirm-body">
    <p>You are about to disconnect <strong>${escapeHtml(
      interactions.length
    )}</strong> open interaction(s). This terminates the selected conversations.</p>
    ${previewHtml}
    ${overflowHtml}
    <p class="muted bulk-confirm-summary">Total disconnect operations: ${escapeHtml(interactions.length)}</p>
  </div>`;
};

const formatInteractionDuration = (startTime) => {
  const startedAt = Date.parse(String(startTime || ""));
  if (!Number.isFinite(startedAt)) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const renderPhoneBuildConfirmBody = ({ templatePhoneId, users }) =>
  renderBulkConfirmBody({
    actionDescription: `You are about to build phones for <strong>${escapeHtml(
      users.length
    )}</strong> user(s) using template phone ID <strong>${escapeHtml(templatePhoneId)}</strong>. Review the selection below before continuing.`,
    changeHeading: "Phone Build",
    changes: [`Create phones from template ${escapeHtml(templatePhoneId)}`],
    users,
    totalOperations: users.length,
  });

const renderPasswordResetConfirmBody = ({ plan, users }) =>
  renderBulkConfirmBody({
    actionDescription: `You are about to reset passwords for <strong>${escapeHtml(
      users.length
    )}</strong> user(s). Review the details below before continuing.`,
    changeHeading: "Password Reset Mode",
    changes: [
      plan.mode === "manual"
        ? "Set one shared password for all selected users"
        : `Generate a unique random password per user${
            plan.includePasswords ? " (passwords included in results/CSV)" : ""
          }`,
    ],
    users,
    totalOperations: users.length,
  });

export {
  renderAutoAnswerConfirmBody,
  renderDisconnectConfirmBody,
  renderLogoffConfirmBody,
  renderPasswordResetConfirmBody,
  renderPhoneBuildConfirmBody,
  renderRoleAssignConfirmBody,
  renderSkillAssignConfirmBody,
};
