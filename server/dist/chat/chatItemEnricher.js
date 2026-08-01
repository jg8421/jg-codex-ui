"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichChatItemForUi = enrichChatItemForUi;
const markdownAst_1 = require("./markdown/markdownAst");
const systemToolCallSummary_1 = require("./systemToolCallSummary");
const textMetrics_1 = require("./textMetrics");
const terminalPlainText_1 = require("./terminal/terminalPlainText");
/**
 * 为 ChatItem 追加“后端解析后的渲染字段”，让前端只负责渲染。
 */
function enrichChatItemForUi(item) {
    const isTerminal = item.render === "terminal";
    const isDiff = item.render === "diff";
    const next = { ...item };
    // streaming 缺省视为“已完成”（历史/turns 快照常省略该字段）。
    const isStreaming = next.streaming === true;
    if (isTerminal && !next.plainText && !isStreaming) {
        next.plainText = (0, terminalPlainText_1.normalizeTerminalText)(next.text);
    }
    if (!next.metrics) {
        const metricsSource = isDiff ? "" : next.plainText ?? next.text;
        next.metrics = (0, textMetrics_1.getTextMetrics)(metricsSource);
    }
    const isTextRender = !isTerminal && !isDiff && next.render !== "approval";
    const role = next.role;
    const canHaveMarkdown = isTextRender && (role === "assistant" || role === "reasoning" || role === "system");
    if (canHaveMarkdown && !isStreaming) {
        if (role === "system") {
            const parsedSummary = (0, systemToolCallSummary_1.parseSystemToolCallSummary)(next.text);
            next.systemToolCallSummary = parsedSummary;
            next.markdownAst = parsedSummary ? null : (0, markdownAst_1.buildMarkdownAst)(next.text);
        }
        else {
            next.markdownAst = (0, markdownAst_1.buildMarkdownAst)(next.text);
            next.systemToolCallSummary = null;
        }
    }
    return next;
}
//# sourceMappingURL=chatItemEnricher.js.map