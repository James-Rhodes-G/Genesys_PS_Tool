const createPasswordResetWorkflow = ({
  createRandomPassword,
  describePasswordPolicy,
  normalizePasswordPolicy,
  validatePasswordAgainstPolicy,
}) => {
  const updateValidation = (exportMeta) => {
    if (!exportMeta || exportMeta.passwordMode !== "manual") {
      exportMeta.passwordValidationErrors = [];
      return;
    }

    const errors = [];
    const validation = validatePasswordAgainstPolicy(
      exportMeta.manualPassword || "",
      exportMeta.passwordPolicy
    );

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    if ((exportMeta.manualPassword || "") !== (exportMeta.confirmPassword || "")) {
      errors.push("Password and confirmation must match.");
    }

    exportMeta.passwordValidationErrors = errors;
  };

  const buildExtraState = (policyPayload) => {
    const passwordPolicy = normalizePasswordPolicy(policyPayload);

    return {
      kind: "bulk-password-reset",
      passwordMode: "manual",
      manualPassword: "",
      confirmPassword: "",
      includeGeneratedPasswords: false,
      passwordValidationErrors: [],
      passwordPolicy,
      passwordPolicyDescription: describePasswordPolicy(passwordPolicy),
      passwordPolicyWarning: passwordPolicy.warning || "",
    };
  };

  const buildPlan = (exportMeta, selectedUsers) => {
    const mode = exportMeta.passwordMode || "manual";

    if (mode === "manual") {
      updateValidation(exportMeta);
      if (exportMeta.passwordValidationErrors.length > 0) {
        const error = new Error(exportMeta.passwordValidationErrors[0]);
        error.details = exportMeta.passwordValidationErrors.slice();
        throw error;
      }

      return {
        mode,
        includePasswords: false,
        passwordResets: selectedUsers.map((user) => ({
          userId: user.id,
          newPassword: exportMeta.manualPassword,
        })),
        resultRows: selectedUsers.map((user) => ({
          name: user.name || "",
          userName: user.userName || user.username || "",
          id: user.id,
          mode: "manual",
          password: "",
        })),
      };
    }

    const generatedPasswords = new Set();
    const includePasswords = Boolean(exportMeta.includeGeneratedPasswords);
    const passwordResets = selectedUsers.map((user) => {
      const generatedPassword = createRandomPassword(exportMeta.passwordPolicy, generatedPasswords);
      return {
        userId: user.id,
        newPassword: generatedPassword,
        generatedPassword,
      };
    });

    return {
      mode,
      includePasswords,
      passwordResets,
      resultRows: selectedUsers.map((user) => {
        const reset = passwordResets.find((entry) => entry.userId === user.id);
        return {
          name: user.name || "",
          userName: user.userName || user.username || "",
          id: user.id,
          mode: "random",
          password: includePasswords ? reset?.generatedPassword || "" : "",
        };
      }),
    };
  };

  return {
    buildExtraState,
    buildPlan,
    updateValidation,
  };
};

export { createPasswordResetWorkflow };
