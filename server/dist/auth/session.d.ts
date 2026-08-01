import type { UserRole } from "./userTypes";
export declare const SESSION_COOKIE_NAME = "codex_session";
export declare const DEFAULT_SESSION_TTL_SECONDS: number;
type SessionInfo = {
    username: string;
};
export type SessionInfoWithRole = {
    username: string;
    role: UserRole;
};
export declare function createSessionCookieValue(session: SessionInfo & {
    role?: UserRole;
}, secret: string, nowMs?: number, ttlSeconds?: number): string;
export declare function verifySessionCookieValue(value: string, secret: string, nowMs?: number): SessionInfo | null;
export declare function verifySessionCookieValueWithRole(value: string, secret: string, nowMs?: number): SessionInfoWithRole | null;
export declare function parseCookieHeader(header: string | undefined): Record<string, string>;
export declare function buildSessionSetCookieHeader(value: string, opts: {
    maxAgeSeconds: number;
    secure: boolean;
}): string;
export declare function buildSessionClearCookieHeader(opts: {
    secure: boolean;
}): string;
export {};
