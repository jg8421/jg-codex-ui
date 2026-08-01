"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadContextUsageReader = void 0;
exports.readThreadContextUsagePercentFromSessionPath = readThreadContextUsagePercentFromSessionPath;
exports.clearThreadContextUsageCacheForTest = clearThreadContextUsageCacheForTest;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// 基于 `path + mtime + size` 的轻量缓存，避免频繁 open_thread 时重复扫描大文件。
const threadContextUsageCacheByPath = new Map();
const SESSION_TAIL_SCAN_CHUNK_SIZE = 64 * 1024;
/**
 * 判断值是否为可索引对象，避免误把 `null` / 数组当成对象读取。
 */
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/**
 * 从对象中按 key 读取嵌套记录；任一层缺失则返回 `null`。
 */
function readNestedRecord(root, keys) {
    if (!isRecord(root))
        return null;
    let currentValue = root;
    for (const key of keys) {
        const nestedValue = currentValue[key];
        if (!isRecord(nestedValue))
            return null;
        currentValue = nestedValue;
    }
    return currentValue;
}
/**
 * 读取对象上的 number 字段（支持 camelCase / snake_case）；读取失败返回 `null`。
 */
function pickNumber(input, candidateKeys) {
    if (!isRecord(input))
        return null;
    for (const key of candidateKeys) {
        const rawValue = input[key];
        if (typeof rawValue !== "number")
            continue;
        if (!Number.isFinite(rawValue))
            continue;
        return rawValue;
    }
    return null;
}
/**
 * 将百分比值归一化到 `0..100` 并保留 1 位小数。
 */
function normalizePercent(rawPercent) {
    if (!Number.isFinite(rawPercent))
        return null;
    if (rawPercent < 0)
        return null;
    const clampedPercent = Math.max(0, Math.min(100, rawPercent));
    return Math.round(clampedPercent * 10) / 10;
}
/**
 * 从单条 session jsonl 记录中提取 context usage 百分比。
 *
 * 支持两类 token_count 结构：
 * 1) event_msg: `{ payload: { type: "token_count", info: ... } }`
 * 2) ws event : `{ payload: { method: "codex/event/token_count", params: { msg: { info: ... } } } }`
 */
function extractContextUsagePercentFromSessionLine(lineData) {
    if (!isRecord(lineData))
        return null;
    const payload = lineData.payload;
    if (!isRecord(payload))
        return null;
    // 结构 1：session 事件落盘格式。
    const directInfo = payload.type === "token_count" && isRecord(payload.info) ? payload.info : null;
    if (directInfo) {
        const directPercent = extractPercentFromTokenCountInfo(directInfo);
        if (directPercent !== null)
            return directPercent;
    }
    // 结构 2：ws/raw event 包装格式。
    const method = typeof payload.method === "string" ? payload.method : "";
    if (method !== "codex/event/token_count")
        return null;
    const wrappedInfo = readNestedRecord(payload, ["params", "msg", "info"]) ?? readNestedRecord(payload, ["params", "info"]);
    if (!wrappedInfo)
        return null;
    return extractPercentFromTokenCountInfo(wrappedInfo);
}
/**
 * 从 token_count.info 结构中提取百分比：`last_token_usage.input_tokens / model_context_window`。
 *
 * 兼容说明：
 * - 优先 `last_token_usage`（更接近 CLI 实时“上下文占用”口径）；
 * - 若缺失，再回退 `total_token_usage` 兼容旧结构。
 */
function extractPercentFromTokenCountInfo(tokenCountInfo) {
    if (!isRecord(tokenCountInfo))
        return null;
    const lastTokenUsageRecord = readNestedRecord(tokenCountInfo, ["last_token_usage"]) ??
        readNestedRecord(tokenCountInfo, ["lastTokenUsage"]);
    const totalTokenUsageRecord = readNestedRecord(tokenCountInfo, ["total_token_usage"]) ??
        readNestedRecord(tokenCountInfo, ["totalTokenUsage"]);
    const preferredTokenUsageRecord = lastTokenUsageRecord ?? totalTokenUsageRecord;
    if (!preferredTokenUsageRecord)
        return null;
    const inputTokens = pickNumber(preferredTokenUsageRecord, ["input_tokens", "inputTokens"]);
    const modelContextWindow = pickNumber(tokenCountInfo, ["model_context_window", "modelContextWindow"]);
    if (inputTokens === null || modelContextWindow === null)
        return null;
    if (inputTokens < 0 || modelContextWindow <= 0)
        return null;
    // input_tokens 理论上不应大于 context window；超出时判为无效，避免误报 100%。
    if (inputTokens > modelContextWindow)
        return null;
    return normalizePercent((inputTokens / modelContextWindow) * 100);
}
/**
 * 尝试从单行 jsonl 文本中提取 context usage 百分比。
 */
