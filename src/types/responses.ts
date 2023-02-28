export type ResponseStatus = "success" | "error";

export type StandardApiResult<TResponse> = { data: TResponse; status: ResponseStatus };
