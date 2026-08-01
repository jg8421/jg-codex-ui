"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractContextUsagePercentFromPayload = extractContextUsagePercentFromPayload;
/**
 * 直接提供“上下文使用率百分比”的候选字段。
 */
const DIRECT_PERCENT_PATHS = [
    ["params", "context_usage_percent"],
    ["params", "contextUsagePercent"],
    ["context_usage_percent"],
    ["contextUsagePercent"],
    ["params", "metrics", "context_usage_percent"],
    ["metrics", "context_usage_percent"],
];
/**
 * 单次请求的总 token 数（`input + output`）候选字段。
 * 说明：上下文使用率优先以“输入上下文（prompt/input）”衡量；当缺失时可用 `total - output` 推导。
 */
const TOTAL_TOKENS_PATHS = [
    ["params", "usage", "total_tokens"],
    ["params", "token_usage", "total_tokens"],
    ["params", "tokenUsage", "totalTokens"],
    ["params", "result", "usage", "total_tokens"],
    ["params", "result", "token_usage", "total_tokens"],
    ["params", "result", "tokenUsage", "totalTokens"],
    ["params", "metrics", "usage", "total_tokens"],
    ["params", "metrics", "token_usage", "total_tokens"],
    ["params", "response", "usage", "total_tokens"],
    ["params", "response", "token_usage", "total_tokens"],
    ["params", "response", "tokenUsage", "totalTokens"],
    ["usage", "total_tokens"],
    ["token_usage", "total_tokens"],
    ["tokenUsage", "totalTokens"],
    ["result", "usage", "total_tokens"],
    ["result", "token_usage", "total_tokens"],
    ["result", "tokenUsage", "totalTokens"],
    ["metrics", "usage", "total_tokens"],
    ["metrics", "token_usage", "total_tokens"],
    ["params", "turn", "usage", "total_tokens"],
    ["turn", "usage", "total_tokens"],
    ["params", "response", "usage", "total_tokens"],
    ["response", "usage", "total_tokens"],
];
/**
 * 剩余 context token 数候选字段。
 */
const REMAINING_TOKENS_PATHS = [
    ["params", "remaining_context_tokens"],
    ["params", "remainingContextTokens"],
    ["params", "remaining_context_capacity_tokens"],
    ["params", "remainingContextCapacityTokens"],
    ["remaining_context_tokens"],
    ["remainingContextTokens"],
    ["remaining_context_capacity_tokens"],
    ["remainingContextCapacityTokens"],
    ["params", "context", "remaining_tokens"],
    ["params", "context", "remainingTokens"],
    ["params", "context", "remaining_context_tokens"],
    ["params", "context", "remainingContextTokens"],
    ["context", "remaining_tokens"],
    ["context", "remainingTokens"],
    ["context", "remaining_context_tokens"],
    ["context", "remainingContextTokens"],
    ["params", "metrics", "remaining_context_tokens"],
    ["params", "metrics", "remainingContextTokens"],
    ["metrics", "remaining_context_tokens"],
    ["metrics", "remainingContextTokens"],
    ["params", "result", "remaining_context_tokens"],
    ["params", "result", "remainingContextTokens"],
    ["result", "remaining_context_tokens"],
    ["result", "remainingContextTokens"],
];
/**
 * 模型 context window 容量候选字段。
 */
const CONTEXT_WINDOW_PATHS = [
    ["params", "context_window"],
    ["params", "contextWindow"],
    ["params", "context_window_tokens"],
    ["params", "contextWindowTokens"],
    // app-server v2: ThreadTokenUsageUpdatedNotification / codex/event/token_count
    ["params", "tokenUsage", "modelContextWindow"],
    ["params", "tokenUsage", "model_context_window"],
    ["params", "token_usage", "model_context_window"],
    ["params", "msg", "info", "model_context_window"],
    ["params", "info", "model_context_window"],
    ["context_window"],
    ["contextWindow"],
    ["context_window_tokens"],
    ["contextWindowTokens"],
    ["params", "model_context_window"],
    ["params", "modelContextWindow"],
    ["model_context_window"],
    ["modelContextWindow"],
    ["params", "metrics", "context_window"],
    ["params", "metrics", "contextWindow"],
    ["params", "metrics", "context_window_tokens"],
    ["params", "metrics", "contextWindowTokens"],
    ["metrics", "context_window"],
    ["metrics", "contextWindow"],
    ["metrics", "context_window_tokens"],
    ["metrics", "contextWindowTokens"],
    ["params", "result", "context_window"],
    ["params", "result", "contextWindow"],
    ["result", "context_window"],
    ["result", "contextWindow"],
];
/**
 * 输入 token 候选路径（用于 total_tokens 缺失时退化求和）。
 */
