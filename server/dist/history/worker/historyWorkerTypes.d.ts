import type { ChatItem, DiffData } from "../../chat/types";
import type { GetHistoryMessageDiffInput, ListHistoryMessagesInput, ListThreadFileChangesInput } from "../query/historyQueryService";
import type { RecordCodexEventInput } from "../types";
/**
 * worker 线程初始化参数。
 */
export type HistoryWorkerData = {
    dbPath: string;
};
/**
 * worker 请求消息（主线程 -> worker）。
 */
export type HistoryWorkerRequest = {
    requestId: number;
    type: "record_event";
    input: RecordCodexEventInput;
} | {
    requestId: number;
    type: "list_messages";
    input: ListHistoryMessagesInput;
} | {
    requestId: number;
    type: "list_thread_file_changes";
    input: ListThreadFileChangesInput;
} | {
    requestId: number;
    type: "get_message_diff";
    input: GetHistoryMessageDiffInput;
} | {
    requestId: number;
    type: "close";
};
/**
 * worker 响应消息（worker -> 主线程）。
 */
export type HistoryWorkerResponse = {
    requestId: number;
    ok: true;
    result: unknown;
} | {
    requestId: number;
    ok: false;
    error: string;
};
/**
 * worker API 返回值映射（用于主线程 client 侧泛型约束）。
 */
export type HistoryWorkerResultByType = {
    record_event: null;
    list_messages: ChatItem[];
    list_thread_file_changes: ChatItem[];
    get_message_diff: DiffData | null;
    close: null;
};
