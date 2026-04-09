import Post from "../models/Post.js";
import { getRedis } from "../configs/redis.js";

const inMemoryViewBuffer = new Map();
const inMemoryWatchBuffer = new Map();
let flushTimer = null;

const VIEW_PREFIX = "buffer:reel:view:";
const WATCH_PREFIX = "buffer:reel:watch:";

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushEngagementBuffers();
  }, 5000);
};

export const bufferReelView = async (postId) => {
  const redis = getRedis();
  if (redis) {
    await redis.incr(`${VIEW_PREFIX}${postId}`);
    scheduleFlush();
    return;
  }

  inMemoryViewBuffer.set(String(postId), Number(inMemoryViewBuffer.get(String(postId)) || 0) + 1);
  scheduleFlush();
};

export const bufferReelWatchTime = async (postId, watchedSeconds) => {
  const redis = getRedis();
  if (redis) {
    await redis.hIncrBy(`${WATCH_PREFIX}${postId}`, "watch_time_total", Math.round(watchedSeconds));
    await redis.hIncrBy(`${WATCH_PREFIX}${postId}`, "watch_sessions_count", 1);
    scheduleFlush();
    return;
  }

  const current = inMemoryWatchBuffer.get(String(postId)) || { watch_time_total: 0, watch_sessions_count: 0 };
  current.watch_time_total += Math.round(watchedSeconds);
  current.watch_sessions_count += 1;
  inMemoryWatchBuffer.set(String(postId), current);
  scheduleFlush();
};

export const flushEngagementBuffers = async () => {
  const redis = getRedis();

  if (redis) {
    const viewKeys = [];
    for await (const key of redis.scanIterator({ MATCH: `${VIEW_PREFIX}*`, COUNT: 100 })) {
      viewKeys.push(key);
    }

    for (const key of viewKeys) {
      const count = Number(await redis.get(key) || 0);
      if (count > 0) {
        const postId = key.replace(VIEW_PREFIX, "");
        await Post.updateOne({ _id: postId, is_reel: true }, { $inc: { view_count: count } });
      }
      await redis.del(key);
    }

    const watchKeys = [];
    for await (const key of redis.scanIterator({ MATCH: `${WATCH_PREFIX}*`, COUNT: 100 })) {
      watchKeys.push(key);
    }

    for (const key of watchKeys) {
      const payload = await redis.hGetAll(key);
      const postId = key.replace(WATCH_PREFIX, "");
      const watchTime = Number(payload.watch_time_total || 0);
      const sessions = Number(payload.watch_sessions_count || 0);
      if (watchTime > 0 || sessions > 0) {
        await Post.updateOne(
          { _id: postId, is_reel: true },
          { $inc: { watch_time_total: watchTime, watch_sessions_count: sessions } }
        );
      }
      await redis.del(key);
    }
    return;
  }

  for (const [postId, count] of inMemoryViewBuffer.entries()) {
    if (count > 0) {
      await Post.updateOne({ _id: postId, is_reel: true }, { $inc: { view_count: count } });
    }
  }
  inMemoryViewBuffer.clear();

  for (const [postId, payload] of inMemoryWatchBuffer.entries()) {
    if (payload.watch_time_total > 0 || payload.watch_sessions_count > 0) {
      await Post.updateOne(
        { _id: postId, is_reel: true },
        { $inc: payload }
      );
    }
  }
  inMemoryWatchBuffer.clear();
};
