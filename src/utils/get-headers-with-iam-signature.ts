import { parse as parseUrl } from "url";

import { sign } from "aws4";

import { AwsCredentials } from "../types/aws";
import { SignableRequest } from "../types";

/**
 * Get the request headers required to IAM-sign an HTTP request using a AWS v4 signatures.
 * Because the data being signed, might include additional HTTP headers,
 * both the original headers in the request and the AWS v4 signature headers are returned
 * @param url The url where the request will go
 * @param requestOptions Fetch options for the request (using the signature of node-fetch options)
 * @param region The AWS region of the resource that holds the URL. Defaults to environment
 * variables with final fallback to us-east-1
 * @param service The name of the AWS service being used. Defaults to 'execute-api' for API Gateway calls
 */
export function getHeadersWithIamSignature(
  credentials: AwsCredentials,
  url: string,
  requestOptions: SignableRequest,
  region?: string,
  service = "execute-api"
): Record<string, string> {
  const { hostname, path } = parseUrl(url);
  if (!hostname) {
    throw new Error(`Hostname could not be parsed for url ${url}`);
  }
  if (!path) {
    throw new Error(`Path could not be parsed for url ${url}`);
  }
  const signed = sign(
    {
      method: requestOptions.method ?? "GET",
      host: hostname,
      path,
      service,
      headers: requestOptions.headers,
      body: requestOptions.body,
      region: region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
    },
    credentials
  );
  // The aws4 library returns a headers object that is a bunch of key/value string pairs,
  // but typed in such a way that it's not portable with things like node-fetch.
  // Perform an explicit 'as' call here to make this play nicely with node-fetch, axios, etc.
  return signed.headers as Record<string, string>;
}
