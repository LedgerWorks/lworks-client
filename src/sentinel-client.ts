import fetch, { Response } from "node-fetch";
import retry from "async-retry";

import {
  StreamRulesQueryResult,
  StreamsRule,
  StreamsRuleType,
  StreamsRuleUpdate,
} from "./sentinel-types";
import { libraryVersion } from "./config";
import {
  ensureAccessToken,
  ensureEnvironment,
  ensureNetwork,
  shouldBailRetry,
  timeElapsed,
} from "./client-helpers";
import { Network } from "./networks";
import { track } from "./track";
import { baseLogger } from "./utils/logger";
import { Environment } from "./environment";
import { getSentinelUrl } from "./urls";

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
  environment?: Environment;
  accessToken?: string;
};

type SentinelQueryOptions = SentinelOptions & {
  ruleName?: string;
  ruleType?: StreamsRuleType;
  predicateValue?: string;
  limit?: number;
  next?: string;
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

type SentinelApiResult<TResponse> = { data: TResponse; links?: { next?: string } };

async function callSentinelApi<TResponse = unknown>(
  endpoint: string,
  config: CallSentinelConfig
): Promise<SentinelApiResult<TResponse>> {
  const startAt = Date.now();
  const { accessToken } = ensureAccessToken(config.network, config);
  const networkStack = config.network.toString();
  const environment = ensureEnvironment(config);

  const baseUrl = getSentinelUrl(environment, config.network);
  const url = `${baseUrl}${endpoint}`;
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());
  let attempts = 0;
  try {
    return await retry(
      async (bail) => {
        attempts = +1;
        const resp = await fetch(url, {
          method: config.method,
          headers: {
            "user-agent": `lworks-client/${libraryVersion}`,
            "Content-Type": "application/json",
            Authorization: accessToken,
          },
          body:
            config.method === "PUT" || config.method === "POST"
              ? JSON.stringify(config.body)
              : undefined,
        });
        logger.debug({ responseStatus: resp.status, url }, "Sentinel response");

        if (resp.status >= 400) {
          const errorMessage = await parseErrorMessage(resp);
          logger.trace(
            {
              method: config.method,
              networkStack,
              attempts,
              httpStatus: resp.status,
              errorResponseMessage: errorMessage,
            },
            "Failed"
          );

          track(trackedEventName, accessToken, {
            status: "failed",
            method: config.method,
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

          const error = new Error(
            [`${resp.status} (${url})`, errorMessage].filter(Boolean).join(": ")
          );
          if (shouldBailRetry(resp)) {
            bail(error);
          }
          throw error;
        }
        const responseBody = await resp.json();
        logger.trace(
          {
            method: config.method,
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
        return responseBody as SentinelApiResult<TResponse>;
      },
      { retries: 4 }
    );
  } catch (err) {
    logger.error(err, "Failed calling the Sentinel API");
    throw err;
  }
}

/**
 * query rules using /api/v1/rules
 * @param options - standard sentinel api options and available query parameters for the endpoint
 * @returns The query result. Pagination is possible if next is defined in the response. To paginate, include next into the next call to queryRules along with the original options.
 */
export async function queryRules(options?: SentinelQueryOptions): Promise<StreamRulesQueryResult> {
  const withNetwork = ensureNetwork(options);
  let endpoint;
  if (options?.next) {
    endpoint = options.next;
  } else {
    endpoint = "/api/v1/rules";
    const urlSearchParams = new URLSearchParams();
    if (options?.limit) {
      urlSearchParams.set("limit", `${options.limit}`);
    }
    if (options?.predicateValue) {
      urlSearchParams.set("predicateValue", options.predicateValue);
    }
    if (options?.ruleType !== undefined) {
      urlSearchParams.set("ruleType", `${options.ruleType}`);
    }
    if (options?.ruleName) {
      urlSearchParams.set("ruleName", options.ruleName);
    }
    const params = urlSearchParams.toString();
    if (params) {
      endpoint += `?${params}`;
    }
  }

  const { data, links } = await callSentinelApi<StreamsRule[]>(endpoint, {
    ...options,
    ...withNetwork,
    method: "GET",
  });

  return {
    rules: data,
    next: links?.next,
  };
}

/**
 * Find a rule based on predicate and name. This is useful to avoid adding the same rule twice.
 * This is a convenient method to queryRules.
 * In the event multiple rules have the same ruleType, predicateValue, and name the rule returned is not guaranteed to be consistent.
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
  const queryResult = await queryRules({
    ...options,
    ruleName: name,
    ruleType,
    predicateValue,
    limit: 1,
  });

  return queryResult.rules.at(0);
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

// DEPRECATED
/**
 * @deprecated use queryRules
 * @param options
 * @returns an array of rules
 */
export async function getRules(options?: SentinelOptions): Promise<StreamsRule[]> {
  const { rules } = await queryRules(options);
  return rules;
}
