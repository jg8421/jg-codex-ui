/**
 * Retention 任务依赖的最小存储接口。
 */
export type HistoryRetentionStore = {
    deleteRawEventsOlderThan: (cutoffMs: number) => number;
    deleteChunksOlderThan: (cutoffMs: number) => number;
    incrementalVacuum: () => void;
};
/**
 * Retention 任务构造参数。
 */
export type HistoryRetentionJobOptions = {
    store: HistoryRetentionStore;
    rawRetentionDays: number;
    chunkRetentionDays: number;
};
/**
 * 历史数据保留任务：
 * - 删除过期 raw_events；
 * - 删除过期 message_chunks；
 * - 执行增量 vacuum。
 */
export declare class HistoryRetentionJob {
    private readonly options;
    private readonly rawRetentionDays;
    private readonly chunkRetentionDays;
    constructor(options: HistoryRetentionJobOptions);
    /**
     * 执行一次清理。
     */
    runOnce(nowMs: number): void;
}
