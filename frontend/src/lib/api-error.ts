/** A non-2xx response in the shared envelope (plan §3.4), or a network failure. */
export type FieldErrors = Record<string, { code: string; message: string }[]>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldErrors = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: unknown; message?: unknown; details?: unknown; request_id?: unknown };
    } | null;
    const e = body?.error;
    return new ApiError(
      response.status,
      typeof e?.code === "string" ? e.code : response.status >= 500 ? "internal_error" : "unknown_error",
      typeof e?.message === "string" ? e.message : response.statusText || "Request failed.",
      isFieldErrors(e?.details) ? e.details : {},
      typeof e?.request_id === "string" ? e.request_id : response.headers.get("x-request-id"),
    );
  }

  static network(cause: unknown): ApiError {
    return new ApiError(0, "network_error", cause instanceof Error ? cause.message : "Network error.");
  }
}

function isFieldErrors(value: unknown): value is FieldErrors {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(
      (list) =>
        Array.isArray(list) &&
        list.every((item) => typeof item?.code === "string" && typeof item?.message === "string"),
    )
  );
}
