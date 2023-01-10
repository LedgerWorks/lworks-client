import type { operations, components, paths } from "./generated/openapi-schema";

export type TransactionsResponse = components["schemas"]["TransactionsResponse"];

export type HCSTopicMessagesResponse = components["schemas"]["TopicMessagesResponse"];
export type HCSTopicMessage = components["schemas"]["TopicMessage"];

export { operations, components, paths };

/**
 * Holds all Mirror Response schemas. Helper for accessing operations["schemas"].
 */
export type Schemas = components["schemas"];
