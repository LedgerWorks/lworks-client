import { Environment } from "./environment";
import { MirrorOptions, MirrorResponseError, callMirror } from "./mirror-client";
import { baseLogger } from "./utils/logger";

export type FallbackOptions = {
  fallbackStatusCodes: number[];
  fallbackOptions: MirrorOptions;
};

const logger = baseLogger.child({ client: "mirror-fallback" });

/**
 * This is a helpful wrapper around the callMirror function. First, call the mirror with the specified options. If a 404 or other one of the optionally specified fallbackStatusCodes is returned, make the same call to the public mirror or optionally specified fallbackOptions.
 * @param endpoint The mirror endpoint such as `/api/v1/transactions?limit=100`
 * @param options An object to optionally specify the network, environment, access credentials, and fallback status codes
 */
export async function callMirrorWithFallback<T>(
  endpoint: string,
  options: MirrorOptions & FallbackOptions = {
    fallbackStatusCodes: [404],
    fallbackOptions: { environment: Environment.public },
  }
): Promise<T> {
  const { fallbackStatusCodes, fallbackOptions, ...baseOptions } = options;
  try {
    return await callMirror<T>(endpoint, baseOptions);
  } catch (e) {
    if (e instanceof MirrorResponseError && fallbackStatusCodes.includes(e.status)) {
      logger.debug(`Falling back to public mirror due to: ${e.message}`);
      return callMirror<T>(endpoint, { ...baseOptions, ...fallbackOptions });
    }
    throw e;
  }
}
