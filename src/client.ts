import fetch from "node-fetch";
import invariant from "tiny-invariant";
import retry from "async-retry";

import { Network, NetworkHostMap } from "./networks";
import { track } from "./track";
import { knownLookup } from "./enums";
import { getAccessToken, getNetwork } from "./config";

const trackedEventName = "Mirror Call";

function getToken(network: Network): string | undefined {
  const networkToken =
    network === Network.Testnet
      ? process.env.LWORKS_TESTNET_TOKEN
      : process.env.LWORKS_MAINNET_TOKEN;

  const fallbackToken = process.env.LWORKS_TOKEN;

  return networkToken ?? fallbackToken ?? getAccessToken() ?? undefined;
}

function timeElapsed(startedAt: number): number {
  return Date.now() - startedAt;
}

type MirrorOptions = {
  network: Network | "mainnet" | "testnet";
  accessToken?: string;
};
type GetMirrorOptions = Omit<MirrorOptions, "network"> & {
  network: Network;
};

async function get<T>(endpoint: string, options: GetMirrorOptions): Promise<T> {
  const startAt = Date.now();
  const networkStack = options.network.toString();
  let attempts = 0;
  const baseUrl = NetworkHostMap[options.network];
  const accessToken = options.accessToken ?? getToken(options.network);

  invariant(accessToken, `Missing access token for ${options.network}`);

  const url = `${baseUrl}${endpoint}`;
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());
  try {
    return await retry<T>(
      async () => {
        attempts = +1;
        const resp = await fetch(url, {
          headers: {
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
          throw new Error(`${resp.status} (${url}): ${errorResponseMessage}`);
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
 * Call the mirror with the configured network
 * @param endpoint The mirror endpoint such as `/api/v1/transactions?limit=100`
 */
export async function callMirror<T>(endpoint: string): Promise<T>;
/**
 * Call the mirror the the specified network and endpoint
 * @param endpoint The mirror endpoint such as `/api/v1/transactions?limit=100`
 * @param options An object to optionally specify the network and access credentials
 */
export async function callMirror<T>(endpoint: string, options: MirrorOptions): Promise<T>;
export async function callMirror<T>(endpoint: string, options?: MirrorOptions): Promise<T> {
  if (typeof options !== "undefined") {
    return get<T>(endpoint, { ...options, network: knownLookup(Network, options.network) });
  }

  const configuredNetwork = getNetwork();
  if (configuredNetwork && endpoint) {
    return get<T>(endpoint, { network: configuredNetwork });
  }

  throw new Error("Unexpected invocation");
}
