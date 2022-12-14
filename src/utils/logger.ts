import createLogger from "pino";

const isDevelopment = process.env.NODE_ENV === "development";
const devLogLevel = "info";
const prodLogLevel = "warn";

export const baseLogger = createLogger({
  // One of 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent'.
  level: process.env.LWORKS_LOG_LEVEL || (isDevelopment ? devLogLevel : prodLogLevel),
});
