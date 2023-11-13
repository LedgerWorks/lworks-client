import { Response } from "node-fetch";
import createLogger from "pino";

type Logger = ReturnType<typeof createLogger>;

async function parseResponseErrorMessage(response: Response, logger: Logger) {
  try {
    const responseBody = await response.json();
    // Streams code-level errors
    if ("error" in responseBody) {
      return responseBody.error as string;
    }
    // API Gateway errors
    if ("Message" in responseBody) {
      return responseBody.Message as string;
    }
    // Unknown JSON error
    return JSON.stringify(responseBody);
  } catch (err) {
    logger.warn("Failed to parse error body response; falling back to status code only");
    return null;
  }
}

/**
 * Get an object that can parse an error message out of an HTTP (fetch)
 * response. This method binds the provided logger so that error message parsing logs can
 * have the caller's context
 * @param logger The logger to bind
 * @returns An object that can parse HTTP error messages
 */
export function getErrorMessageParser(logger: Logger) {
  return {
    parse: (response: Response) => parseResponseErrorMessage(response, logger),
  };
}
