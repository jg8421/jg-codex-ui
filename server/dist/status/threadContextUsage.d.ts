/**
 * 根据 thread 的 session 文件路径读取 context usage 百分比（带缓存）。
 */
export declare function readThreadContextUsagePercentFromSessionPath(sessionPath: unknown): Promise<number | null>;
/**
 * 线程上下文使用率读取器：
 * - 读取 thread 对应 session 文件中的最新 token_count；
 * - 输出与 CLI 一致口径的 `context usage` 百分比。
 */
export declare class ThreadContextUsageReader {
    /**
     * 从 session 文件路径读取上下文使用率（百分比）。
     */
    readUsagePercent(sessionPath: unknown): Promise<number | null>;
}
/**
 * 测试专用：清空缓存，避免 case 间互相污染。
 */
export declare function clearThreadContextUsageCacheForTest(): void;
