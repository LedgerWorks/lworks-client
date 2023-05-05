import { Chain } from "../chain";
import { LWorksEnvironment } from "../environment";
import { Network } from "../networks";

import { AwsCredentials } from "./aws";

export type BaseApiCallOptions = {
  network?: Network;
  environment?: LWorksEnvironment;
  headers?: Record<string, string>;
  method?: string;
  body?: unknown;
  chain?: Chain;
};

export type AccessTokenApiCallOptions = BaseApiCallOptions & {
  accessToken?: string;
};

export type IamApiCallOptions = BaseApiCallOptions & {
  credentials: AwsCredentials;
};

export enum AuthenticationType {
  accessToken = "accessToken",
  iam = "iam",
}
