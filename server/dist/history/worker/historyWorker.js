"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_worker_threads_1 = require("node:worker_threads");
const historyIngestService_1 = require("../ingest/historyIngestService");
const historyQueryService_1 = require("../query/historyQueryService");
const sqliteHistoryStore_1 = require("../sqlite/sqliteHistoryStore");
/**
 * history worker 线程入口：
 * - 独占 SQLite 连接（better-sqlite3 同步 API）；
 * - 在 worker 内执行 projector/查询，避免阻塞主线程事件循环。
 */
/**
 * 发送成功响应。
 */
function postOk(requestId, result) {
    const port = node_worker_threads_1.parentPort;
    if (!port)
        return;
    const message = { requestId, ok: true, result };
    port.postMessage(message);
}
/**
 * 发送失败响应。
 */
function postError(requestId, err) {
    const port = node_worker_threads_1.parentPort;
    if (!port)
        return;
    const error = String(err?.message ?? err ?? "unknown_error");
    const message = { requestId, ok: false, error };
    port.postMessage(message);
}
/**
 * worker 入口初始化与消息处理。
 */
function main() {
    if (!node_worker_threads_1.parentPort)
        throw new Error("history worker requires parentPort");
    const data = (node_worker_threads_1.workerData ?? {});
    const dbPath = String(data.dbPath ?? "").trim();
    if (!dbPath)
        throw new Error("history worker dbPath is required");
    // store/ingest/query：全部运行在 worker，避免主线程阻塞。
    const store = (0, sqliteHistoryStore_1.createSqliteHistoryStore)({ dbPath });
    const ingest = (0, historyIngestService_1.createHistoryIngestService)({ store });
    const query = (0, historyQueryService_1.createHistoryQueryService)({ store });
    node_worker_threads_1.parentPort.on("message", (raw) => {
        const msg = (raw ?? {});
        const requestId = Number(msg.requestId);
        const type = String(msg.type ?? "");
        if (!Number.isFinite(requestId) || requestId <= 0 || !type)
            return;
        void (async () => {
            try {
                if (type === "record_event") {
                    await ingest.recordCodexEvent(msg.input);
                    postOk(requestId, null);
                    return;
                }
                if (type === "list_messages") {
                    const items = await Promise.resolve(query.listMessages(msg.input));
                    postOk(requestId, items);
                    return;
                }
                if (type === "list_thread_file_changes") {
                    const listThreadFileChanges = query.listThreadFileChanges;
                    if (typeof listThreadFileChanges !== "function") {
                        postOk(requestId, []);
                        return;
                    }
                    const input = (msg.input ?? {});
                    const items = await Promise.resolve(listThreadFileChanges(String(input.threadId ?? "")));
                    postOk(requestId, items);
                    return;
                }
                if (type === "get_message_diff") {
                    const getMessageDiff = query.getMessageDiff;
                    if (typeof getMessageDiff !== "function") {
                        postOk(requestId, null);
                        return;
                    }
                    const diff = await Promise.resolve(getMessageDiff(msg.input));
                    postOk(requestId, diff);
                    return;
                }
                if (type === "close") {
                    await ingest.flushAndClose();
                    postOk(requestId, null);
                    return;
                }
            }
            catch (err) {
                postError(requestId, err);
            }
        })();
    });
}
main();
//# sourceMappingURL=historyWorker.js.map