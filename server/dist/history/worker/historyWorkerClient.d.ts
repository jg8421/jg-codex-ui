import type { ChatItem, DiffData } from "../../chat/types";
import type { GetHistoryMessageDiffInput, ListHistoryMessagesInput } from "../query/historyQueryService";
import type { RecordCodexEventInput } from "../types";
export type HistoryWorkerClient = {
    recordEvent: (input: RecordCodexEventInput) => Promise<void>;
    listMessages: (input: ListHistoryMessagesInput) => Promise<ChatItem[]>;
    listThreadFileChanges: (threadId: string) => Promise<ChatItem[]>;
    getMessageDiff: (input: GetHistoryMessageDiffInput) => Promise<DiffData | null>;
    close: () => Promise<void>;
};
export type CreateHistoryWorkerClientOptions = {
    dbPath: string;
    /**
     * name：仅用于日志/调试定位 worker 实例（不影响逻辑）。
     */
    name: string;
};
/**
 * 创建 history worker client。
 */
export declare function createHistoryWorkerClient(options: CreateHistoryWorkerClientOptions): HistoryWorkerClient;
