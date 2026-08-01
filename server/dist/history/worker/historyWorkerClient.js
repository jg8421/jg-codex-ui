"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistoryWorkerClient = createHistoryWorkerClient;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_worker_threads_1 = require("node:worker_threads");
/**
 * 单个 history worker 的客户端封装：
 * - 负责 requestId 分配；
 * - 负责 Promise 挂起与回包匹配；
 * - 负责在 worker 退出时 fail-fast。
 */
/**
 * 解析 worker 脚本路径：
 * - 生产环境：`dist/.../historyWorker.js`
 * - 开发环境：`src/.../historyWorker.ts`（依赖 tsx/vitest 的 loader 能力）
 */
function resolveHistoryWorkerScriptPath() {
    const jsPath = node_path_1.default.join(__dirname, "historyWorker.js");
    if (node_fs_1.default.existsSync(jsPath))
        return jsPath;
    const tsPath = node_path_1.default.join(__dirname, "historyWorker.ts");
    if (!node_fs_1.default.existsSync(tsPath))
        throw new Error("history worker script not found");
    // tsx 模式：当主进程由 tsx/vitest loader 驱动时，worker 线程通常可继承同样的 execArgv/loader。
    const execArgvJoined = process.execArgv.join(" ");
    const canRunTypeScript = execArgvJoined.includes("tsx") || execArgvJoined.includes("ts-node");
    if (canRunTypeScript)
        return tsPath;
    throw new Error("history worker requires compiled JS (run build) or a TS loader (tsx)");
}
/**
 * 创建 history worker client。
 */
function createHistoryWorkerClient(options) {
    const scriptPath = resolveHistoryWorkerScriptPath();
    const workerData = { dbPath: options.dbPath };
    const worker = new node_worker_threads_1.Worker(scriptPath, { workerData });
    // nextRequestId：单 worker 内自增请求 id（从 1 开始，便于调试）。
    let nextRequestId = 1;
    // pendingById：挂起请求表，用于匹配 worker 回包。
    const pendingById = new Map();
    // isClosed：标记 client 是否已关闭，防止重复发送请求。
    let isClosed = false;
    // closeReason：记录关闭原因，便于在后续请求中返回更可读的错误信息。
    let closeReason = null;
    const rejectAllPending = (reason) => {
        for (const [requestId, pending] of pendingById.entries()) {
            pendingById.delete(requestId);
            if (pending.timeout)
                clearTimeout(pending.timeout);
            pending.reject(reason);
        }
    };
    worker.on("message", (raw) => {
        const msg = (raw ?? {});
        const requestId = Number(msg.requestId);
        if (!Number.isFinite(requestId))
            return;
        const pending = pendingById.get(requestId);
        if (!pending)
            return;
        pendingById.delete(requestId);
        if (pending.timeout)
            clearTimeout(pending.timeout);
        if (msg.ok === true) {
            pending.resolve(msg.result);
            return;
        }
        pending.reject(new Error(String(msg.error ?? "worker_error")));
    });
    worker.on("error", (err) => {
        // worker 线程抛出未捕获异常时会触发 error 事件；记录日志便于线上排障。
        // eslint-disable-next-line no-console
        console.error(`history worker error (${options.name})`, err);
        closeReason = err instanceof Error ? err : new Error(String(err));
        rejectAllPending(err);
    });
    worker.on("exit", (code) => {
        isClosed = true;
        closeReason = new Error(`history worker exited (${options.name}, code=${code})`);
        // eslint-disable-next-line no-console
        console.warn(String(closeReason.message));
        rejectAllPending(closeReason);
    });
    /**
     * 发送请求并返回 Promise。
     */
    const request = (message) => {
        if (isClosed)
            return Promise.reject(closeReason ?? new Error("history worker is closed"));
        const requestId = nextRequestId;
        nextRequestId += 1;
        return new Promise((resolve, reject) => {
            // timeoutMs：防御性超时，避免 worker 无回包导致 pending 泄漏。
            const timeoutMs = 60_000;
            const timeout = setTimeout(() => {
                pendingById.delete(requestId);
                reject(new Error("history worker request timeout"));
            }, timeoutMs);
            pendingById.set(requestId, { resolve: resolve, reject, timeout });
            worker.postMessage({ requestId, ...message });
        });
    };
    return {
        async recordEvent(input) {
            await request({ type: "record_event", input });
        },
        async listMessages(input) {
            return request({ type: "list_messages", input });
        },
        async listThreadFileChanges(threadId) {
            const normalizedThreadId = String(threadId ?? "").trim();
            return request({ type: "list_thread_file_changes", input: { threadId: normalizedThreadId } });
        },
        async getMessageDiff(input) {
            return request({ type: "get_message_diff", input });
        },
        async close() {
            if (isClosed)
                return;
            try {
                await request({ type: "close" });
            }
            catch {
                // close best-effort：worker 可能已 crash/退出，不应阻塞关闭流程。
            }
            isClosed = true;
            closeReason = new Error("history worker closed");
            rejectAllPending(closeReason);
            await worker.terminate().catch(() => 0);
        },
    };
}
//# sourceMappingURL=historyWorkerClient.js.map