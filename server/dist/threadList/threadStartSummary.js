"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildThreadStartSummary = buildThreadStartSummary;
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
/**
 * 从 `codex.startThread()` 返回值中提取线程摘要，供 SQLite 会话列表持久化复用。
 */
function buildThreadStartSummary(input) {
    // 原始线程对象：保持 unknown 输入，避免调用方把协议细节泄漏到 app 层。
    const threadRecord = input.thread && typeof input.thread === "object" ? input.thread : null;
    // 线程 id：优先使用返回对象里的 id，缺失时回退到上层已解析结果。
    const threadId = String(threadRecord?.id ?? input.fallbackThreadId ?? "").trim();
    if (!threadId)
        return null;
    // createdAt：保留 codex 原始单位，只做有限数值归一化。
    const createdAtValue = Number(threadRecord?.createdAt ?? 0);
    const createdAt = Number.isFinite(createdAtValue) ? Math.max(0, Math.floor(createdAtValue)) : 0;
    // updatedAt：缺失时回退到 createdAt，保证 SQLite 排序字段稳定。
    const updatedAtValue = Number(threadRecord?.updatedAt ?? createdAt);
    const updatedAt = Number.isFinite(updatedAtValue) ? Math.max(0, Math.floor(updatedAtValue)) : createdAt;
    // preview：新建空线程通常可能没有首条消息，允许为空字符串。
    const preview = String(threadRecord?.preview ?? "");
    // cwd：优先使用 codex 返回值，缺失时回退到权限校验后的 canonical cwd，并剥离 Windows verbatim 前缀。
    const rawCwd = String(threadRecord?.cwd ?? input.fallbackCwd ?? "");
    const cwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(rawCwd);
    // modelProvider：优先使用结构化字段，缺失时再回退到调用参数或 thread.model。
    const modelProvider = String(threadRecord?.modelProvider ?? input.fallbackModelProvider ?? threadRecord?.model ?? "");
    return {
        id: threadId,
        preview,
        createdAt,
        updatedAt,
        cwd,
        modelProvider,
    };
}
//# sourceMappingURL=threadStartSummary.js.map