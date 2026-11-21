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

export type Customer = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  services_count: number;
  created_at: string;
};

export const SERVICE_TYPES = [
  "cloud_server",
  "vps",
  "dedicated_server",
  "object_storage",
  "managed_database",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_STATUSES = ["active", "suspended"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type StatusChangeSource = "api" | "php_module" | "admin";

export type Service = {
  id: number;
  customer_id: number;
  name: string;
  service_type: ServiceType;
  service_type_display: string;
  status: ServiceStatus;
  created_at: string;
  updated_at: string;
};

export type StatusLog = {
  id: number;
  from_status: ServiceStatus;
  to_status: ServiceStatus;
  changed_by_id: number | null;
  source: StatusChangeSource;
  reason: string;
  created_at: string;
};
