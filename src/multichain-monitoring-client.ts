import { randomUUID } from "node:crypto";

import fetch from "node-fetch";
import retry from "async-retry";

import { libraryVersion } from "./config";
import {
  ensureAccessToken,
  ensureEnvironment,
  ensureNetwork,
  shouldBailRetry,
} from "./client-helpers";
import { baseLogger } from "./utils/logger";
import { getMultichainMetricsUrl } from "./urls";
import { getErrorMessageParser } from "./get-error-message-parser";
import {
  AccessTokenApiCallOptions,
  ApiSavableAlarm,
  AssembledMetricAlarm,
  DeleteOwnerAlarmsResponseData,
  DisableOwnerAlarmsResponseData,
  IamApiCallOptions,
  MetricAlarm,
  SignableRequest,
  StandardApiResult,
} from "./types";
import { getHeadersWithIamSignature } from "./utils/get-headers-with-iam-signature";
import { AwsCredentials } from "./types/aws";

const logger = baseLogger.child({ client: "multichain-metrics" });

type CallWithAlarmIdOptions = {
  alarmId: string;
};

type OwnerCallWithAlarmIdOptions = AccessTokenApiCallOptions & {
  alarmId: string;
};

type AdminCallWithOwner = IamApiCallOptions & {
  owner: string;
};

type SaveAlarmRequest = {
  body: ApiSavableAlarm;
};

type OwnerCallSaveAlarmRequest = AccessTokenApiCallOptions & SaveAlarmRequest;
type AdminSaveAlarmRequest = AdminCallWithOwner &
  SaveAlarmRequest & {
    alarmId?: string;
  };

type OwnerCallMultichainApiOptions =
  | AccessTokenApiCallOptions
  | OwnerCallWithAlarmIdOptions
  | OwnerCallSaveAlarmRequest;
type AdminCallMultichainOptions = IamApiCallOptions | AdminCallWithOwner | AdminSaveAlarmRequest;
type MultichainApiOptions = OwnerCallMultichainApiOptions | AdminCallMultichainOptions;

function isAdminCall(options: MultichainApiOptions): options is AdminCallMultichainOptions {
  const adminCallDiscriminator: keyof AdminCallMultichainOptions = "credentials";
  return adminCallDiscriminator in options;
}

function isCallWithAlarmIdOptions(
  options: MultichainApiOptions
): options is CallWithAlarmIdOptions {
  const alarmIdDiscriminator: keyof OwnerCallWithAlarmIdOptions = "alarmId";
  return alarmIdDiscriminator in options;
}

function authenticateAccessTokenRequest(request: SignableRequest, accessToken: string) {
  return {
    ...request,
    headers: { ...request.headers, Authorization: accessToken },
  };
}

function authenticateIamRequest(
  url: string,
  request: SignableRequest,
  credentials: AwsCredentials,
  region?: string
) {
  const signedHeaders = getHeadersWithIamSignature(credentials, url, request, region);
  return { ...request, headers: signedHeaders };
}

export async function callMultichainApi<TResponse = unknown>(
  endpoint: string,
  options: MultichainApiOptions
): Promise<StandardApiResult<TResponse>> {
  const { network } = ensureNetwork(options);
  const environment = ensureEnvironment(options);

  const baseUrl = getMultichainMetricsUrl(environment, network);
  const url = `${baseUrl}${endpoint}`;
  const contextualLogger = logger.child({ network, environment, url });
  try {
    const request = {
      method: options.method ?? "GET",
      headers: {
        "user-agent": `lworks-client/${libraryVersion}`,
        "content-type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    };
    const authenticatedRequest = isAdminCall(options)
      ? authenticateIamRequest(url, request, options.credentials)
      : authenticateAccessTokenRequest(request, ensureAccessToken(network, options).accessToken);
    return await retry(
      async (bail, attempts) => {
        const resp = await fetch(url, authenticatedRequest);
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
  options: OwnerCallMultichainApiOptions = {}
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
export async function getUnassembledAlarm(
  options: OwnerCallWithAlarmIdOptions
): Promise<MetricAlarm> {
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
  options: OwnerCallSaveAlarmRequest
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
export async function deleteAlarm(options: OwnerCallWithAlarmIdOptions): Promise<void> {
  const endpoint = `/api/v1/alarms/${options.alarmId}`;
  await callMultichainApi<MetricAlarm>(endpoint, {
    ...options,
    method: "DELETE",
  });
}

/**
 * Get an unassembled alarm for an owner. This is an admin call that requires
 * elevated permissions
 * @param options The options to use when fetching the alarm
 * @returns All unassembled alarms for the specified owner
 */
export async function adminGetUnassembledAlarmsForOwner(
  options: AdminCallWithOwner
): Promise<MetricAlarm[]> {
  const { data: alarms } = await callMultichainApi<MetricAlarm[]>(
    `/api/v1/admin/owners/${options.owner}/alarms`,
    { ...options, method: "GET" }
  );
  return alarms;
}

/**
 * Disable all alarms for an owner. This is an admin call that requires
 * elevated permissions
 * @param options The options to use when disabling the owner's alarms
 * @returns The alarm ids of all disabled alarms
 */
export async function adminDisableAlarmsForOwner(options: AdminCallWithOwner): Promise<string[]> {
  const { data } = await callMultichainApi<DisableOwnerAlarmsResponseData>(
    `/api/v1/admin/owners/${options.owner}/alarms/disable`,
    { ...options, method: "POST" }
  );
  return data.disabledAlarmIds;
}

/**
 * Delete all alarms for an owner. This is an admin call that requires
 * elevated permissions
 * @param options The options to use when deleting the owner's alarm
 * @returns The alarm ids of all deleted alarms
 */
export async function adminDeleteAlarmsForOwner(options: AdminCallWithOwner): Promise<string[]> {
  const { data } = await callMultichainApi<DeleteOwnerAlarmsResponseData>(
    `/api/v1/admin/owners/${options.owner}/alarms`,
    { ...options, method: "DELETE" }
  );
  return data.deletedAlarmIds;
}

/**
 * Delete all alarms for an owner. This is an admin call that requires
 * elevated permissions
 * @param options The options to use when deleting the owner's alarm
 * @returns The alarm ids of all deleted alarms
 */
export async function adminGetManagedAlarms(options: IamApiCallOptions): Promise<MetricAlarm[]> {
  const { data: alarms } = await callMultichainApi<MetricAlarm[]>(`/api/v1/admin/managed-alarms`, {
    ...options,
    method: "GET",
  });
  return alarms;
}

/**
 * Upsert a metric alarm as an admin on behalf of an owner. This is an admin call that requires
 * elevated permissions
 * @param options The upsert options to use. Ensure the alarmId is set if you wish to update
 * an existing alarm. Otherwise a new alarm will be created
 * @returns The upserted alarm
 */
export async function adminUpsertAlarm(
  options: AdminSaveAlarmRequest
): Promise<AssembledMetricAlarm> {
  const alarmId = isCallWithAlarmIdOptions(options) ? options.alarmId : randomUUID();
  const endpoint = `/api/v1/admin/owners/${options.owner}/alarms/${alarmId}`;
  const { data: metricAlarm } = await callMultichainApi<AssembledMetricAlarm>(endpoint, {
    ...options,
    method: "PUT",
  });
  return metricAlarm;
}
