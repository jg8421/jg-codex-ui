"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeThreadForClient = sanitizeThreadForClient;
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
/**
 * 仅用于“对外返回给前端的 thread payload”净化：剥离 Windows `\\?\` 前缀。
 *
 * 说明：
 * - 该函数是 best-effort：只处理 `cwd` 字段，不做深拷贝/深层 normalize；
 * - 主要用于兼容历史线程中已持久化的 `\\?\C:\...`，避免继续污染 UI 展示。
 */
function sanitizeThreadForClient(thread) {
    // thread 原始值（允许是 null/非对象）。
    const rawThread = thread;
    if (!rawThread || typeof rawThread !== "object")
        return thread;
    // thread.cwd 原始值（仅处理 string）。
    const rawCwd = typeof rawThread.cwd === "string" ? String(rawThread.cwd) : "";
    if (!rawCwd)
        return thread;
    // 去除 verbatim 前缀后的 cwd。
    const sanitizedCwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(rawCwd);
    if (sanitizedCwd === rawCwd)
        return thread;
    return { ...rawThread, cwd: sanitizedCwd };
}
//# sourceMappingURL=threadSanitize.js.map