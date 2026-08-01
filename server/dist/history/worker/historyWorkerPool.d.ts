import type { HistoryQueryService } from "../query/historyQueryService";
import type { HistoryIngestService } from "../types";
export type CreateHistoryWorkerPoolOptions = {
    dbPath: string;
    /**
     * workerCount：worker 总数（>=1）。
     * - 1：单 worker 同时处理写入与查询；
     * - >1：1 个 writer + N-1 个 reader（查询 round-robin 分摊）。
     */
    workerCount: number;
};
export type HistoryWorkerPool = {
    ingest: HistoryIngestService;
    query: HistoryQueryService;
    close: () => Promise<void>;
};
/**
 * 创建 history worker pool。
 */
export declare function createHistoryWorkerPool(options: CreateHistoryWorkerPoolOptions): HistoryWorkerPool;
