"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistoryWorkerPool = createHistoryWorkerPool;
const historyWorkerClient_1 = require("./historyWorkerClient");
/**
 * HistoryWorkerPool：对外提供与现有 history runtime 对齐的 ingest/query 接口，
 * 内部通过 worker_threads 执行 SQLite 读写，避免阻塞主线程。
 */
/**
 * 判断错误是否属于“worker 已关闭/退出”这类可恢复场景。
 *
 * 说明：
 * - worker client 的实现/构建产物可能存在差异（例如旧版本仅抛出 `history worker is closed`）；
 * - 这里用 message 关键字做兼容匹配，避免因错误文本差异导致无法恢复。
 */
function isHistoryWorkerClosedError(err) {
    const message = String(err?.message ?? err ?? "");
    if (!message)
        return false;
    if (!message.toLowerCase().includes("history worker"))
        return false;
    return message.includes("closed") || message.includes("exited");
}
/**
 * 归一化 worker 数量，避免 NaN/负数导致异常。
 */
function normalizeWorkerCount(raw) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return 1;
    return Math.max(1, Math.floor(parsed));
}
/**
 * 创建 history worker pool。
 */
function createHistoryWorkerPool(options) {
    const normalizedWorkerCount = normalizeWorkerCount(options.workerCount);
    // writerName：writer 实例名称（用于日志定位）。
    const writerName = "history-writer";
    // readerNames：reader 实例名称列表（用于日志定位与重建）。
    const readerNames = Array.from({ length: Math.max(0, normalizedWorkerCount - 1) }, (_, index) => `history-reader-${index + 1}`);
    // writer：负责 history ingest（保证写入顺序，避免多写者锁争用）。
    let writer = (0, historyWorkerClient_1.createHistoryWorkerClient)({ dbPath: options.dbPath, name: writerName });
    // readers：可选的只读 worker，用于分摊查询负载；为空时查询也走 writer。
    const readers = readerNames.map((name) => (0, historyWorkerClient_1.createHistoryWorkerClient)({ dbPath: options.dbPath, name }));
    // nextReaderIndex：round-robin 指针，避免热点落在同一个 reader。
    let nextReaderIndex = 0;
    /**
     * 替换 writer：
     * - 先同步创建新 worker 并切换引用；
     * - 再异步 best-effort 关闭旧 worker（避免阻塞当前请求）。
     */
    const replaceWriter = (expected) => {
        const current = writer;
        if (current !== expected) {
            void expected.close().catch(() => { });
            return current;
        }
        const previous = current;
        writer = (0, historyWorkerClient_1.createHistoryWorkerClient)({ dbPath: options.dbPath, name: writerName });
        void previous.close().catch(() => { });
        return writer;
    };
    /**
     * 替换某个 reader（按下标）。
     */
    const replaceReader = (index, expected) => {
        const current = readers[index];
        if (current !== expected) {
            void expected.close().catch(() => { });
            return current ?? writer;
        }
        const name = readerNames[index] ?? `history-reader-${index + 1}`;
        const next = (0, historyWorkerClient_1.createHistoryWorkerClient)({ dbPath: options.dbPath, name });
        readers[index] = next;
        void expected.close().catch(() => { });
        return next;
    };
    /**
     * pickQueryTarget：为一次 query 选择目标 worker：
     * - 优先 reader（round-robin）；
     * - 无 reader 时回退 writer。
     */
    const pickQueryTarget = () => {
        if (!readers.length)
            return { kind: "writer", client: writer };
        const index = nextReaderIndex % readers.length;
        nextReaderIndex += 1;
        const picked = readers[index] ?? writer;
        return picked === writer ? { kind: "writer", client: writer } : { kind: "reader", index, client: picked };
    };
    let closed = false;
    const close = async () => {
        if (closed)
            return;
        closed = true;
        // 先关闭 writer，保证写入已 flush。
        await writer.close();
        await Promise.all(readers.map((reader) => reader.close()));
    };
    const ingest = {
        async recordCodexEvent(input) {
            const currentWriter = writer;
            try {
                await currentWriter.recordEvent(input);
            }
            catch (err) {
                if (closed || !isHistoryWorkerClosedError(err))
                    throw err;
                await replaceWriter(currentWriter).recordEvent(input);
            }
        },
        async flushAndClose() {
            await close();
        },
    };
    const query = {
        async listMessages(input) {
            const target = pickQueryTarget();
            try {
                return await target.client.listMessages(input);
            }
            catch (err) {
                if (closed || !isHistoryWorkerClosedError(err))
                    throw err;
                const nextClient = target.kind === "writer" ? replaceWriter(target.client) : replaceReader(target.index, target.client);
                return nextClient.listMessages(input);
            }
        },
        async getMessageDiff(input) {
            const target = pickQueryTarget();
            try {
                return await target.client.getMessageDiff(input);
            }
            catch (err) {
                if (closed || !isHistoryWorkerClosedError(err))
                    throw err;
                const nextClient = target.kind === "writer" ? replaceWriter(target.client) : replaceReader(target.index, target.client);
                return nextClient.getMessageDiff(input);
            }
        },
    };
    return { ingest, query, close };
}
//# sourceMappingURL=historyWorkerPool.js.map