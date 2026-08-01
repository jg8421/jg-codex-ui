"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebHistoryRuntime = createWebHistoryRuntime;
/**
 * 历史模块统一出口：集中导出公共类型与运行时构造器。
 */
const historyIngestService_1 = require("./ingest/historyIngestService");
const historyQueryService_1 = require("./query/historyQueryService");
const sqliteHistoryStore_1 = require("./sqlite/sqliteHistoryStore");
const historyWorkerPool_1 = require("./worker/historyWorkerPool");
/**
 * 根据配置模式创建历史运行时：
 * - off: 不创建任何历史资源；
 * - shadow/primary: 初始化 SQLite store 与 ingest 服务。
 */
function createWebHistoryRuntime(options) {
    if (options.mode === "off")
        return null;
    const normalizedWorkerCount = Number.isFinite(options.workerCount) ? Math.max(0, Math.floor(options.workerCount)) : 0;
    if (normalizedWorkerCount > 0) {
        try {
            const pool = (0, historyWorkerPool_1.createHistoryWorkerPool)({ dbPath: options.dbPath, workerCount: normalizedWorkerCount });
            return {
                ingest: pool.ingest,
                query: pool.query,
                async close() {
                    await pool.close();
                },
            };
        }
        catch (err) {
            // worker 启动失败时回退主线程直连，保证服务可用性。
            // eslint-disable-next-line no-console
            console.warn(`history worker pool init failed; fallback to main-thread sqlite. err=${String(err)}`);
        }
    }
    // SQLite store 负责底层读写，ingest 负责事件编排与投影。
    const store = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath: options.dbPath });
    const ingest = (0, historyIngestService_1.createHistoryIngestService)({ store });
    const query = (0, historyQueryService_1.createHistoryQueryService)({ store });
    return {
        ingest,
        query,
        async close() {
            await ingest.flushAndClose();
        },
    };
}
//# sourceMappingURL=index.js.map