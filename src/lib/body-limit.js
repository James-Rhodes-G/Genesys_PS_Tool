const parseBodyLimitBytes = (value, fallback = "1mb") => {
  const raw = String(value ?? fallback).trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid JSON_BODY_LIMIT: ${value}`);
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid JSON_BODY_LIMIT: ${value}`);
  }
  const unit = match[2] || "b";
  const multipliers = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.floor(amount * multipliers[unit]);
};

export { parseBodyLimitBytes };
