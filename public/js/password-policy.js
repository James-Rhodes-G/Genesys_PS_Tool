const DEFAULT_PASSWORD_POLICY = {
  available: false,
  source: "fallback",
  minLength: 8,
  maxLength: 400,
  minUppercase: 1,
  minLowercase: 1,
  minNumbers: 1,
  minSpecial: 1,
  warning: "Organization password policy could not be loaded. Generated passwords use a strong fallback profile.",
  raw: null,
};

const SPECIAL_CHARACTERS = "!@#$%^&*()-_=+[]{}:,.?";

const getFirstNumber = (source, candidates) => {
  for (const candidate of candidates) {
    const parts = candidate.split(".");
    let current = source;

    for (const part of parts) {
      current = current?.[part];
    }

    const value = Number(current);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
};

const normalizePasswordPolicy = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { ...DEFAULT_PASSWORD_POLICY };
  }

  const raw = payload.raw || payload.policy || payload;
  const available = Boolean(payload.available);

  const minLength =
    getFirstNumber(raw, [
      "passwordRequirements.minimumLength",
      "minimumLength",
      "minimumPasswordLength",
      "passwordMinimumLength",
      "passwordSettings.minimumLength",
      "passwordSettings.minimumPasswordLength",
    ]) ?? DEFAULT_PASSWORD_POLICY.minLength;
  const maxLength =
    getFirstNumber(raw, [
      "maximumLength",
      "maximumPasswordLength",
      "passwordMaximumLength",
      "passwordSettings.maximumLength",
      "passwordSettings.maximumPasswordLength",
    ]) ?? DEFAULT_PASSWORD_POLICY.maxLength;
  const minUppercase =
    getFirstNumber(raw, [
      "passwordRequirements.minimumUpper",
      "minimumUppercaseLetters",
      "minimumUppercase",
      "minUpper",
      "minUppercaseLetters",
      "passwordSettings.minimumUppercaseLetters",
    ]) ?? DEFAULT_PASSWORD_POLICY.minUppercase;
  const minLowercase =
    getFirstNumber(raw, [
      "passwordRequirements.minimumLower",
      "minimumLowercaseLetters",
      "minimumLowercase",
      "minLower",
      "minLowercaseLetters",
      "passwordSettings.minimumLowercaseLetters",
    ]) ?? DEFAULT_PASSWORD_POLICY.minLowercase;
  const minNumbers =
    getFirstNumber(raw, [
      "passwordRequirements.minimumDigits",
      "minimumNumbers",
      "minimumDigits",
      "minimumNumerals",
      "minNumbers",
      "minDigits",
      "minNumerals",
      "passwordSettings.minimumNumbers",
      "passwordSettings.minimumNumerals",
    ]) ?? DEFAULT_PASSWORD_POLICY.minNumbers;
  const minSpecial =
    getFirstNumber(raw, [
      "passwordRequirements.minimumSpecials",
      "minimumSpecialCharacters",
      "minimumSpecials",
      "minSpecialCharacters",
      "passwordSettings.minimumSpecialCharacters",
    ]) ?? DEFAULT_PASSWORD_POLICY.minSpecial;
  const minLetters =
    getFirstNumber(raw, [
      "passwordRequirements.minimumLetters",
      "minimumLetters",
      "passwordSettings.minimumLetters",
    ]) ?? 0;

  return {
    available,
    source: payload.source || (available ? "organization" : DEFAULT_PASSWORD_POLICY.source),
    minLength,
    maxLength,
    minUppercase,
    minLowercase,
    minNumbers,
    minSpecial,
    minLetters,
    warning: payload.warning || "",
    raw,
  };
};

const describePasswordPolicy = (policy) =>
  [
    `min ${policy.minLength}`,
    policy.maxLength ? `max ${policy.maxLength}` : null,
    policy.minUppercase ? `${policy.minUppercase} uppercase` : null,
    policy.minLowercase ? `${policy.minLowercase} lowercase` : null,
    policy.minLetters ? `${policy.minLetters} letters total` : null,
    policy.minNumbers ? `${policy.minNumbers} number` : null,
    policy.minSpecial ? `${policy.minSpecial} special` : null,
  ]
    .filter(Boolean)
    .join(", ");

const countMatches = (value, pattern) => {
  const matches = String(value || "").match(pattern);
  return matches ? matches.length : 0;
};

const validatePasswordAgainstPolicy = (password, policyInput) => {
  const policy = normalizePasswordPolicy(policyInput);
  const value = String(password || "");
  const errors = [];

  if (!value) {
    errors.push("Password is required.");
  }

  if (value.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters.`);
  }

  if (policy.maxLength && value.length > policy.maxLength) {
    errors.push(`Password must be ${policy.maxLength} characters or fewer.`);
  }

  if (countMatches(value, /[A-Z]/g) < policy.minUppercase) {
    errors.push(`Password must include at least ${policy.minUppercase} uppercase letter(s).`);
  }

  if (countMatches(value, /[a-z]/g) < policy.minLowercase) {
    errors.push(`Password must include at least ${policy.minLowercase} lowercase letter(s).`);
  }

  if (countMatches(value, /[0-9]/g) < policy.minNumbers) {
    errors.push(`Password must include at least ${policy.minNumbers} number(s).`);
  }

  if (countMatches(value, /[A-Za-z]/g) < (policy.minLetters || 0)) {
    errors.push(`Password must include at least ${policy.minLetters} letter(s).`);
  }

  const specialPattern = new RegExp(`[${SPECIAL_CHARACTERS.replace(/[[\]\\^$.*+?(){}|/-]/g, "\\$&")}]`, "g");
  if (countMatches(value, specialPattern) < policy.minSpecial) {
    errors.push(`Password must include at least ${policy.minSpecial} special character(s).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    policy,
  };
};

const randomInt = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max;

const shuffleCharacters = (characters) => {
  const items = characters.slice();
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const createRandomPassword = (policyInput, existingPasswords = new Set()) => {
  const policy = normalizePasswordPolicy(policyInput);
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = SPECIAL_CHARACTERS;
  const allCharacters = `${upper}${lower}${numbers}${specials}`;
  const minRequiredLength =
    policy.minUppercase + policy.minLowercase + policy.minNumbers + policy.minSpecial;
  const targetLength = Math.min(
    Math.max(policy.minLength, minRequiredLength, 16),
    policy.maxLength || 400
  );

  let attempts = 0;
  while (attempts < 100) {
    attempts += 1;
    const characters = [];

    for (let count = 0; count < policy.minUppercase; count += 1) {
      characters.push(upper[randomInt(upper.length)]);
    }
    for (let count = 0; count < policy.minLowercase; count += 1) {
      characters.push(lower[randomInt(lower.length)]);
    }
    for (let count = 0; count < policy.minNumbers; count += 1) {
      characters.push(numbers[randomInt(numbers.length)]);
    }
    for (let count = 0; count < policy.minSpecial; count += 1) {
      characters.push(specials[randomInt(specials.length)]);
    }

    while (characters.length < targetLength) {
      characters.push(allCharacters[randomInt(allCharacters.length)]);
    }

    const password = shuffleCharacters(characters).join("");
    const validation = validatePasswordAgainstPolicy(password, policy);
    if (validation.valid && !existingPasswords.has(password)) {
      existingPasswords.add(password);
      return password;
    }
  }

  throw new Error("Unable to generate a unique password that satisfies the current policy.");
};

export {
  createRandomPassword,
  describePasswordPolicy,
  normalizePasswordPolicy,
  validatePasswordAgainstPolicy,
};
