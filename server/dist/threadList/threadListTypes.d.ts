/**
 * 会话列表线程摘要记录。
 */
export type ThreadSummaryRecord = {
    id: string;
    preview: string;
    createdAt: number;
    updatedAt: number;
    cwd: string;
    modelProvider: string;
};
/**
 * 线程列表分页游标类型（稳定排序键）。
 */
export type ThreadListCursor = import("./threadListCursor").ThreadListCursor;
/**
 * 线程摘要写入参数。
 */
export type UpsertThreadSummaryInput = ThreadSummaryRecord;
/**
 * 线程摘要分页查询入参。
 */
export type ListThreadSummariesPageInput = {
    /**
     * 每页条数上限（服务端会做范围保护）。
     */
    limit: number;
    /**
     * 分页游标；为空表示从最新开始。
     */
    cursor: ThreadListCursor | null;
    /**
     * 可选 cwd 精确过滤；为空表示不过滤。
     */
    cwd: string | null;
};
/**
 * 线程摘要分页查询结果。
 */
export type ThreadSummariesPage = {
    threads: ThreadSummaryRecord[];
    nextCursor: ThreadListCursor | null;
};
/**
 * 会话列表持久化仓库接口。
 */
export type ThreadListStore = {
    listThreadSummaries: () => ThreadSummaryRecord[];
    listThreadSummariesPage: (input: ListThreadSummariesPageInput) => ThreadSummariesPage;
    getThreadSummariesByIds: (threadIds: string[]) => ThreadSummaryRecord[];
    /**
     * 删除整条线程的本地历史数据（摘要、消息、file_change 索引）。
     */
    deleteThreadHistory: (threadId: string) => void;
    /**
     * 仅删除线程摘要；保留完整历史，供“只从列表隐藏”场景复用。
     */
    deleteThreadSummary: (threadId: string) => void;
    upsertThreadSummary: (input: UpsertThreadSummaryInput) => void;
    upsertThreadSummaries: (inputs: UpsertThreadSummaryInput[]) => void;
    replaceThreadSummaries: (inputs: UpsertThreadSummaryInput[]) => void;
};
