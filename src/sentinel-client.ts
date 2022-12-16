import fetch, { Response } from "node-fetch";
import retry from "async-retry";

import { PaginatedRuleResponse, StreamsRule, StreamsRuleType } from "./sentinel-types";
import { libraryVersion } from "./config";
import { ensureAccessToken, ensureNetwork, timeElapsed } from "./client-helpers";
import { Network, NetworkHostMapForSentinel } from "./networks";
import { track } from "./track";
import { baseLogger } from "./utils/logger";

const logger = baseLogger.child({ client: "sentinel" });
const trackedEventName = "Sentinel Call";

async function parseErrorMessage(response: Response): Promise<string | null> {
  try {
    const responseBody = await response.json();
    // Sentinel code-level errors
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
    logger.warn(
      "Failed to parse error body from Sentinel response; falling back to status code only"
    );
    return null;
  }
}

type SentinelOptions = {
  network?: Network | "mainnet" | "testnet";
  accessToken?: string;
};

type SentinelUpsertOptions = SentinelOptions & {
  /**
   * Looks up rule by id before saving to update existing record
   */
  ruleId?: string;
  /**
   * Looks up rule by name and predicate value before saving to update existing record
   */
  deduplicateRuleName?: boolean;
};

type GetRuleSentinelConfig = Omit<SentinelOptions, "network"> & {
  network: Network;
  method: "GET";
};
type PutRuleSentinelConfig = Omit<SentinelOptions, "network"> & {
  network: Network;
  method: "PUT";
  body: unknown;
};
type PostRuleSentinelConfig = Omit<SentinelOptions, "network"> & {
  network: Network;
  method: "POST";
  body: unknown;
};
type DeleteRuleSentinelConfig = Omit<SentinelOptions, "network"> & {
  network: Network;
  method: "DELETE";
};

type CallSentinelConfig =
  | GetRuleSentinelConfig
  | PutRuleSentinelConfig
  | PostRuleSentinelConfig
  | DeleteRuleSentinelConfig;

async function callSentinelApi<TResponse = unknown>(
  endpoint: string,
  options: CallSentinelConfig
): Promise<{ data: TResponse }> {
  const startAt = Date.now();
  const { accessToken } = ensureAccessToken(options.network, options);
  const networkStack = options.network.toString();
  let attempts = 0;
  const baseUrl = NetworkHostMapForSentinel[options.network];

  const url = `${baseUrl}${endpoint}`;
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());
  try {
    return await retry(
      async () => {
        attempts = +1;
        const resp = await fetch(url, {
          method: options.method,
          headers: {
            "user-agent": `lworks-client/${libraryVersion}`,
            "Content-Type": "application/json",
            Authorization: accessToken,
          },
          body:
            options.method === "PUT" || options.method === "POST"
              ? JSON.stringify(options.body)
              : undefined,
        });

        if (resp.status >= 400) {
          const errorMessage = await parseErrorMessage(resp);
          logger.trace(
            {
              method: options.method,
              networkStack,
              attempts,
              httpStatus: resp.status,
              errorResponseMessage: errorMessage,
            },
            "Failed"
          );

          track(trackedEventName, accessToken, {
            status: "failed",
            method: options.method,
            timeElapsed: timeElapsed(startAt),
            url,
            pathname: parsedUrl.pathname,
            queryParams,
            endpoint,
            networkStack,
            attempts,
            httpStatus: resp.status,
            errorResponseMessage: errorMessage,
          });

          throw new Error([`${resp.status} (${url})`, errorMessage].filter(Boolean).join(": "));
        }
        const responseBody = await resp.json();
        logger.trace(
          {
            method: options.method,
            networkStack,
            attempts,
            httpStatus: resp.status,
          },
          "Successful"
        );
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
        return responseBody as { data: TResponse };
      },
      { retries: 4 }
    );
  } catch (err) {
    logger.error(err, "Failed calling the Sentinel API");
    throw err;
  }
}

