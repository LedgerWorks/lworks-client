import fetch from "node-fetch";
import retry from "async-retry";

import { Network } from "../../networks";
import { track } from "../../track";
import { libraryVersion } from "../../config";
import {
  ensureAccessToken,
  ensureEnvironment,
  ensureNetwork,
  shouldBailRetry,
  timeElapsed,
} from "../client-helpers";
import { baseLogger } from "../../utils/logger";
import { Environment } from "../../environment";

import { getMirrorUrl } from "./get-mirror-url";

const logger = baseLogger.child({ client: "mirror" });
const trackedEventName = "Mirror Call";

type MirrorConfig = {
  network: Network;
  environment: Environment;
  accessToken: string;
  bailRetryStatuses?: number[];
};

export type MirrorOptions = Partial<
  Omit<MirrorConfig, "network"> & {
    network: Network | "mainnet" | "testnet";
  }
>;

export class MirrorResponseError extends Error {
  readonly status: number;

  constructor(status: number, url: string, errorResponseMessage: string | undefined) {
    super(`${status} (${url}): ${errorResponseMessage}`);
    this.status = status;
  }
}

/**
 * Returns a function to track calls when the environment is an LworksEnvironment. When the environment is public, we track nothing.
 * @param environment
 * @returns
 */
function trackerJacker(environment: Environment): typeof track {
  if (environment === Environment.public) {
    return () => Promise.resolve();
  }
  return track;
}

async function get<T>(endpoint: string, config: MirrorConfig): Promise<T> {
  const startAt = Date.now();
  const { network, accessToken } = config;
  const networkStack = network.toString();

  let attempts = 0;
  const baseUrl = getMirrorUrl(config.environment, config.network);

  const url = `${baseUrl}${endpoint}`;
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());

  const callTracker = trackerJacker(config.environment);

  logger.trace({ url, baseUrl }, "Mirror call");
  try {
    return await retry<T>(
      async (bail) => {
        attempts = +1;
        const resp = await fetch(url, {
          headers: {
            "user-agent": `lworks-client/${libraryVersion}`,
            "Content-Type": "application/json",
            Authorization: accessToken,
          },
        });
        logger.debug({ responseStatus: resp.status, url }, "Mirror response");

        if (resp.status >= 400) {
          const errorResponse = (await resp.json()) as Partial<{
            _status: {
              messages: Array<{ message: string }>;
            };
          }>;
          const { _status: status } = errorResponse;
          // eslint-disable-next-line no-underscore-dangle
          const errorResponseMessage = status
            ? status.messages.at(0)?.message
            : "Unknown error response";

          callTracker(trackedEventName, accessToken, {
            status: "failed",
            timeElapsed: timeElapsed(startAt),
            url,
            pathname: parsedUrl.pathname,
            queryParams,
            endpoint,
            networkStack,
            attempts,
            httpStatus: resp.status,
            errorResponseMessage,
          });
          const error = new MirrorResponseError(resp.status, url, errorResponseMessage);
          if (shouldBailRetry(resp, config.bailRetryStatuses)) {
            bail(error);
          }
          throw error;
        }
        callTracker(trackedEventName, accessToken, {
          status: "success",
          timeElapsed: timeElapsed(startAt),
          url,
          pathname: parsedUrl.pathname,
          queryParams,
          endpoint,
          networkStack,
          attempts,
          httpStatus: resp.status,
        });
        return resp.json() as Promise<T>;
      },
      { retries: 4 }
    );
  } catch (err) {
    callTracker("Failed Mirror Call", accessToken, {
      timeElapsed: timeElapsed(startAt),
      url,
      pathname: parsedUrl.pathname,
      queryParams,
      endpoint,
      networkStack,
    });
    throw err;
  }
}

/**
 * Call the mirror with the specified network and endpoint
 * @param endpoint The mirror endpoint such as `/api/v1/transactions?limit=100`
 * @param options An object to optionally specify the network and access credentials
 */
export async function callMirror<T>(endpoint: string, options: MirrorOptions = {}): Promise<T> {
  if (!endpoint) throw new Error("Endpoint is required");

  const { network } = ensureNetwork(options);
  const environment = ensureEnvironment({
    ...options,
    environmentLookup: "LWORKS_MIRROR_ENVIRONMENT",
  });

  const { accessToken } =
    environment === Environment.public ? { accessToken: "" } : ensureAccessToken(network, options);

  return get<T>(endpoint, {
    accessToken,
    network,
    environment,
    bailRetryStatuses: options.bailRetryStatuses,
  });
}
