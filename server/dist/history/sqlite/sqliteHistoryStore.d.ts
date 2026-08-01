import type { ThreadListStore } from "../../threadList/threadListTypes";
/**
 * 创建 SQLite 历史存储时的输入参数。
 */
export type SqliteHistoryStoreOptions = {
    dbPath: string;
};
/**
 * 结构化消息写入参数；允许部分字段更新。
 *
 * 说明：
 * - 本次重构移除了 raw_events/message_chunks；
 * - file_change 的 diff 结构化字段直接存入 messages 表（diff_*）。
 */
export type UpsertMessageInput = {
    threadId: string;
    messageId: string;
    role?: string;
    messageType?: string;
    status?: string;
    finalText?: string;
    /**
     * diffTitle：file_change 的展示标题（可空）。
     */
    diffTitle?: string;
    /**
     * diffChangesJson：file_change 的 changes JSON 数组字符串（可空）。
     */
    diffChangesJson?: string;
    /**
     * diffOutputDelta：file_change 的工具输出增量（会在 DB 内做追加）。
     */
    diffOutputDelta?: string;
    startedAtMs?: number;
    finishedAtMs?: number | null;
    createdAtMs?: number;
    updatedAtMs?: number;
};
/**
 * 结构化消息查询结果。
 */
export type MessageRecord = {
    threadId: string;
    messageId: string;
    role: string;
    messageType: string;
    status: string;
    finalText: string;
    diffTitle: string;
    diffChangesJson: string;
    diffOutput: string;
    startedAtMs: number;
    finishedAtMs: number | null;
    createdAtMs: number;
    updatedAtMs: number;
};
/**
 * file_change_entries 的行结构（用于文件变更列表的“索引查询”）。
 */
export type FileChangeEntryRecord = {
    threadId: string;
    messageId: string;
    tsMs: number;
    path: string;
    kind: string;
    addedLines: number;
    deletedLines: number;
};
/**
 * 按“user/assistant 边界计数”的分页查询输入参数。
 */
export type ListMessagesByThreadUaBoundaryPageInput = {
    threadId: string;
    limit: number;
    beforeTs: number | null;
};
/**
 * SQLite 历史存储接口。
 */
export type SqliteHistoryStore = ThreadListStore & {
    upsertMessage: (input: UpsertMessageInput) => void;
    listMessagesByThread: (threadId: string) => MessageRecord[];
    /**
     * 列出线程内 file_change 的索引条目（按消息时间倒序）。
     */
    listFileChangeEntriesByThread: (threadId: string) => FileChangeEntryRecord[];
    /**
     * 按 (threadId, messageId) 主键查询单条消息。
     *
     * 说明：
     * - 用于历史 diff 详情等“按 id 点查”场景；
     * - 避免通过 listMessagesByThread 全量扫描长线程导致的延迟。
     */
    getMessageByThreadAndMessageId: (threadId: string, messageId: string) => MessageRecord | null;
    listMessagesByThreadUaBoundaryPage: (input: ListMessagesByThreadUaBoundaryPageInput) => MessageRecord[];
    incrementalVacuum: () => void;
    withTransaction: <T>(callback: () => T) => T;
    close: () => void;
};
/**
 * 创建 SQLite 历史存储实例。
 */
export declare function createSqliteHistoryStore(options: SqliteHistoryStoreOptions): SqliteHistoryStore;