export async function getRules(options?: SentinelOptions): Promise<StreamsRule[]> {
  const endpoint = "/api/v1/rules";
  const withNetwork = ensureNetwork(options);

  return (
    await callSentinelApi<StreamsRule[]>(endpoint, {
      ...options,
      ...withNetwork,
      method: "GET",
    })
  ).data;
}

type StreamsRuleUpdateFields =
  | "ruleName"
  | "ruleType"
  | "chain"
  | "predicateValue"
  | "actionWebhookUrl"
  | "actionWebhookCustomHeaders";

export type StreamsRuleUpdate = Pick<StreamsRule, StreamsRuleUpdateFields>;

/**
 * Find a rule based on predicate and name. This is useful to avoid adding the same
 * rule twice
 * @param ruleType
 * @param predicateValue
 * @param name
 * @param options Standard sentinel options
 * @returns The rule if found, undefined otherwise
 */
export async function findRule(
  ruleType: StreamsRuleType,
  predicateValue: string,
  name: string,
  options?: SentinelOptions
): Promise<StreamsRule | undefined> {
  const withNetwork = ensureNetwork(options);
  const contextualLogger = logger.child({
    network: withNetwork.network,
    ruleType,
    predicateValue,
    name,
  });

  contextualLogger.debug(
    `Searching for rule of type ${ruleType} with predicate value ${predicateValue} on ${withNetwork.network}`
  );
  const endpoint = `/api/v1/rules/types/${ruleType}/predicateValues/${predicateValue}`;
  const response = await callSentinelApi<PaginatedRuleResponse>(endpoint, {
    ...options,
    ...withNetwork,
    method: "GET",
  });

  const matchingRules = response.data.rules;
  logger.trace({ matchingRules }, `Found ${matchingRules.length} rules matching predicate`);
  const matchByName = matchingRules.find((x) => x.ruleName === name);
  logger.trace({ matchByName }, `Match by name: ${matchByName?.ruleId ?? "No match"}`);
  return matchByName;
}

export async function getRuleById(
  ruleId: string,
  options?: SentinelOptions
): Promise<StreamsRule | undefined> {
  try {
    const withNetwork = ensureNetwork(options);
    const response = await callSentinelApi<StreamsRule>(`/api/v1/rules/${ruleId}`, {
      ...options,
      ...withNetwork,
      method: "GET",
    });
    return response.data;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("404 ")) {
      return undefined;
    }
    throw err;
  }
}

export async function deleteRuleById(
  ruleId: string,
  options?: SentinelOptions
): Promise<StreamsRule> {
  const withNetwork = ensureNetwork(options);

  const endpoint = `/api/v1/rules/${ruleId}`;
  const { data } = await callSentinelApi<StreamsRule>(endpoint, {
    ...options,
    ...withNetwork,
    method: "DELETE",
  });
  return data;
}

export async function upsertRule(
  rule: StreamsRuleUpdate,
  options?: SentinelUpsertOptions
): Promise<StreamsRule> {
  const withNetwork = ensureNetwork(options);
  let existingRule: StreamsRule | undefined;
  if (options?.ruleId) {
    existingRule = await getRuleById(options.ruleId, { ...options, ...withNetwork });
  }

  if (!existingRule && options?.deduplicateRuleName && rule.ruleName) {
    existingRule = await findRule(rule.ruleType, rule.predicateValue, rule.ruleName, {
      ...options,
      ...withNetwork,
    });
  }

  const { endpoint, method } = existingRule
    ? { endpoint: `/api/v1/rules/${existingRule.ruleId}`, method: "PUT" as const }
    : { endpoint: `/api/v1/rules`, method: "POST" as const };

  const { data } = await callSentinelApi<StreamsRule>(endpoint, {
    ...options,
    ...withNetwork,
    method,
    body: rule,
  });
  return data;
}

export async function createRule(
  rule: StreamsRuleUpdate,
  options?: SentinelOptions
): Promise<StreamsRule> {
  const withNetwork = ensureNetwork(options);

  const { data } = await callSentinelApi<StreamsRule>("/api/v1/rules", {
    ...options,
    ...withNetwork,
    method: "POST",
    body: rule,
  });
  return data;
}
