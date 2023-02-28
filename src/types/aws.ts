// This file exists to avoid making the entire awssdk a dependency of this library
// just for credentials

/**
 * An object containing AWS credentials (used to sign IAM-authenticated requests).
 */
export type AwsCredentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
};
