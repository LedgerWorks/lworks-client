import { Environment } from "../environment";
import { Network } from "../networks";

export type ApiCallOptions = {
  network?: Network;
  environment?: Environment;
  accessToken?: string;
  method?: string;
  body?: unknown;
};
