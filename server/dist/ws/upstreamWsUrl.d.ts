import type { Socket } from "socket.io";
type BuildScopedUpstreamWsUrlInput = {
    socket: Socket;
    rawWsPath: string;
    host: string;
    port: number;
};
/**
 * 从 Socket.IO handshake auth 中读取 `scope`，并把它透传到上游 `/ws?scope=...`。
 *
 * 兼容性：
 * - scope 缺失时不带 query（等价于上游默认 scope=all）。
 */
export declare function buildScopedUpstreamWsUrl(input: BuildScopedUpstreamWsUrlInput): string;
export {};
