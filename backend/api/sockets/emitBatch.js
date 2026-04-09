const batchState = new Map();

const buildBatchKey = (room, event) => `${room}:${event}`;

export const emitBatched = (io, room, event, payload, delayMs = 80) => {
  const key = buildBatchKey(room, event);
  const existing = batchState.get(key) || { items: [], timer: null };
  existing.items.push(payload);

  if (!existing.timer) {
    existing.timer = setTimeout(() => {
      const current = batchState.get(key);
      batchState.delete(key);
      if (!current?.items?.length) return;
      io.to(room).emit(`${event}_batch`, current.items);
    }, delayMs);
  }

  batchState.set(key, existing);
};
