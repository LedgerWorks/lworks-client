import retry from "async-retry";
import invariant from "tiny-invariant";

import { libraryVersion } from "../../config";
import { LWorksEnvironment } from "../../environment";
import { getErrorMessageParser } from "../../get-error-message-parser";
import { Network } from "../../networks";
import { baseLogger } from "../../utils/logger";
import {
  ensureAccessToken,
  ensureEnvironment,
  ensureNetwork,
  shouldBailRetry,
} from "../client-helpers";
import { getStreamsUrl } from "../urls";

import { StreamRulesQueryResult, StreamsRule, StreamsRuleType, StreamsRuleUpdate } from "./types";

const logger = baseLogger.child({ client: "streams" });
const errorMessageParser = getErrorMessageParser(logger);

type StreamsOptions = Partial<{
  network: Network | "mainnet" | "testnet";
  environment: LWorksEnvironment;
  accessToken: string;
  bailRetryStatuses: number[];
}>;

type WaitForPropagationOptions = Partial<{
  /**
   * Stream Rule Create, Update, Delete actions are asynchronous. This will ensure the rule was propagated successfully before returning by polling the API.
   */
  waitForPropagation: boolean;
}>;

type StreamsDeleteOptions = StreamsOptions & WaitForPropagationOptions;

type StreamsQueryOptions = StreamsOptions &
  Partial<{
    ruleName: string;
    ruleType: StreamsRuleType;
    predicateValue: string;
    limit: number;
    next: string;
  }>;

type StreamsUpsertOptions = StreamsOptions &
  WaitForPropagationOptions &
  Partial<{
    /**
     * Looks up rule by id before saving to update existing record
     */
    ruleId: string;
    /**
     * Looks up rule by name and predicate value before saving to update existing record
     */
    deduplicateRuleName: boolean;
  }>;

type CreateOptions = StreamsOptions & WaitForPropagationOptions;

type GetRuleStreamsConfig = Omit<StreamsOptions, "network"> & {
  network: Network;
  method: "GET";
};
type PutRuleStreamsConfig = Omit<StreamsOptions, "network"> & {
  network: Network;
  method: "PUT";
  body: unknown;
};
type PostRuleStreamsConfig = Omit<StreamsOptions, "network"> & {
  network: Network;
  method: "POST";
  body: unknown;
};
type DeleteRuleStreamsConfig = Omit<StreamsOptions, "network"> & {
  network: Network;
  method: "DELETE";
};

type CallStreamsConfig =
  | GetRuleStreamsConfig
  | PutRuleStreamsConfig
  | PostRuleStreamsConfig
  | DeleteRuleStreamsConfig;

type StreamsApiResult<TResponse> = { data: TResponse; links?: { next?: string } };

async function callStreamsApi<TResponse = unknown>(
  endpoint: string,
  config: CallStreamsConfig
): Promise<StreamsApiResult<TResponse>> {
  const { accessToken } = ensureAccessToken(config.network, config);
  const networkStack = config.network.toString();

  const environment = ensureEnvironment(config);

  const baseUrl = getStreamsUrl(environment, config.network);
  const url = `${baseUrl}${endpoint}`;
  let attempts = 0;
  const response = await retry(
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
      logger.debug({ responseStatus: resp.status, url }, "Streams response");

      if (resp.status >= 400) {
        const errorMessage = await errorMessageParser.parse(resp);
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

        const error = new Error(
          [`${resp.status} (${url})`, errorMessage].filter(Boolean).join(": ")
        );
        if (shouldBailRetry(resp, config.bailRetryStatuses)) {
          bail(error);
          return null;
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

      return responseBody as StreamsApiResult<TResponse>;
    },
    { retries: 4 }
  );

  invariant(response, "Retry should throw in the null case");
  return response;
}

/**
 * query rules using /api/v1/rules
 * @param options - standard streams api options and available query parameters for the endpoint
 * @returns The query result. Pagination is possible if next is defined in the response. To paginate, include next into the next call to queryRules along with the original options.
 */
export async function queryRules(options?: StreamsQueryOptions): Promise<StreamRulesQueryResult> {
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

  const { data, links } = await callStreamsApi<StreamsRule[]>(endpoint, {
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
 * @param options Standard streams options
 * @returns The rule if found, undefined otherwise
 */
export async function findRule(
  ruleType: StreamsRuleType,
  predicateValue: string,
  name: string,
  options?: StreamsOptions
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
  options?: StreamsOptions
): Promise<StreamsRule | undefined> {
  try {
    const withNetwork = ensureNetwork(options);
    const response = await callStreamsApi<StreamsRule>(`/api/v1/rules/${ruleId}`, {
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

async function waitForRulePropagation(
  ruleId: string,
  config: StreamsOptions,
  rulePredicate: (rule: StreamsRule | undefined) => boolean
) {
  await retry(
    async () => {
      const rule = await getRuleById(ruleId, config);
      if (!rulePredicate(rule)) {
        throw new Error(`Failed to propagate. ruleId: ${ruleId}`);
      }
    },
    {
      retries: 10,
      maxTimeout: 2000,
      onRetry: (err, attempt) =>
        logger.trace(
          { err, attempt, ruleId },
          `Waiting for rule propagation for ruleId: ${ruleId}. Attempt ${attempt}`
        ),
    }
  );
}

export async function deleteRuleById(
  ruleId: string,
  options?: StreamsDeleteOptions
): Promise<StreamsRule> {
  const withNetwork = ensureNetwork(options);

  const endpoint = `/api/v1/rules/${ruleId}`;
  const { data } = await callStreamsApi<StreamsRule>(endpoint, {
    ...options,
    ...withNetwork,
    method: "DELETE",
  });
  if (options?.waitForPropagation) {
    await waitForRulePropagation(ruleId, options, (r) => !r);
  }
  return data;
}

export async function upsertRule(
  rule: StreamsRuleUpdate,
  options?: StreamsUpsertOptions
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

  const { data } = await callStreamsApi<StreamsRule>(endpoint, {
    ...options,
    ...withNetwork,
    method,
    body: rule,
  });

  if (options?.waitForPropagation) {
    await waitForRulePropagation(
      data.ruleId,
      options,
      (r) => new Date(r?.updatedDt ?? 0) >= new Date(data.updatedDt)
    );
  }

  return data;
}

export async function createRule(
  rule: StreamsRuleUpdate,
  options?: CreateOptions
): Promise<StreamsRule> {
  const withNetwork = ensureNetwork(options);

  const { data } = await callStreamsApi<StreamsRule>("/api/v1/rules", {
    ...options,
    ...withNetwork,
    method: "POST",
    body: rule,
  });

  if (options?.waitForPropagation) {
    await waitForRulePropagation(data.ruleId, options, (r) => Boolean(r));
  }
  return data;
}

// DEPRECATED
/**
 * @deprecated use queryRules
 * @param options
 * @returns an array of rules
 */
export async function getRules(options?: StreamsOptions): Promise<StreamsRule[]> {
  const { rules } = await queryRules(options);
  return rules;
}
