import { RulesLogic, AdditionalOperation } from "json-logic-js";

import { AccessTokenApiCallOptions, IamApiCallOptions } from "../../types";
import { Chain } from "../../chain";

// Model types
export type LeafOperator = RulesLogic<AdditionalOperation>;
export type BranchOperator = Record<string, RulesLogic<AdditionalOperation>>;
export type Operator = LeafOperator | BranchOperator;

export enum NotifyOn {
  Never = "never",
  Always = "always",
  AlarmBreached = "alarmBreached",
  InAlarm = "inAlarm",
}

export type AlarmNotification = {
  notifyOn?: NotifyOn;
  actionWebhookUrl?: string;
  actionWebhookCustomHeaders?: Record<string, string>;
  batchOptions?: {
    enabled: boolean;
    maxBatchSize: number;
  };
};

export type OverrideValue = string | number;

/**
 * The alarm definition that results from assembling an alarm with any
 * extended alarm & defaulted definition fields
 */
type AssembledMetricAlarmDefinition = {
  startTime?: string;
  endTime?: string;
  interval?: string;
  variables: Record<string, OverrideValue>;
  data: Record<string, Operator>;
  datapoint?: Operator;
  evaluation?: Operator;
  context: Operator;
  notification?: AlarmNotification;
  threshold?: number | string;
  unit?: string;
};

export type OverrideDefinition = {
  label: string;
  description?: string;
  type: string;
  multiline?: boolean;
  onSaveTransformation?: Operator;
  onReadTransformation?: Operator;
  fieldToOverride: string;
  required: boolean;
  sortOrder?: number;
};

export type OverrideDefinitions = Record<string, OverrideDefinition>;

/** Allows representing both an actual override value and the transformed
 * version of the value using the onReadTransform function. If no
 * onReadTransform supplied, both values will be the same
 */
export type AssembledOverrideValue = {
  raw: OverrideValue;
  transformed: OverrideValue;
};

export type AssembledOverrideDefinition = Omit<OverrideDefinition, "multiline" | "sortOrder"> & {
  multiline: boolean;
  // Sort order dictates where overrides show up in forms; lower numbers show up before higher ones
  sortOrder: number;
  defaultValue?: AssembledOverrideValue;
  currentValue?: AssembledOverrideValue;
};

export type AssembledOverrideDefinitions = Record<string, AssembledOverrideDefinition>;

type BaseMetricAlarm = {
  alarmId: string;
  sort: string;
  owner: string;
  name?: string;
  entity?: string;
  chain?: Chain;
  definition?: Partial<AssembledMetricAlarmDefinition>;
  description?: string;
  disabled?: boolean;
  timeToLive?: number;
  tags?: Record<string, string>;
  extendedAlarmId?: string;
  overrideDefinitions?: OverrideDefinitions;
};

/** The database model for a potentially-partial metric alarm */
export type MetricAlarmDbModel = BaseMetricAlarm & {
  createdDate: string;
  updatedDate?: string; // Defaults to created date in app model
  deletedDate?: string;
};

/** The app model for a potentially-partial metric alarm */
export type MetricAlarm = BaseMetricAlarm & {
  createdDate: Date;
  updatedDate: Date;
  deletedDate?: Date;
};

/**
 * The app model for an alarm that has been fully assembled by combining
 * the alarm's properties with any inherited properties from the 'extendedAlarmId'
 * and default alarm values
 */
export type AssembledMetricAlarm = Omit<
  MetricAlarm,
  "name" | "definition" | "overrideDefinitions" | "tags"
> & {
  name: string;
  definition: AssembledMetricAlarmDefinition;
  overrideDefinitions: AssembledOverrideDefinitions;
  tags: Record<string, string>;
};

/**
 * An alarm definition that can be saved to our database
 */
export type EvaluatableAlarmDefinition = Omit<
  AssembledMetricAlarmDefinition,
  "interval" | "datapoint" | "evaluation" | "startTime" | "endTime"
> & {
  interval: string;
  datapoint: Operator;
  evaluation: Operator;
  startTime: string;
  endTime: string;
};

/**
 * The app model for an alarm that has enough information to be evaluated
 * when triggered
 */
export type EvaluatableMetricAlarm = Omit<
  AssembledMetricAlarm,
  "entity" | "chain" | "definition"
> & {
  entity: string;
  chain: Chain;
  definition: EvaluatableAlarmDefinition;
};

export enum AlarmState {
  OK = "ok",
  Alarm = "alarm",
  InsufficientData = "insufficientData",
}

export type AlarmHistoryContextValue =
  | string
  | Date
  | number
  | { [key: string]: AlarmHistoryContextValue }
  | AlarmHistoryContextValue[];

export type AlarmHistoryItem = {
  id: string;
  alarmId: string;
  datapointTime: Date;
  evaluationTime: Date;
  entity: string;
  transactionHash?: string;
  chain: Chain;
  alarmState: AlarmState;
  context: Record<string, AlarmHistoryContextValue>;
  owner: string;
  val: number | string;
};

export type DisableOwnerAlarmsResponseData = {
  disabledAlarmIds: string[];
};

export type DeleteOwnerAlarmsResponseData = {
  deletedAlarmIds: string[];
};

// Request types
type NonSettableAlarmFields =
  | "alarmId"
  | "sort"
  | "owner"
  | "createdDate"
  | "updatedDate"
  | "deletedDate";

/**
 * This type represents an alarm containing the minimum fields that can be provided
 * to save an alarm via the alarms API
 */
export type ApiSavableAlarm = Omit<MetricAlarm, NonSettableAlarmFields>;

export type CallWithAlarmIdOptions = {
  alarmId: string;
};

export type OwnerCallWithAlarmIdOptions = AccessTokenApiCallOptions & {
  alarmId: string;
};

export type AdminCallWithOwner = IamApiCallOptions & {
  owner: string;
};

export type SaveAlarmRequest = {
  body: ApiSavableAlarm;
};

export type OwnerCallSaveAlarmRequest = AccessTokenApiCallOptions & SaveAlarmRequest;
export type AdminSaveAlarmRequest = AdminCallWithOwner &
  SaveAlarmRequest & {
    alarmId?: string;
  };

export type OwnerCallMultichainApiOptions =
  | AccessTokenApiCallOptions
  | OwnerCallWithAlarmIdOptions
  | OwnerCallSaveAlarmRequest;
export type AdminCallMultichainOptions =
  | IamApiCallOptions
  | AdminCallWithOwner
  | AdminSaveAlarmRequest;

type BaseCallOptions = {
  bailRetryStatuses?: number[];
};

export type MultichainApiOptions =
  | (OwnerCallMultichainApiOptions & BaseCallOptions)
  | (AdminCallMultichainOptions & BaseCallOptions);
