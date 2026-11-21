// Types for the Django API contract (plan §3.4).
export type Role = "staff" | "customer";

export type Me = { id: number; email: string; role: Role; customer_id: number | null };

export type Page<T> = { count: number; page: number; page_size: number; total_pages: number; results: T[] };

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, { code: string; message: string }[]>;
    request_id: string | null;
  };
};
