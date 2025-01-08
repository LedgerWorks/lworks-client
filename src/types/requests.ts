export type SignableRequest = Omit<RequestInit, "headers"> & {
  headers?: { [key: string]: string };
  body?: string;
};
