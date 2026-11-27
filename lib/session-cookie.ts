/**
 * The demo sign-in cookie's name. Kept apart from lib/session.ts so proxy.ts
 * can read it without loading the database client.
 */
export const SESSION_COOKIE = "carebase_account";
