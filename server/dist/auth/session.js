"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SESSION_TTL_SECONDS = exports.SESSION_COOKIE_NAME = void 0;
exports.createSessionCookieValue = createSessionCookieValue;
exports.verifySessionCookieValue = verifySessionCookieValue;
exports.verifySessionCookieValueWithRole = verifySessionCookieValueWithRole;
exports.parseCookieHeader = parseCookieHeader;
exports.buildSessionSetCookieHeader = buildSessionSetCookieHeader;
exports.buildSessionClearCookieHeader = buildSessionClearCookieHeader;
const crypto_1 = __importDefault(require("crypto"));
exports.SESSION_COOKIE_NAME = "codex_session";
exports.DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const VERSION_V1 = "v1";
const VERSION_V2 = "v2";
function createSessionCookieValue(session, secret, nowMs = Date.now(), ttlSeconds = exports.DEFAULT_SESSION_TTL_SECONDS) {
    const nowSec = Math.floor(nowMs / 1000);
    const inferredRole = session.role ?? (session.username === "admin" ? "admin" : "member");
    const payload = { u: session.username, r: inferredRole, exp: nowSec + ttlSeconds };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signedPart = `${VERSION_V2}.${payloadB64}`;
    const sig = sign(signedPart, secret);
    return `${signedPart}.${sig}`;
}
// 兼容历史 API：只返回用户名（旧测试与旧代码依赖该行为）。
function verifySessionCookieValue(value, secret, nowMs = Date.now()) {
    const detailed = verifySessionCookieValueWithRole(value, secret, nowMs);
    return detailed ? { username: detailed.username } : null;
}
// 返回更完整的 session 信息（包含 role），供鉴权/权限控制使用。
function verifySessionCookieValueWithRole(value, secret, nowMs = Date.now()) {
    const parts = value.split(".");
    if (parts.length !== 3)
        return null;
    const [ver, payloadB64, sigB64] = parts;
    if (ver !== VERSION_V1 && ver !== VERSION_V2)
        return null;
    const signedPart = `${ver}.${payloadB64}`;
    const expected = sign(signedPart, secret);
    if (!timingSafeEqualB64url(expected, sigB64))
        return null;
    let payload;
    try {
        const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
        payload = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (!payload || typeof payload.u !== "string" || typeof payload.exp !== "number")
        return null;
    const nowSec = Math.floor(nowMs / 1000);
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSec)
        return null;
    if (ver === VERSION_V1) {
        return { username: payload.u, role: payload.u === "admin" ? "admin" : "member" };
    }
    const role = payload.r;
    if (role !== "admin" && role !== "member")
        return null;
    return { username: payload.u, role };
}
function parseCookieHeader(header) {
    if (!header)
        return {};
    const out = {};
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx === -1)
            continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (!key)
            continue;
        try {
            out[key] = decodeURIComponent(val);
        }
        catch {
            // 容错：畸形 percent-encoding 不应导致请求/握手直接抛错（DoS 风险）。
            // 这里保留原始值即可，后续 session 校验会失败并返回 401/1008。
            out[key] = val;
        }
    }
    return out;
}
function buildSessionSetCookieHeader(value, opts) {
    const segs = [
        `${exports.SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`,
    ];
    if (opts.secure)
        segs.push("Secure");
    return segs.join("; ");
}
function buildSessionClearCookieHeader(opts) {
    const segs = [
        `${exports.SESSION_COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
    ];
    if (opts.secure)
        segs.push("Secure");
    return segs.join("; ");
}
function sign(input, secret) {
    return crypto_1.default.createHmac("sha256", secret).update(input, "utf8").digest("base64url");
}
function timingSafeEqualB64url(a, b) {
    try {
        const ab = Buffer.from(a, "base64url");
        const bb = Buffer.from(b, "base64url");
        if (ab.length !== bb.length)
            return false;
        return crypto_1.default.timingSafeEqual(ab, bb);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=session.js.map