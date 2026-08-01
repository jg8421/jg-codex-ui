"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWsScopeFromRequest = parseWsScopeFromRequest;
/**
 * 从 `IncomingMessage.url` 解析 `scope` query 参数。
 *
 * 约定：
 * - `/ws?scope=global` -> `"global"`
 * - `/ws?scope=thread` -> `"thread"`
 * - 缺失/非法 -> `"all"`（兼容旧客户端）
 */
function parseWsScopeFromRequest(req) {
    const rawUrl = String(req.url ?? "");
    try {
        const url = new URL(rawUrl, "http://localhost");
        const scope = String(url.searchParams.get("scope") ?? "").trim().toLowerCase();
        if (scope === "global")
            return "global";
        if (scope === "thread")
            return "thread";
        if (scope === "all")
            return "all";
        return "all";
    }
    catch {
        return "all";
    }
}
//# sourceMappingURL=wsScope.js.map