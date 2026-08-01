"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistoryIngestService = createHistoryIngestService;
const projectCodexEvent_1 = require("../projector/projectCodexEvent");
/**
 * 构造历史写入编排服务：
 * - 为每条事件分配 thread 内递增 seq；
 * - 使用事务保证 raw/message/chunk 的原子写入。
 */
function createHistoryIngestService(options) {
    const nowMsProvider = options.nowMs ?? (() => Date.now());
    return {
        /**
         * 记录一条 Codex 事件并投影到结构化历史表。
         */
        async recordCodexEvent(input) {
            const nowMs = nowMsProvider();
            const payload = { method: input.method, params: input.params };
            options.store.withTransaction(() => {
                const projected = (0, projectCodexEvent_1.projectCodexEvent)({
                    threadId: input.threadId,
                    event: payload,
                    nowMs,
                });
                if (projected.message)
                    options.store.upsertMessage(projected.message);
                if (projected.messages?.length) {
                    for (const message of projected.messages) {
                        options.store.upsertMessage(message);
                    }
                }
            });
        },
        /**
         * 刷新并关闭写入资源。
         */
        async flushAndClose() {
            options.store.close();
        },
    };
}
//# sourceMappingURL=historyIngestService.js.map