import type { ThreadListCursor, ThreadSummaryRecord, ThreadListStore } from "./threadListTypes";
/**
 * 创建会话列表服务时的输入参数。
 */
export type CreateThreadListServiceOptions = {
    store: ThreadListStore;
    listThreadsFromCli: () => Promise<ThreadSummaryRecord[]>;
};
/**
 * 会话列表查询参数。
 */
export type ListThreadSummariesOptions = {
    refresh: boolean;
};
/**
 * 会话列表分页查询参数。
 */
export type ListThreadSummariesPageOptions = {
    refresh: boolean;
    limit: number;
    cursor: ThreadListCursor | null;
    cwd: string | null;
    /**
     * 需要强制补齐返回的 threadIds（典型用于置顶线程）。
     */
    includeThreadIds: string[];
};
/**
 * 会话列表查询结果。
 */
export type ThreadListResult = {
    threads: ThreadSummaryRecord[];
    warmingUp: boolean;
    warmupFailed: boolean;
};
/**
 * 会话列表分页查询结果。
 */
export type ThreadListPageResult = ThreadListResult & {
    nextCursor: ThreadListCursor | null;
};
/**
 * 会话列表服务接口。
 */
export type ThreadListService = {
    listThreads: (options: ListThreadSummariesOptions) => Promise<ThreadListResult>;
    listThreadsPage: (options: ListThreadSummariesPageOptions) => Promise<ThreadListPageResult>;
};
/**
 * 创建会话列表服务。
 */
export declare function createThreadListService(options: CreateThreadListServiceOptions): ThreadListService;