const INPUT_TOKENS_PATHS = [
    ["params", "usage", "input_tokens"],
    ["params", "usage", "prompt_tokens"],
    ["params", "usage", "inputTokens"],
    ["params", "usage", "promptTokens"],
    // app-server v2: ThreadTokenUsageUpdatedNotification / codex/event/token_count
    ["params", "tokenUsage", "last", "inputTokens"],
    ["params", "tokenUsage", "last", "input_tokens"],
    ["params", "token_usage", "last", "input_tokens"],
    ["params", "tokenUsage", "total", "inputTokens"],
    ["params", "tokenUsage", "total", "input_tokens"],
    ["params", "token_usage", "total", "input_tokens"],
    ["params", "msg", "info", "last_token_usage", "input_tokens"],
    ["params", "msg", "info", "lastTokenUsage", "inputTokens"],
    ["params", "info", "last_token_usage", "input_tokens"],
    ["params", "info", "lastTokenUsage", "inputTokens"],
    ["params", "msg", "info", "total_token_usage", "input_tokens"],
    ["params", "msg", "info", "totalTokenUsage", "inputTokens"],
    ["params", "info", "total_token_usage", "input_tokens"],
    ["params", "info", "totalTokenUsage", "inputTokens"],
    ["params", "result", "usage", "input_tokens"],
    ["params", "result", "usage", "prompt_tokens"],
    ["params", "response", "usage", "input_tokens"],
    ["params", "response", "usage", "prompt_tokens"],
    ["usage", "input_tokens"],
    ["usage", "prompt_tokens"],
    ["usage", "inputTokens"],
    ["usage", "promptTokens"],
];
/**
 * 输出 token 候选路径（用于 total_tokens 缺失时退化求和）。
 */
const OUTPUT_TOKENS_PATHS = [
    ["params", "usage", "output_tokens"],
    ["params", "usage", "completion_tokens"],
    ["params", "usage", "outputTokens"],
    ["params", "usage", "completionTokens"],
    ["params", "result", "usage", "output_tokens"],
    ["params", "result", "usage", "completion_tokens"],
    ["params", "response", "usage", "output_tokens"],
    ["params", "response", "usage", "completion_tokens"],
    ["usage", "output_tokens"],
    ["usage", "completion_tokens"],
    ["usage", "outputTokens"],
    ["usage", "completionTokens"],
];
/**
 * 判断值是否为普通对象，避免把 `null`/数组误判为可索引对象。
 */
function isPlainRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/**
 * 将数字或数字字符串解析为有限数字；支持百分号后缀字符串。
 */
function parseNumberLike(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value !== "string")
        return null;
    const normalizedValue = value.trim();
    if (!normalizedValue)
        return null;
    const strippedValue = normalizedValue.endsWith("%") ? normalizedValue.slice(0, -1).trim() : normalizedValue;
    if (!strippedValue)
        return null;
    const parsedValue = Number(strippedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
}
/**
 * 按路径读取对象中的字段值；路径不存在时返回 `null`。
 */
function readValueByPath(input, pathSegments) {
    let currentValue = input;
    for (const segment of pathSegments) {
        if (!isPlainRecord(currentValue))
            return null;
        if (!(segment in currentValue))
            return null;
        currentValue = currentValue[segment];
    }
    return currentValue;
}
/**
 * 从多条路径里读取第一个可解析为数字的字段。
 */
function pickFirstNumberByPaths(input, candidatePaths) {
    for (const pathSegments of candidatePaths) {
        const value = readValueByPath(input, pathSegments);
        const parsedNumber = parseNumberLike(value);
        if (parsedNumber !== null)
            return parsedNumber;
    }
    return null;
}
/**
 * 在路径语义匹配前提下，从未知层级结构里兜底提取 usage/context 指标。
 */
