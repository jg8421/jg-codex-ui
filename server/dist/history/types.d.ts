/**
 * Web 历史链路工作模式：
 * - `off`: 关闭历史 DB 写入与读取。
 * - `shadow`: 写入 DB，但读取仍沿用旧链路。
 * - `primary`: 写入 DB，读取优先使用 DB。
 */
export type WebHistoryMode = "off" | "shadow" | "primary";
/**
 * Codex 通知事件结构。
 */
export type CodexEventPayload = {
    method: string;
    params: unknown;
};
/**
 * 历史写入服务的输入参数。
 */
export type RecordCodexEventInput = {
    threadId: string;
    method: string;
    params: unknown;
};
/**
 * 历史写入服务接口。
 */
export type HistoryIngestService = {
    recordCodexEvent: (input: RecordCodexEventInput) => Promise<void>;
    flushAndClose: () => Promise<void>;
};
