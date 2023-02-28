import fetch from "node-fetch";
import retry from "async-retry";

import { libraryVersion } from "./config";
import {
  ensureAccessToken,
  ensureEnvironment,
  ensureNetwork,
  shouldBailRetry,
  timeElapsed,
} from "./client-helpers";
import { track } from "./track";
import { baseLogger } from "./utils/logger";
import { getMultichainMetricsUrl } from "./urls";
import { getErrorMessageParser } from "./get-error-message-parser";
import { ApiCallOptions, AssembledMetricAlarm, MetricAlarm, StandardApiResult } from "./types";

const logger = baseLogger.child({ client: "multichain-metrics" });
const trackedEventName = "Multichain Metrics Call";

type CallWithAlarmIdOptions = ApiCallOptions & {
  alarmId: string;
};

type CallMultichainApiOptions = ApiCallOptions | CallWithAlarmIdOptions;

function isCallWithAlarmIdOptions(
  options: CallMultichainApiOptions
): options is CallWithAlarmIdOptions {
  const putAlarmDiscriminator: keyof CallWithAlarmIdOptions = "alarmId";
  return putAlarmDiscriminator in options;
}

export async function callMultichainApi<TResponse = unknown>(
  endpoint: string,
  options: CallMultichainApiOptions
): Promise<StandardApiResult<TResponse>> {
  const startAt = Date.now();
  const { network } = ensureNetwork(options);
  const { accessToken } = ensureAccessToken(network, options);
  const environment = ensureEnvironment(options);

  const baseUrl = getMultichainMetricsUrl(environment, network);
  const url = `${baseUrl}${endpoint}`;
  const contextualLogger = logger.child({ network, environment, url });
  const parsedUrl = new URL(url);
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryParams = Object.fromEntries(searchParams.entries());
  try {
    return await retry(
      async (bail, attempts) => {
        const resp = await fetch(url, {
          method: options.method ?? "GET",
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
        contextualLogger.debug({ responseStatus: resp.status }, "Multichain metrics response");

        if (resp.status >= 400) {
          const errorMessage = await getErrorMessageParser(contextualLogger).parse(resp);
          contextualLogger.trace(
            {
              method: options.method,
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
            networkStack: network,
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
        contextualLogger.trace(
          {
            method: options.method,
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
          networkStack: network,
          attempts,
          httpStatus: resp.status,
        });
        return responseBody as StandardApiResult<TResponse>;
      },
      { retries: 4 }
    );
  } catch (err) {
    contextualLogger.error(err, "Failed calling the Multichain Metrics API");
    throw err;
  }
}

/**
 * Get all alarms for the calling user
 * @param options The options to use when fetching the alarms
 * @returns All alarms for the requesting user
 */
export async function getAlarms(
  options: CallMultichainApiOptions = {}
): Promise<AssembledMetricAlarm[]> {
  const { data: metricAlarms } = await callMultichainApi<AssembledMetricAlarm[]>("/api/v1/alarms", {
    ...options,
    method: "GET",
  });
  return metricAlarms;
}

/**
 * Get an unassembled alarm for the calling user
 * @param options The options to use when fetching the alarm
 * @returns All unassembled alarm
 */
export async function getUnassembledAlarm(options: CallWithAlarmIdOptions): Promise<MetricAlarm> {
  const { data: alarm } = await callMultichainApi<MetricAlarm>(
    `/api/v1/alarms/${options.alarmId}`,
    { ...options, method: "GET" }
  );
  return alarm;
}

/**
 * Upsert a metric alarm
 * @param options The upsert options to use. Ensure the alarmId is set if you wish to update
 * an existing alarm. Otherwise a new alarm will be created
 * @returns The upserted alarm
 */
export async function upsertAlarm(
  options: CallMultichainApiOptions
): Promise<AssembledMetricAlarm> {
  const [endpoint, method] = isCallWithAlarmIdOptions(options)
    ? [`/api/v1/alarms/${options.alarmId}`, "PUT"]
    : [`/api/v1/alarms`, "POST"];
  const { data: metricAlarm } = await callMultichainApi<AssembledMetricAlarm>(endpoint, {
    ...options,
    method,
  });
  return metricAlarm;
}

/**
 * Delete a metric alarm
 * @param options The delete options to use
 */
export async function deleteAlarm(options: CallWithAlarmIdOptions): Promise<void> {
  const endpoint = `/api/v1/alarms/${options.alarmId}`;
  await callMultichainApi<MetricAlarm>(endpoint, {
    ...options,
    method: "DELETE",
  });
}
