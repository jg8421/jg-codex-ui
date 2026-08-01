"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countLines = countLines;
exports.getTextMetrics = getTextMetrics;
/**
 * 统计纯文本行数，避免高频 split 带来的额外分配。
 */
function countLines(text) {
    if (!text)
        return 0;
    let lines = 1;
    for (let index = 0; index < text.length; index += 1) {
        if (text.charCodeAt(index) === 10)
            lines += 1;
    }
    return lines;
}
/**
 * 返回文本的字符数与行数，用于折叠阈值判定。
 */
function getTextMetrics(text) {
    return { chars: text.length, lines: countLines(text) };
}
//# sourceMappingURL=textMetrics.js.map