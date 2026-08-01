import type { ChatItem } from "./types";
/**
 * 将 thread payload 中的 turns 转换为 ChatItem[]（用于 thread_opened 快照）。
 */
export declare function projectThreadToChatItems(thread: unknown): ChatItem[];
/**
 * 将 thread turns slice 转换为 ChatItem[]（用于翻页加载旧消息）。
 */
export declare function projectTurnsToChatItems(turns: unknown[], opts: {
    createdAtMs: number;
    turnsStart: number;
}): ChatItem[];