function scanMetricsFallback(input, pathSegments, visitedNodes, outMetrics) {
    const parsedNumber = parseNumberLike(input);
    if (parsedNumber !== null && pathSegments.length) {
        const key = pathSegments[pathSegments.length - 1].toLowerCase();
        const normalizedPath = pathSegments.map((segment) => segment.toLowerCase()).join(".");
        const hasContextHint = normalizedPath.includes("context");
        const hasUsageHint = normalizedPath.includes("usage") || normalizedPath.includes("token");
        // cached_input_tokens / cachedInputTokens 是“子集计数”，不应作为 prompt/input tokens 使用。
        const isCachedTokenCounter = key.includes("cached");
        if (outMetrics.directPercent === null && hasContextHint && (key.includes("usage") || key.includes("percent") || key.includes("ratio"))) {
            outMetrics.directPercent = parsedNumber;
            return;
        }
        if (outMetrics.promptTokens === null &&
            (hasUsageHint || hasContextHint) &&
            !isCachedTokenCounter &&
            (key.includes("input_tokens") ||
                key.includes("prompt_tokens") ||
                key.includes("inputtokens") ||
                key.includes("prompttokens") ||
                key.includes("context_tokens") ||
                key.includes("contexttokens"))) {
            outMetrics.promptTokens = parsedNumber;
            return;
        }
        if (outMetrics.remainingTokens === null &&
            hasContextHint &&
            (key.includes("remaining_context_tokens") || key.includes("remainingcontexttokens") || key.includes("remaining_tokens") || key.includes("remainingtokens"))) {
            outMetrics.remainingTokens = parsedNumber;
            return;
        }
        if (outMetrics.contextWindowTokens === null &&
            hasContextHint &&
            (key.includes("context_window") || key.includes("contextwindow") || key.includes("context_window_tokens") || key.includes("contextwindowtokens"))) {
            outMetrics.contextWindowTokens = parsedNumber;
        }
        return;
    }
    if (!isPlainRecord(input) && !Array.isArray(input))
        return;
    if (isPlainRecord(input)) {
        if (visitedNodes.has(input))
            return;
        visitedNodes.add(input);
        for (const [key, value] of Object.entries(input)) {
            scanMetricsFallback(value, [...pathSegments, key], visitedNodes, outMetrics);
        }
        return;
    }
    for (let index = 0; index < input.length; index += 1) {
        scanMetricsFallback(input[index], [...pathSegments, String(index)], visitedNodes, outMetrics);
    }
}
/**
 * 把任意比例值统一归一化到 0..100 百分比，并保留一位小数。
 */
function normalizePercentValue(rawPercentValue) {
    if (!Number.isFinite(rawPercentValue))
        return null;
    if (rawPercentValue < 0)
        return null;
    // 兼容 0..1 比例值与 0..100 百分比值。
    const percentValue = rawPercentValue <= 1 ? rawPercentValue * 100 : rawPercentValue;
    const clampedPercentValue = Math.min(100, percentValue);
    return Math.round(clampedPercentValue * 10) / 10;
}
/**
 * 提取 websocket `event.payload.method` 字段；无 method 时返回 `null`。
 */
function extractPayloadMethod(payload) {
    const rawMethodValue = readValueByPath(payload, ["method"]);
    if (typeof rawMethodValue !== "string")
        return null;
    const normalizedMethod = rawMethodValue.trim();
    return normalizedMethod || null;
}
/**
 * 判断 websocket 事件 method 是否属于 token/context usage 相关事件。
 *
 * 说明：对“非 token 事件”跳过启发式解析，避免把无关数值误判成 100%。
 */
function isTokenUsageRelatedMethod(method) {
    const normalizedMethod = method.toLowerCase();
    return normalizedMethod.includes("token") || normalizedMethod.includes("context_usage");
}
/**
 * 从 payload 中读取“输入上下文 token 数”（prompt/input tokens）。
 * 说明：该数值更接近 Codex CLI 展示的 context usage 口径。
 */
function extractPromptTokens(payload) {
    // 优先取 input/prompt tokens（上下文占用）。
    const promptTokens = pickFirstNumberByPaths(payload, INPUT_TOKENS_PATHS);
    if (promptTokens !== null && promptTokens >= 0)
        return promptTokens;
    // 兜底：当只有 total/output 时，用 `total - output` 推导 prompt。
    const totalTokens = pickFirstNumberByPaths(payload, TOTAL_TOKENS_PATHS);
    const outputTokens = pickFirstNumberByPaths(payload, OUTPUT_TOKENS_PATHS);
    if (totalTokens !== null && outputTokens !== null && totalTokens >= 0 && outputTokens >= 0 && totalTokens >= outputTokens) {
        return totalTokens - outputTokens;
    }
    return null;
}
/**
 * 从 payload 中读取“剩余 context token 数”。
 */
