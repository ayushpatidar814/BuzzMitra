const formatMessage = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
};

export const logger = {
  info: (message, meta) => {
    console.log(formatMessage("INFO", message, meta));
  },

  warn: (message, meta) => {
    console.warn(formatMessage("WARN", message, meta));
  },

  error: (message, meta) => {
    console.error(formatMessage("ERROR", message, meta));
  },

  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(formatMessage("DEBUG", message, meta));
    }
  },
};
