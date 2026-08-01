import type { UpsertMessageInput } from "../sqlite/sqliteHistoryStore";
/**
 * 可投影的 Codex 事件结构。
 */
export type ProjectableCodexEvent = {
    method: string;
    params: unknown;
};
/**
 * 投影输入参数。
 */
export type ProjectCodexEventInput = {
    threadId: string;
    event: ProjectableCodexEvent;
    nowMs: number;
};
/**
 * 投影输出：可选消息更新（已移除 chunk/raw 存储）。
 */
export type ProjectCodexEventOutput = {
    message?: UpsertMessageInput;
    messages?: UpsertMessageInput[];
};
/**
 * 将 Codex 事件投影为结构化消息与增量片段。
 */
export declare function projectCodexEvent(input: ProjectCodexEventInput): ProjectCodexEventOutput;
