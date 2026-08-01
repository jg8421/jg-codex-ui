import type { HistoryQueryService } from "./query/historyQueryService";
import type { HistoryIngestService, WebHistoryMode } from "./types";
export type { CodexEventPayload, HistoryIngestService, RecordCodexEventInput, WebHistoryMode, } from "./types";
/**
 * 历史运行时实例。
 */
export type WebHistoryRuntime = {
    ingest: HistoryIngestService;
    query: HistoryQueryService;
    close: () => Promise<void>;
};
/**
 * 创建历史运行时参数。
 */
export type CreateWebHistoryRuntimeOptions = {
    mode: WebHistoryMode;
    dbPath: string;
    /**
     * historyWorkerCount：
     * - 0：禁用 worker（回退主线程直连 SQLite）；
     * - >=1：启用 worker pool。
     */
    workerCount: number;
};
/**
 * 根据配置模式创建历史运行时：
 * - off: 不创建任何历史资源；
 * - shadow/primary: 初始化 SQLite store 与 ingest 服务。
 */
export declare function createWebHistoryRuntime(options: CreateWebHistoryRuntimeOptions): WebHistoryRuntime | null;
