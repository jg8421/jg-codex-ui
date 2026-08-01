"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTextMetrics = exports.countLines = void 0;
exports.appendTerminalDelta = appendTerminalDelta;
exports.normalizeTerminalText = normalizeTerminalText;
const textMetrics_1 = require("../textMetrics");
Object.defineProperty(exports, "countLines", { enumerable: true, get: function () { return textMetrics_1.countLines; } });
Object.defineProperty(exports, "getTextMetrics", { enumerable: true, get: function () { return textMetrics_1.getTextMetrics; } });
/**
 * 去除 OSC 序列（常见于终端设置标题、超链接等），避免 UI 复制/预览出现控制字符。
 */
function stripOscSequences(text) {
    return text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
}
/**
 * 以增量方式模拟终端输出，处理常见光标移动与擦除序列。
 *
 * 说明：
 * - 该逻辑与 Web 侧旧实现保持一致（用于保持展示/复制行为不变）；
 * - 仅覆盖常见的 `\r`、`\b` 与部分 CSI 序列，不追求完整 VT100 支持。
 */
function appendTerminalDelta(existing, delta) {
    const input = stripOscSequences(delta).replace(/\r\n/g, "\n");
    const lastNewlineIndex = existing.lastIndexOf("\n");
    let prefix = lastNewlineIndex >= 0 ? existing.slice(0, lastNewlineIndex + 1) : "";
    let line = lastNewlineIndex >= 0 ? existing.slice(lastNewlineIndex + 1) : existing;
    let lineBuffer = Array.from(line);
    let column = lineBuffer.length;
    const ensureColumn = (nextColumn) => {
        if (nextColumn <= lineBuffer.length)
            return;
        for (let index = lineBuffer.length; index < nextColumn; index += 1)
            lineBuffer.push(" ");
    };
    const eraseInLine = (mode) => {
        if (mode === 0) {
            lineBuffer = lineBuffer.slice(0, column);
            return;
        }
        if (mode === 1) {
            ensureColumn(column);
            for (let index = 0; index < column; index += 1)
                lineBuffer[index] = " ";
            return;
        }
        if (mode === 2) {
            const keepColumn = column;
            lineBuffer = [];
            ensureColumn(keepColumn);
        }
    };
    const writeChar = (character) => {
        ensureColumn(column);
        if (column === lineBuffer.length)
            lineBuffer.push(character);
        else
            lineBuffer[column] = character;
        column += 1;
    };
    const isFinalByte = (character) => {
        const codePoint = character.charCodeAt(0);
        return codePoint >= 0x40 && codePoint <= 0x7e;
    };
    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        if (character === "\n") {
            prefix += lineBuffer.join("") + "\n";
            lineBuffer = [];
            column = 0;
            continue;
        }
        if (character === "\r") {
            column = 0;
            continue;
        }
        if (character === "\b") {
            column = Math.max(0, column - 1);
            continue;
        }
        if (character === "\t") {
            writeChar(" ");
            writeChar(" ");
            continue;
        }
        if (character === "\x1b") {
            if (input[index + 1] === "[") {
                let cursor = index + 2;
                let paramText = "";
                while (cursor < input.length && !isFinalByte(input[cursor])) {
                    paramText += input[cursor];
                    cursor += 1;
                }
                const finalByte = cursor < input.length ? input[cursor] : "";
                index = cursor;
                if (paramText.includes("?"))
                    continue;
                const firstParam = (() => {
                    const header = paramText.split(";")[0] ?? "";
                    const value = header ? Number(header) : 0;
                    return Number.isFinite(value) ? value : 0;
                })();
                if (finalByte === "m")
                    continue;
                if (finalByte === "K") {
                    eraseInLine(firstParam);
                    continue;
                }
                if (finalByte === "D") {
                    column = Math.max(0, column - (firstParam || 1));
                    continue;
                }
                if (finalByte === "C") {
                    column += firstParam || 1;
                    ensureColumn(column);
                    continue;
                }
                if (finalByte === "G") {
                    column = Math.max(0, (firstParam || 1) - 1);
                    ensureColumn(column);
                    continue;
                }
                continue;
            }
            continue;
        }
        writeChar(character);
    }
    line = lineBuffer.join("");
    return prefix + line;
}
/**
 * 规范化终端文本，支持包含 ANSI 增量符号的场景。
 */
function normalizeTerminalText(text) {
    if (!text)
        return "";
    return appendTerminalDelta("", text);
}
//# sourceMappingURL=terminalPlainText.js.map