function readContextUsagePercentFromLineText(lineText) {
    const normalizedLineText = lineText.trim();
    if (!normalizedLineText)
        return null;
    let parsedLineData;
    try {
        parsedLineData = JSON.parse(normalizedLineText);
    }
    catch {
        return null;
    }
    return extractContextUsagePercentFromSessionLine(parsedLineData);
}
/**
 * 从 session jsonl 尾部反向分块扫描，返回“最后一条可解析 token_count 记录”的 context usage 百分比。
 */
async function readLatestContextUsagePercentFromSessionFile(sessionPath, fileSizeHint) {
    let sessionFileHandle = null;
    try {
        sessionFileHandle = await fs_1.default.promises.open(sessionPath, "r");
        // 优先复用外层 stat 的 size，避免重复 stat 系统调用。
        const hintedSize = typeof fileSizeHint === "number" && Number.isFinite(fileSizeHint) ? Math.max(0, Math.floor(fileSizeHint)) : -1;
        let readEnd = hintedSize >= 0 ? hintedSize : (await sessionFileHandle.stat()).size;
        if (readEnd <= 0)
            return null;
        let carryPrefix = "";
        while (readEnd > 0) {
            const readStart = Math.max(0, readEnd - SESSION_TAIL_SCAN_CHUNK_SIZE);
            const readLength = readEnd - readStart;
            const readBuffer = Buffer.allocUnsafe(readLength);
            const { bytesRead } = await sessionFileHandle.read(readBuffer, 0, readLength, readStart);
            if (bytesRead <= 0)
                break;
            const chunkText = readBuffer.subarray(0, bytesRead).toString("utf8");
            const combinedText = chunkText + carryPrefix;
            const chunkLines = combinedText.split(/\r?\n/);
            carryPrefix = readStart > 0 ? (chunkLines.shift() ?? "") : "";
            for (let lineIndex = chunkLines.length - 1; lineIndex >= 0; lineIndex -= 1) {
                const parsedPercent = readContextUsagePercentFromLineText(chunkLines[lineIndex] ?? "");
                if (parsedPercent !== null)
                    return parsedPercent;
            }
            readEnd = readStart;
        }
        // 最前面的残余文本（文件开头行）也尝试解析一次。
        return readContextUsagePercentFromLineText(carryPrefix);
    }
    finally {
        await sessionFileHandle?.close().catch(() => undefined);
    }
}
/**
 * 根据 thread 的 session 文件路径读取 context usage 百分比（带缓存）。
 */
async function readThreadContextUsagePercentFromSessionPath(sessionPath) {
    if (typeof sessionPath !== "string")
        return null;
    const normalizedSessionPath = path_1.default.resolve(sessionPath.trim());
    if (!normalizedSessionPath)
        return null;
    let sessionStat;
    try {
        sessionStat = await fs_1.default.promises.stat(normalizedSessionPath);
    }
    catch {
        return null;
    }
    if (!sessionStat.isFile())
        return null;
    const cachedEntry = threadContextUsageCacheByPath.get(normalizedSessionPath);
    if (cachedEntry && cachedEntry.mtimeMs === sessionStat.mtimeMs && cachedEntry.size === sessionStat.size) {
        return cachedEntry.percent;
    }
    let parsedPercent = null;
    try {
        parsedPercent = await readLatestContextUsagePercentFromSessionFile(normalizedSessionPath, sessionStat.size);
    }
    catch {
        parsedPercent = null;
    }
    threadContextUsageCacheByPath.set(normalizedSessionPath, {
        mtimeMs: sessionStat.mtimeMs,
        size: sessionStat.size,
        percent: parsedPercent,
    });
    return parsedPercent;
}
/**
 * 线程上下文使用率读取器：
 * - 读取 thread 对应 session 文件中的最新 token_count；
 * - 输出与 CLI 一致口径的 `context usage` 百分比。
 */
class ThreadContextUsageReader {
    /**
     * 从 session 文件路径读取上下文使用率（百分比）。
     */
    async readUsagePercent(sessionPath) {
        return readThreadContextUsagePercentFromSessionPath(sessionPath);
    }
}
exports.ThreadContextUsageReader = ThreadContextUsageReader;
/**
 * 测试专用：清空缓存，避免 case 间互相污染。
 */
function clearThreadContextUsageCacheForTest() {
    threadContextUsageCacheByPath.clear();
}
//# sourceMappingURL=threadContextUsage.js.map