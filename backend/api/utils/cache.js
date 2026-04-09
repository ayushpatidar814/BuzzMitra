import { getRedis } from "../configs/redis.js";

const DEFAULT_TTL_SECONDS = 60;

export const buildCacheKey = (...parts) =>
  parts
    .flat()
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(":");

export const getCache = async (key) => {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const setCache = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {}
};

export const deleteCache = async (...keys) => {
  const redis = getRedis();
  const filteredKeys = keys.flat().filter(Boolean);
  if (!redis || !filteredKeys.length) return;

  try {
    await redis.del(filteredKeys);
  } catch {}
};

export const deleteCacheByPrefix = async (...prefixes) => {
  const redis = getRedis();
  if (!redis) return;

  for (const prefix of prefixes.flat().filter(Boolean)) {
    try {
      const matches = [];
      for await (const key of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        matches.push(key);
      }
      if (matches.length) {
        await redis.del(matches);
      }
    } catch {}
  }
};
