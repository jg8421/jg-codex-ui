"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_THREAD_LIST_PAGE_LIMIT = exports.DEFAULT_THREAD_LIST_PAGE_LIMIT = void 0;
exports.parseThreadListPageLimit = parseThreadListPageLimit;
exports.parseThreadListCursor = parseThreadListCursor;
exports.parseIncludeThreadIds = parseIncludeThreadIds;
const threadListCursor_1 = require("./threadListCursor");
/**
 * 线程列表分页默认条数。
 */
exports.DEFAULT_THREAD_LIST_PAGE_LIMIT = 30;
/**
 * 线程列表分页最大条数：保护服务端与 SQLite，避免一次拉取过多。
 */
exports.MAX_THREAD_LIST_PAGE_LIMIT = 200;
/**
 * 解析线程列表分页 limit 参数：
 * - 非法值回退默认
 * - 范围保护 1..MAX
 */
function parseThreadListPageLimit(rawLimit, fallbackLimit = exports.DEFAULT_THREAD_LIST_PAGE_LIMIT) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallbackLimit;
    return Math.min(exports.MAX_THREAD_LIST_PAGE_LIMIT, Math.max(1, Math.floor(parsed)));
}
/**
 * 解析线程列表分页 cursor 参数：
 * - 空值返回 null（表示第一页）
 * - 非法值返回 "invalid"（供上层返回 400）
 */
function parseThreadListCursor(rawCursor) {
    const normalized = typeof rawCursor === "string" ? rawCursor.trim() : "";
    if (!normalized)
        return null;
    const decoded = (0, threadListCursor_1.decodeThreadListCursor)(normalized);
    return decoded ? decoded : "invalid";
}
/**
 * 解析 includeThreadIds：
 * - 支持逗号分隔字符串
 * - 去重且保序
 * - 限制最大数量，避免 URL 过长或滥用
 */
function parseIncludeThreadIds(raw, maxCount = 200) {
    const rawText = typeof raw === "string" ? raw.trim() : "";
    if (!rawText)
        return [];
    const seen = new Set();
    const out = [];
    for (const piece of rawText.split(",")) {
        const id = String(piece ?? "").trim();
        if (!id)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        out.push(id);
        if (out.length >= maxCount)
            break;
    }
    return out;
}
//# sourceMappingURL=threadListHttpQuery.js.map