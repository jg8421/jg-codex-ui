"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildScopedUpstreamWsUrl = buildScopedUpstreamWsUrl;
/**
 * 从 Socket.IO handshake auth 中读取 `scope`，并把它透传到上游 `/ws?scope=...`。
 *
 * 兼容性：
 * - scope 缺失时不带 query（等价于上游默认 scope=all）。
 */
function buildScopedUpstreamWsUrl(input) {
    const rawScope = typeof input.socket.handshake.auth?.scope === "string" ? String(input.socket.handshake.auth.scope) : "";
    const scope = rawScope.trim().toLowerCase();
    const url = new URL(input.rawWsPath, `ws://${input.host}:${input.port}`);
    if (scope)
        url.searchParams.set("scope", scope);
    return url.toString();
}
//# sourceMappingURL=upstreamWsUrl.js.map