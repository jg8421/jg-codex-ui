"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeThreadListCursor = encodeThreadListCursor;
exports.decodeThreadListCursor = decodeThreadListCursor;
/**
 * 把普通 base64 转换为 base64url（无 `+` `/`，末尾无 `=`）。
 */
function toBase64Url(base64) {
    return String(base64 ?? "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
/**
 * 把 base64url 转回普通 base64（补齐 padding）。
 */
function fromBase64Url(base64Url) {
    const normalized = String(base64Url ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padLen = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
    return normalized + "=".repeat(padLen);
}
/**
 * 规范化游标字段，避免非法值进入编码结果。
 */
function normalizeThreadListCursor(input) {
    const normalizedUpdatedAt = Number.isFinite(input.updatedAt) ? Math.max(0, Math.floor(Number(input.updatedAt))) : 0;
    const normalizedCreatedAt = Number.isFinite(input.createdAt) ? Math.max(0, Math.floor(Number(input.createdAt))) : 0;
    const normalizedId = String(input.id ?? "").trim();
    if (!normalizedId)
        throw new Error("cursor id is required");
    return { updatedAt: normalizedUpdatedAt, createdAt: normalizedCreatedAt, id: normalizedId };
}
/**
 * 将游标编码为可放入 URL query 的字符串（base64url(JSON)）。
 */
function encodeThreadListCursor(cursor) {
    const normalizedCursor = normalizeThreadListCursor(cursor);
    const payloadJson = JSON.stringify(normalizedCursor);
    const base64 = Buffer.from(payloadJson, "utf8").toString("base64");
    return toBase64Url(base64);
}
/**
 * 从字符串解码游标；非法输入返回 null（而不是抛异常）。
 */
function decodeThreadListCursor(encoded) {
    const raw = String(encoded ?? "").trim();
    if (!raw)
        return null;
    try {
        const base64 = fromBase64Url(raw);
        const json = Buffer.from(base64, "base64").toString("utf8");
        const parsed = JSON.parse(json);
        const candidate = {
            updatedAt: Number(parsed?.updatedAt ?? 0),
            createdAt: Number(parsed?.createdAt ?? 0),
            id: String(parsed?.id ?? ""),
        };
        return normalizeThreadListCursor(candidate);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=threadListCursor.js.map