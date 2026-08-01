"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSystemToolCallSummary = parseSystemToolCallSummary;
exports.buildSystemToolCallSummaryPreview = buildSystemToolCallSummaryPreview;
/**
 * 阶段标题前缀：支持 `• xxx` / `- xxx` / `1. xxx`。
 */
const STAGE_PREFIX_REGEXP = /^(?:[•●▪◦*-]|\d+\.)\s+/u;
/**
 * 子步骤前缀：支持 `↳ xxx`、`-> xxx`、`└ xxx` 等。
 */
const STEP_PREFIX_REGEXP = /^(?:↳|->|=>|›|└|├|-)\s+/u;
/**
 * 状态行常见前缀（用于降低误判）。
 */
const STATUS_LINE_PREFIX_REGEXP = /^(?:planning|inspecting|exploring|search(?:ing)?|running|thinking|analyzing|executing)\b/i;
/**
 * 子步骤常见动作前缀：覆盖无箭头但语义明确的工具调用行。
 */
const STEP_ACTION_PREFIX_REGEXP = /^(?:read|search|searched|inspect|inspected|explore|explored|write|wrote|edit|edited|run|ran|execute|executed|open|click|find|grep|rg|cat)\b/i;
/**
 * 归一化单行文本：统一 tab，并去掉尾部空白。
 */
function normalizeLine(rawLine) {
    return rawLine.replace(/\t/g, "  ").replace(/\s+$/u, "");
}
/**
 * 去掉阶段前缀并返回正文；无法匹配时返回空串。
 */
function extractStageTitle(line) {
    if (!STAGE_PREFIX_REGEXP.test(line))
        return "";
    return line.replace(STAGE_PREFIX_REGEXP, "").trim();
}
/**
 * 去掉子步骤前缀并返回正文；无法匹配时返回空串。
 */
function extractStepText(line) {
    if (!STEP_PREFIX_REGEXP.test(line))
        return "";
    return line.replace(STEP_PREFIX_REGEXP, "").trim();
}
/**
 * 尝试把 system 文本解析为 CLI 风格的工具调用摘要。
 * 若结构不明显，返回 `null` 并由上层回退到普通文本渲染。
 */
function parseSystemToolCallSummary(text) {
    const normalizedText = String(text ?? "").replace(/\r\n/g, "\n").trim();
    if (!normalizedText)
        return null;
    const sourceLines = normalizedText.split("\n");
    const parsedStages = [];
    const parsedStatusLines = [];
    // currentStage：当前正在填充的阶段；只有遇到阶段标题后才会有值。
    let currentStage = null;
    // totalStepCount：统计子步骤总数，用于“是否值得结构化展示”的判定。
    let totalStepCount = 0;
    for (const rawLine of sourceLines) {
        const normalizedLine = normalizeLine(rawLine);
        const trimmedLine = normalizedLine.trim();
        if (!trimmedLine)
            continue;
        // hasLeadingIndent：用于区分“顶层阶段”与“阶段内子步骤”。
        const hasLeadingIndent = /^\s+/u.test(normalizedLine);
        const stageTitle = !hasLeadingIndent ? extractStageTitle(trimmedLine) : "";
        if (stageTitle) {
            const stage = { title: stageTitle, steps: [] };
            parsedStages.push(stage);
            currentStage = stage;
            continue;
        }
        const stepText = extractStepText(trimmedLine);
        if (stepText && currentStage) {
            currentStage.steps.push(stepText);
            totalStepCount += 1;
            continue;
        }
        if (hasLeadingIndent && currentStage) {
            currentStage.steps.push(trimmedLine);
            totalStepCount += 1;
            continue;
        }
        if (currentStage && STEP_ACTION_PREFIX_REGEXP.test(trimmedLine)) {
            currentStage.steps.push(trimmedLine);
            totalStepCount += 1;
            continue;
        }
        parsedStatusLines.push(trimmedLine);
        currentStage = null;
    }
    if (!parsedStages.length)
        return null;
    // 仅有“普通列表”时不启用结构化展示，避免误伤 system 的普通 Markdown。
    const hasLikelyStatusLine = parsedStatusLines.some((statusLine) => STATUS_LINE_PREFIX_REGEXP.test(statusLine));
    if (totalStepCount <= 0 && !hasLikelyStatusLine)
        return null;
    return { stages: parsedStages, statusLines: parsedStatusLines };
}
/**
 * 生成折叠态单行预览文本，避免结构化内容退化成冗长纯文本。
 */
function buildSystemToolCallSummaryPreview(summary) {
    const firstStageTitle = summary.stages[0]?.title?.trim() || "工具调用";
    const totalStepCount = summary.stages.reduce((count, stage) => count + stage.steps.length, 0);
    const stageCount = summary.stages.length;
    const countPreview = totalStepCount > 0 ? `${totalStepCount} 条操作` : `${stageCount} 个阶段`;
    const statusPreview = summary.statusLines[0]?.trim();
    if (!statusPreview)
        return `${firstStageTitle} · ${countPreview}`;
    return `${firstStageTitle} · ${countPreview} · ${statusPreview}`;
}
//# sourceMappingURL=systemToolCallSummary.js.map