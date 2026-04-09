let redisClient = null;
let redisReady = false;

const buildRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  if (!process.env.REDIS_HOST) return "";

  const protocol = String(process.env.REDIS_TLS || "").toLowerCase() === "true" ? "rediss" : "redis";
  const username = encodeURIComponent(process.env.REDIS_USERNAME || "default");
  const password = process.env.REDIS_PASSWORD ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}` : "";
  const auth = process.env.REDIS_PASSWORD || process.env.REDIS_USERNAME ? `${username}${password}@` : "";
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || "6379";
  const database = process.env.REDIS_DB ? `/${process.env.REDIS_DB}` : "";

  return `${protocol}://${auth}${host}:${port}${database}`;
};

export const connectRedis = async () => {
  const redisUrl = buildRedisUrl();

  if (!redisUrl) {
    console.log("Redis not configured, continuing without cache");
    return null;
  }

  if (redisClient) return redisClient;

  let createClient;
  try {
    ({ createClient } = await import("redis"));
  } catch {
    console.log("Redis package is not installed, continuing without cache");
    return null;
  }

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
    },
  });

  redisClient.on("error", (error) => {
    redisReady = false;
    console.log("Redis error:", error.message);
  });

  redisClient.on("ready", () => {
    redisReady = true;
    console.log("Redis connected successfully");
  });

  redisClient.on("end", () => {
    redisReady = false;
  });

  await redisClient.connect();
  return redisClient;
};

export const getRedis = () => (redisReady ? redisClient : null);
