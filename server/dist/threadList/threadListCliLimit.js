"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THREAD_LIST_CLI_LIMIT = void 0;
/**
 * CLI 线程列表拉取上限：
 * - 需要足够大，避免侧栏置顶的旧会话因条数截断而“消失”；
 * - 同时保持一个合理上限，避免极端环境下拉取过重导致响应变慢。
 */
exports.THREAD_LIST_CLI_LIMIT = 2000;
//# sourceMappingURL=threadListCliLimit.js.map