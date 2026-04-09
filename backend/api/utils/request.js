import mongoose from "mongoose";

export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

export const parseBoundedInteger = (value, { defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export const trimString = (value, { maxLength = 5000 } = {}) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