function extractRemainingTokens(payload) {
    const remainingTokens = pickFirstNumberByPaths(payload, REMAINING_TOKENS_PATHS);
    if (remainingTokens === null)
        return null;
    return remainingTokens >= 0 ? remainingTokens : null;
}
/**
 * 从 payload 中读取“context window 总容量”。
 */
function extractContextWindowTokens(payload) {
    const contextWindowTokens = pickFirstNumberByPaths(payload, CONTEXT_WINDOW_PATHS);
    if (contextWindowTokens === null)
        return null;
    return contextWindowTokens > 0 ? contextWindowTokens : null;
}
/**
 * 从 app-server v2 `ThreadTokenUsageUpdatedNotification` 结构里提取上下文使用率（百分比）。
 *
 * Codex CLI 的上下文使用率口径更接近：`last.inputTokens / modelContextWindow`。
 * 当 `last` 缺失时，再回退 `total` 兼容旧结构。
 */
function extractContextUsagePercentFromThreadTokenUsage(payload) {
    // 注意：`inputTokens` 已包含 `cachedInputTokens`（cached 为子集计数），不能相加。
    const lastInputTokens = pickFirstNumberByPaths(payload, [
        ["params", "tokenUsage", "last", "inputTokens"],
        ["params", "tokenUsage", "last", "input_tokens"],
        ["params", "token_usage", "last", "input_tokens"],
    ]);
    const totalInputTokens = pickFirstNumberByPaths(payload, [
        ["params", "tokenUsage", "total", "inputTokens"],
        ["params", "tokenUsage", "total", "input_tokens"],
        ["params", "token_usage", "total", "input_tokens"],
    ]);
    const inputTokens = lastInputTokens ?? totalInputTokens;
    if (inputTokens === null || inputTokens < 0)
        return null;
    const contextWindowTokens = pickFirstNumberByPaths(payload, [
        ["params", "tokenUsage", "modelContextWindow"],
        ["params", "tokenUsage", "model_context_window"],
        ["params", "token_usage", "model_context_window"],
    ]);
    if (contextWindowTokens === null || contextWindowTokens <= 0)
        return null;
    // input tokens 不应超过 context window；若超过，说明匹配到了错误字段，直接放弃避免误报 100%。
    if (inputTokens > contextWindowTokens)
        return null;
    return normalizePercentValue((inputTokens / contextWindowTokens) * 100);
}
/**
 * 从 `codex/event/token_count` 结构里提取上下文使用率（百分比）。
 *
 * Session `.jsonl` 中 `token_count` 字段优先级：
 * 1) `last_token_usage.input_tokens`；
 * 2) `total_token_usage.input_tokens`（兼容回退）；
 * 3) 分母统一 `model_context_window`。
 */
function extractContextUsagePercentFromTokenCountEvent(payload) {
    const inputTokens = pickFirstNumberByPaths(payload, [
        ["params", "msg", "info", "last_token_usage", "input_tokens"],
        ["params", "msg", "info", "lastTokenUsage", "inputTokens"],
        ["params", "info", "last_token_usage", "input_tokens"],
        ["params", "info", "lastTokenUsage", "inputTokens"],
        ["params", "msg", "info", "total_token_usage", "input_tokens"],
        ["params", "msg", "info", "totalTokenUsage", "inputTokens"],
        ["params", "info", "total_token_usage", "input_tokens"],
        ["params", "info", "totalTokenUsage", "inputTokens"],
    ]);
    if (inputTokens === null || inputTokens < 0)
        return null;
    const contextWindowTokens = pickFirstNumberByPaths(payload, [
        ["params", "msg", "info", "model_context_window"],
        ["params", "info", "model_context_window"],
    ]);
    if (contextWindowTokens === null || contextWindowTokens <= 0)
        return null;
    if (inputTokens > contextWindowTokens)
        return null;
    return normalizePercentValue((inputTokens / contextWindowTokens) * 100);
}
/**
 * 从 websocket 事件 payload 中提取上下文使用率（百分比）。
 *
 * 口径优先级：
 * 1) 非 token 相关 method 直接跳过（避免误判）；
 * 2) 直接百分比字段；
 * 3) app-server v2 tokenUsage/token_count：`last_input_tokens / model_context_window`（缺失时回退 total）；
 * 4) 非 websocket `event` 包装时，才启用 prompt/remaining/context 的启发式回退。
 */
