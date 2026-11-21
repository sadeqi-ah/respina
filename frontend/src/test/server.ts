import { setupServer } from "msw/node";

/** One msw server for all component tests; each test adds its own handlers with server.use(). */
export const server = setupServer();

/** The BFF prefix the browser calls (lib/api-client.ts); msw matches any origin. */
export const api = (path: string) => `*/api/backend/${path}`;
