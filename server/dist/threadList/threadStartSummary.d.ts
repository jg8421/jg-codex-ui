import type { UpsertThreadSummaryInput } from "./threadListTypes";
/**
 * 从 `codex.startThread()` 返回值中提取线程摘要，供 SQLite 会话列表持久化复用。
 */
export declare function buildThreadStartSummary(input: {
    thread: unknown;
    fallbackThreadId?: string;
    fallbackCwd?: string;
    fallbackModelProvider?: string;
}): UpsertThreadSummaryInput | null;
