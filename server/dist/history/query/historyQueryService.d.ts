import type { ChatItem, DiffData } from "../../chat/types";
import type { SqliteHistoryStore } from "../sqlite/sqliteHistoryStore";
/**
 * 可同步或异步返回值类型（便于 worker 线程实现与现有同步实现共存）。
 */
export type MaybePromise<T> = T | Promise<T>;
/**
 * 会话文件变更列表查询输入参数（专用索引链路）。
 */
export type ListThreadFileChangesInput = {
    threadId: string;
};
/**
 * 历史消息查询输入参数。
 */
export type ListHistoryMessagesInput = {
    threadId: string;
    limit: number;
    beforeTs: number | null;
};
/**
 * 单条消息 diff 详情查询参数。
 */
export type GetHistoryMessageDiffInput = {
    threadId: string;
    messageId: string;
};
/**
 * 历史查询服务接口。
 */
export type HistoryQueryService = {
    listMessages: (input: ListHistoryMessagesInput) => MaybePromise<ChatItem[]>;
    /**
     * 列出线程内的 file_change 列表（摘要模式），按时间倒序返回。
     *
     * 说明：
     * - 该接口用于“文件变更”弹窗首屏加载；
     * - 仅返回 path/kind 摘要，正文 diff/output 仍通过 getMessageDiff 按需拉取。
     */
    listThreadFileChanges?: (threadId: string) => MaybePromise<Array<ChatItem & {
        diff: DiffData;
    }>>;
    getMessageDiff?: (input: GetHistoryMessageDiffInput) => MaybePromise<DiffData | null>;
};
/**
 * 创建查询服务时的依赖参数。
 */
export type CreateHistoryQueryServiceOptions = {
    store: Pick<SqliteHistoryStore, "listMessagesByThread"> & Partial<Pick<SqliteHistoryStore, "listMessagesByThreadUaBoundaryPage" | "getMessageByThreadAndMessageId">> & Partial<Pick<SqliteHistoryStore, "listFileChangeEntriesByThread">>;
};
/**
 * 创建历史查询服务。
 */
export declare function createHistoryQueryService(options: CreateHistoryQueryServiceOptions): HistoryQueryService;
