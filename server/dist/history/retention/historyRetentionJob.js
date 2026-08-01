"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryRetentionJob = void 0;
/**
 * 一天对应的毫秒数。
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * 规范化保留天数，非法值回落到 1 天。
 */
function normalizeRetentionDays(rawDays) {
    const parsedDays = Number(rawDays);
    if (!Number.isFinite(parsedDays))
        return 1;
    return Math.max(1, Math.floor(parsedDays));
}
/**
 * 历史数据保留任务：
 * - 删除过期 raw_events；
 * - 删除过期 message_chunks；
 * - 执行增量 vacuum。
 */
class HistoryRetentionJob {
    options;
    rawRetentionDays;
    chunkRetentionDays;
    constructor(options) {
        this.options = options;
        this.rawRetentionDays = normalizeRetentionDays(options.rawRetentionDays);
        this.chunkRetentionDays = normalizeRetentionDays(options.chunkRetentionDays);
    }
    /**
     * 执行一次清理。
     */
    runOnce(nowMs) {
        const normalizedNowMs = Math.max(0, Math.floor(Number(nowMs)));
        const rawCutoffMs = normalizedNowMs - this.rawRetentionDays * DAY_MS;
        const chunkCutoffMs = normalizedNowMs - this.chunkRetentionDays * DAY_MS;
        this.options.store.deleteRawEventsOlderThan(rawCutoffMs);
        this.options.store.deleteChunksOlderThan(chunkCutoffMs);
        this.options.store.incrementalVacuum();
    }
}
exports.HistoryRetentionJob = HistoryRetentionJob;
//# sourceMappingURL=historyRetentionJob.js.map