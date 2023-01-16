import fetch from "node-fetch";
import retry from "async-retry";

import { Network, NetworkHostMap } from "./networks";
import { track } from "./track";
import { libraryVersion } from "./config";
import { ensureAccessToken, ensureNetwork, shouldBailRetry, timeElapsed } from "./client-helpers";
import { baseLogger } from "./utils/logger";

const logger = baseLogger.child({ client: "mirror" });
const trackedEventName = "Mirror Call";

type MirrorConfig = {
  network: Network;
  accessToken: string;
};

export type MirrorOptions = Partial<
  Omit<MirrorConfig, "network"> & { network: Network | "mainnet" | "testnet" }
>;

async function get<T>(endpoint: string, config: MirrorConfig): Promise<T> {
  const startAt = Date.now();
  const { network, accessToken } = config;
  const networkStack = network.toString();

  let attempts = 0;
  const baseUrl = NetworkHostMap[config.network];

  const url = `${baseUrl}${endpoint}`;
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());
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

        if (resp.status >= 400) {
          const errorResponse = (await resp.json()) as {
            _status: {
              messages: Array<{ message: string }>;
            };
          };
          // eslint-disable-next-line no-underscore-dangle
          const errorResponseMessage = errorResponse._status.messages[0].message;

          track(trackedEventName, accessToken, {
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
          // eslint-disable-next-line no-underscore-dangle
          const error = new Error(`${resp.status} (${url}): ${errorResponseMessage}`);
          if (shouldBailRetry(resp)) {
            bail(error);
          }
          throw error;
        }
        track(trackedEventName, accessToken, {
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
    console.error(err);
    track("Failed Mirror Call", accessToken, {
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
 * Call the mirror the the specified network and endpoint
 * @param endpoint The mirror endpoint such as `/api/v1/transactions?limit=100`
 * @param options An object to optionally specify the network and access credentials
 */
export async function callMirror<T>(endpoint: string, options: MirrorOptions = {}): Promise<T> {
  if (!endpoint) {
    throw new Error("Endpoint is required");
  }

  const { network } = ensureNetwork(options);
  const { accessToken } = ensureAccessToken(network, options);

  return get<T>(endpoint, { accessToken, network });
}
