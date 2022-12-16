import type { operations, components, paths } from "src/generated/openapi-schema";

export type TransactionsResponse = components["schemas"]["TransactionsResponse"];

export type HCSTopicMessagesResponse = components["schemas"]["TopicMessagesResponse"];
export type HCSTopicMessage = components["schemas"]["TopicMessage"];

export type Schema = {
  operations: operations;
  components: components;
  paths: paths;
};
