"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLoopbackAddress = isLoopbackAddress;
exports.isAllowedOrigin = isAllowedOrigin;
function isLoopbackAddress(address) {
    if (!address)
        return false;
    if (address === "127.0.0.1" || address === "::1")
        return true;
    if (address.startsWith("::ffff:127."))
        return true;
    return false;
}
function normalizeOriginHeader(origin) {
    const raw = String(origin ?? "").trim();
    if (!raw)
        return null;
    if (raw.toLowerCase() === "null")
        return null;
    try {
        return new URL(raw).origin;
    }
    catch {
        return null;
    }
}
/**
 * 判断请求 Origin 是否允许。
 * - strict=false：不做限制；
 * - strict=true：若存在 Origin，则必须命中 allowlist；Origin 为空时放行（兼容非浏览器客户端）。
 */
function isAllowedOrigin(origin, policy) {
    if (!policy.strict)
        return true;
    const normalized = normalizeOriginHeader(origin);
    if (!normalized)
        return true;
    return policy.allowedOrigins.includes(normalized);
}
//# sourceMappingURL=origin.js.map