import { Chain, LegacyChainStrings } from "../../chain";

export enum StreamsRuleType {
  HCSMessagesByTopicId = 0,
  TokenMintsByTokenId = 1,
  TokenBurnsByTokenId = 2,
  TokenTransfersByTokenId = 3,
  ContractCallsByContractId = 4,
  SourceAccountBasedSecurityRule = 5,
  AccountActivityByAccount = 6,
  MetricAlarmsByOwner = 7,
}

export type StreamsRuleBatchOptions = {
  enabled: boolean;
  maxBatchSize: number;
};

export type StreamsRule = {
  ruleId: string;
  organizationId: string;
  userId: string;
  chain: Chain | LegacyChainStrings;
  ruleType: StreamsRuleType;
  predicateValue: string;
  ruleName?: string;
  actionWebhookUrl?: string;
  actionWebhookCustomHeaders?: Record<string, string>;
  actionStreamTopic?: string;
  actionWebSocketId?: string;
  batchOptions?: StreamsRuleBatchOptions;
  disabled?: boolean;
  createdDt: string;
  updatedDt: string;
};

export type NotifiableQueueItem = {
  ruleId: string;
  eventId: string;
  forceRetry?: boolean;
};

export type NotifiableItem = {
  ruleId: string;
  payload: string;
  eventId: string;
};

export enum NotifiableItemDestinationType {
  Webhook,
  Websocket,
  KafkaTopic,
}

export enum StreamEventStatus {
  Success,
  Failure,
  Pending,
  Skipped,
  Timeout,
  GaveUp,
  Batching,
}

export type NotificationEventMetadata = {
  ruleId: string;
  eventId: string;
  status: StreamEventStatus;
  eventNumber: number;
  totalAttempts?: number;
  dateTime: string;
  consensusDateTime?: string;
  streamsDateTime?: string;
  destination?: string;
  destinationType?: NotifiableItemDestinationType;
  errorMessage?: string;
  timeToLive?: number;
  description?: string;
  batchSize?: number;
  batchSpanSeconds?: number;
};

export type NotificationEventRecord = NotificationEventMetadata & {
  payload: Buffer;
  payloadCompression: string | "gzip";
};

export type NotificationEventAuditRecord = {
  ruleId: string;
  eventId: string;
  status: StreamEventStatus;
  eventNumber: number;
  parentEventId: string;
  auditDateTime: string;
  destination?: string;
  destinationType?: NotifiableItemDestinationType;
  errorMessage?: string;
  timeToLive?: number;
};

export type StreamRulesQueryResult = {
  rules: StreamsRule[];
  next?: string;
};

type StreamsRuleUpdateFields =
  | "ruleName"
  | "ruleType"
  | "chain"
  | "predicateValue"
  | "batchOptions"
  | "actionWebhookUrl"
  | "actionWebhookCustomHeaders"
  | "disabled";

export type StreamsRuleUpdate = Pick<StreamsRule, StreamsRuleUpdateFields>;

/**
 * @deprecated
 */
export type PaginatedRuleResponse = {
  rules: StreamsRule[];
  nextToken?: string;
};
