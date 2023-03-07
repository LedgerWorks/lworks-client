import { RulesLogic, AdditionalOperation } from "json-logic-js";

import { Chain } from "../chain";

export type LeafOperator = RulesLogic<AdditionalOperation>;
export type BranchOperator = Record<string, RulesLogic<AdditionalOperation>>;
export type Operator = LeafOperator | BranchOperator;

export enum NotifyOn {
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

export type MetricAlarmDefinition = {
  startTime: string;
  endTime: string;
  interval: string;
  data: Record<string, Operator>;
  datapoint: Operator;
  evaluation: Operator;
  context: Operator;
  notification?: AlarmNotification;
  unit?: string;
};

/** The app model for a potentially-partial metric alarm */
export type MetricAlarm = {
  alarmId: string;
  sort: string;
  owner: string;
  name: string;
  entity?: string;
  chain?: Chain;
  definition?: Partial<MetricAlarmDefinition>;
  description?: string;
  disabled?: boolean;
  timeToLive?: number;
  tags?: Record<string, string>;
  extendedAlarmId?: string;
  createdDate: Date;
  updatedDate: Date;
  deletedDate?: Date;
};

/**
 * The app model for an alarm that has been fully assembled by combining
 * the alarm's properties with any inherited properties from the 'extendedAlarmId'
 */
export type AssembledMetricAlarm = Omit<MetricAlarm, "entity" | "chain" | "definition"> & {
  entity: string;
  chain: Chain;
  definition: MetricAlarmDefinition;
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
