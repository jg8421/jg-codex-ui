import type { SqliteHistoryStore } from "../sqlite/sqliteHistoryStore";
import type { HistoryIngestService } from "../types";
/**
 * 创建历史写入服务时的依赖参数。
 */
export type CreateHistoryIngestServiceOptions = {
    store: SqliteHistoryStore;
    nowMs?: () => number;
};
/**
 * 构造历史写入编排服务：
 * - 为每条事件分配 thread 内递增 seq；
 * - 使用事务保证 raw/message/chunk 的原子写入。
 */
export declare function createHistoryIngestService(options: CreateHistoryIngestServiceOptions): HistoryIngestService;
