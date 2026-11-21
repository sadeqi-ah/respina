const VALID = /^[A-Za-z0-9._-]{1,128}$/;

/** Same rule as Django, Go and PHP: accept a short, harmless caller ID or generate one. */
export function requestIdFrom(incoming: string | null | undefined): string {
  return incoming && VALID.test(incoming) ? incoming : crypto.randomUUID().replaceAll("-", "");
}
