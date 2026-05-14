import { getRedis } from "../configs/redis.js";

const inMemoryStore = new Map();

const getClientKey = (req, prefix) => {
  if (req.userId) {
    return `${prefix}:user:${req.userId}`;
  }

  const forwarded = req.headers["x-forwarded-for"];

  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.socket.remoteAddress || "unknown";

  return `${prefix}:ip:${ip}`;
};

const touchMemoryEntry = (key, windowMs) => {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    const next = { count: 1, expiresAt: now + windowMs };
    inMemoryStore.set(key, next);
    return next;
  }

  entry.count += 1;
  inMemoryStore.set(key, entry);
  return entry;
};

export const rateLimit = ({ prefix, windowMs = 60_000, max = 500, message = "Too many requests" }) => async (req, res, next) => {
  
  if (req.method === "OPTIONS") {
    return next();
  }

  const key = getClientKey(req, prefix);
  const redis = getRedis();

  try {
    // if (redis) {
    //   const total = await redis.incr(key);
    //   if (total === 1) {
    //     await redis.expire(key, Math.ceil(windowMs / 1000));
    //   }

    //   if (total > max) {
    //     return res.status(429).json({ success: false, message });
    //   }

    //   return next();
    // }

    if (redis) {
      const current = await redis.get(key);

      if (!current) {
        await redis.set(
          key,
          1,
          {
            ex: Math.ceil(windowMs / 1000)
          }
        );

        return next();
      }

      const total = await redis.incr(key);

      if (total > max) {
        return res.status(429).json({
          success: false,
          message
        });
      }

      return next();
    }

    const entry = touchMemoryEntry(key, windowMs);
    if (entry.count > max) {
      return res.status(429).json({ success: false, message });
    }

    return next();
  } catch {
    return next();
  }
};