function extractContextUsagePercentFromPayload(payload) {
    const payloadMethod = extractPayloadMethod(payload);
    if (payloadMethod && !isTokenUsageRelatedMethod(payloadMethod)) {
        return null;
    }
    const directPercent = pickFirstNumberByPaths(payload, DIRECT_PERCENT_PATHS);
    if (directPercent !== null)
        return normalizePercentValue(directPercent);
    const v2TokenUsagePercent = extractContextUsagePercentFromThreadTokenUsage(payload);
    if (v2TokenUsagePercent !== null)
        return v2TokenUsagePercent;
    const tokenCountPercent = extractContextUsagePercentFromTokenCountEvent(payload);
    if (tokenCountPercent !== null)
        return tokenCountPercent;
    // websocket `event` 包装里 method 存在时，仅信任显式 token 字段，避免启发式分支误判。
    if (payloadMethod)
        return null;
    const promptTokens = extractPromptTokens(payload);
    const contextWindowTokens = extractContextWindowTokens(payload);
    if (promptTokens !== null && contextWindowTokens !== null && contextWindowTokens > 0) {
        // prompt tokens 不应超过 context window；若超过，说明匹配到了错误字段，跳过该分支避免误报 100%。
        if (promptTokens <= contextWindowTokens) {
            return normalizePercentValue((promptTokens / contextWindowTokens) * 100);
        }
    }
    const remainingTokens = extractRemainingTokens(payload);
    if (promptTokens !== null && remainingTokens !== null) {
        const totalCapacityTokens = promptTokens + remainingTokens;
        if (totalCapacityTokens > 0) {
            return normalizePercentValue((promptTokens / totalCapacityTokens) * 100);
        }
    }
    if (contextWindowTokens !== null && remainingTokens !== null && contextWindowTokens > 0 && remainingTokens >= 0 && remainingTokens <= contextWindowTokens) {
        const derivedPromptTokens = contextWindowTokens - remainingTokens;
        return normalizePercentValue((derivedPromptTokens / contextWindowTokens) * 100);
    }
    // 字段层级不稳定时的兜底：只提取 context/token 语义明确的指标。
    const fallbackMetrics = {
        directPercent: null,
        promptTokens: null,
        remainingTokens: null,
        contextWindowTokens: null,
    };
    scanMetricsFallback(payload, [], new Set(), fallbackMetrics);
    if (fallbackMetrics.directPercent !== null) {
        const fallbackDirectPercent = normalizePercentValue(fallbackMetrics.directPercent);
        if (fallbackDirectPercent !== null)
            return fallbackDirectPercent;
    }
    if (fallbackMetrics.promptTokens !== null && fallbackMetrics.contextWindowTokens !== null && fallbackMetrics.contextWindowTokens > 0) {
        if (fallbackMetrics.promptTokens <= fallbackMetrics.contextWindowTokens) {
            return normalizePercentValue((fallbackMetrics.promptTokens / fallbackMetrics.contextWindowTokens) * 100);
        }
    }
    if (fallbackMetrics.promptTokens !== null && fallbackMetrics.remainingTokens !== null) {
        const fallbackCapacityTokens = fallbackMetrics.promptTokens + fallbackMetrics.remainingTokens;
        if (fallbackCapacityTokens > 0) {
            return normalizePercentValue((fallbackMetrics.promptTokens / fallbackCapacityTokens) * 100);
        }
    }
    if (fallbackMetrics.contextWindowTokens !== null &&
        fallbackMetrics.remainingTokens !== null &&
        fallbackMetrics.contextWindowTokens > 0 &&
        fallbackMetrics.remainingTokens >= 0 &&
        fallbackMetrics.remainingTokens <= fallbackMetrics.contextWindowTokens) {
        const derivedPromptTokens = fallbackMetrics.contextWindowTokens - fallbackMetrics.remainingTokens;
        return normalizePercentValue((derivedPromptTokens / fallbackMetrics.contextWindowTokens) * 100);
    }
    return null;
}
//# sourceMappingURL=contextUsageProjector.js.map