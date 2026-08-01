"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCommitSummaryOverviewLines = extractCommitSummaryOverviewLines;
exports.buildNormalizedCommitSummaryText = buildNormalizedCommitSummaryText;
exports.extractCommitSummaryMessage = extractCommitSummaryMessage;
/**
 * 判断 assistant 文本是否更像“过程说明/计划更新”，而不是最终提交信息。
 */
function isProcessStyleCommitSummary(input) {
    // firstLine：候选首行，用于快速识别“我将先…”这类过程说明。
    const firstLine = String(input.firstLine ?? "").trim();
    // fullText：完整总结文本，用于识别 plan/todo 标记。
    const fullText = String(input.fullText ?? "");
    if (!firstLine)
        return true;
    if (/^(?:我将|我会|我先|接下来|随后|下面我将|先(?:读取|查看|检查|核对|分析|梳理|确认|提取)|正在)/.test(firstLine)) {
        return true;
    }
    if (/最后给出可直接使用的中文 commit message/i.test(firstLine)) {
        return true;
    }
    if (/^(?:-|\*|\d+[.)])\s*\((?:pending|in_progress|completed)\)/im.test(fullText)) {
        return true;
    }
    return false;
}
const MAX_OVERVIEW_LINE_LENGTH = 40;
/**
 * 去掉 ANSI 样式控制符，避免 transcript 彩色输出影响后续分段与文本提取。
 */
function stripAnsiControlCodes(text) {
    // normalizedText：统一转字符串，兼容 undefined/null。
    const normalizedText = String(text ?? "");
    return normalizedText.replace(/\u001b\[[0-9;]*m/g, "");
}
/**
 * 规范化 transcript 单行文本，便于识别 speaker 标记。
 */
function normalizeCliTranscriptLine(line) {
    // strippedLine：先移除 ANSI 样式码。
    const strippedLine = stripAnsiControlCodes(line);
    return strippedLine.trim();
}
/**
 * 识别 codex CLI transcript 中的 speaker 行。
 */
function resolveCliTranscriptSpeaker(line) {
    // normalizedLine：转成小写后做精确匹配。
    const normalizedLine = normalizeCliTranscriptLine(line).toLowerCase();
    if (normalizedLine === "user")
        return "user";
    if (normalizedLine === "codex")
        return "codex";
    if (normalizedLine === "exec")
        return "exec";
    return null;
}
/**
 * 从 codex CLI transcript 中提取所有 assistant（`codex`）段文本。
 *
 * 说明：
 * - 一旦识别到 transcript speaker，就只保留 `codex` 段；
 * - `user` 提示词、`exec` 命令输出、顶部 metadata 都会被排除；
 * - 返回顺序与 transcript 一致，调用方可自行决定从后往前解析。
 */
function extractCodexCliAssistantTexts(rawText) {
    // rawLines：保留原始顺序，按行扫描 transcript。
    const rawLines = String(rawText ?? "").replace(/\r\n/g, "\n").split("\n");
    // assistantTexts：累积得到的 codex assistant 段。
    const assistantTexts = [];
    // sawTranscriptSpeaker：是否至少识别到过一个 transcript speaker。
    let sawTranscriptSpeaker = false;
    // currentSpeaker：当前正在累积的段所属 speaker。
    let currentSpeaker = null;
    // currentLines：当前段正文。
    let currentLines = [];
    /**
     * 将当前段在切换 speaker 时落盘。
     */
    function flushCurrentSection() {
        // sectionText：当前段拼接后的正文。
        const sectionText = currentLines.join("\n").trim();
        if (currentSpeaker === "codex" && sectionText) {
            assistantTexts.push(sectionText);
        }
        currentLines = [];
    }
    for (const rawLine of rawLines) {
        // speaker：如果当前行是 speaker 标记，则开始新段。
        const speaker = resolveCliTranscriptSpeaker(rawLine);
        if (speaker) {
            sawTranscriptSpeaker = true;
            flushCurrentSection();
            currentSpeaker = speaker;
            continue;
        }
        // transcript 头部 metadata（例如 workdir/model）在出现 speaker 之前全部忽略。
        if (!sawTranscriptSpeaker || !currentSpeaker) {
            continue;
        }
        // normalizedContentLine：段正文同样去掉 ANSI，避免彩色字符污染解析。
        const normalizedContentLine = stripAnsiControlCodes(rawLine).trimEnd();
        currentLines.push(normalizedContentLine);
    }
    flushCurrentSection();
    return sawTranscriptSpeaker ? assistantTexts : [];
}
/**
 * 为总结解析构造候选文本列表。
 *
 * 说明：
 * - 普通输出：直接使用原始文本；
 * - CLI transcript：只使用 `codex` assistant 段，并按“最后一段优先”返回。
 */
function resolveCommitSummaryCandidateTexts(rawText) {
    // assistantTexts：从 transcript 中切出的 codex 段。
    const assistantTexts = extractCodexCliAssistantTexts(rawText);
    if (assistantTexts.length) {
        return [...assistantTexts].reverse();
    }
    return [String(rawText ?? "")];
}
/**
 * 尝试从模型输出中提取 JSON 文本，兼容纯 JSON 与 ```json 代码块。
 */
function extractJsonText(rawText) {
    // normalizedText：统一换行并去掉首尾空白。
    const normalizedText = String(rawText ?? "").replace(/\r\n/g, "\n").trim();
    if (!normalizedText)
        return "";
    // fencedMatch：优先识别 ```json 代码块。
    const fencedMatch = normalizedText.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    if (fencedMatch) {
        return String(fencedMatch[1] ?? "").trim();
    }
    if (normalizedText.startsWith("{") && normalizedText.endsWith("}")) {
        return normalizedText;
    }
    // embeddedJson：兜底从混合输出中提取第一个完整 JSON 对象（用于兼容 stdout/stderr 夹杂 warning/banner 的情况）。
    const embeddedJson = extractFirstJsonObjectFromText(normalizedText);
    if (embeddedJson)
        return embeddedJson;
    return "";
}
/**
 * 从混合文本中提取第一个“完整 JSON 对象”子串（best-effort）。
 *
 * 说明：
 * - 只处理 JSON object（以 `{` 开始），不尝试提取数组/原始值；
 * - 支持字符串转义与嵌套对象/数组；
 * - 用于从 stderr 或混杂日志输出中恢复 `{"message":...,"overview":[...]}` 这类协议。
 */
function extractFirstJsonObjectFromText(text) {
    // normalized：规整输入，避免空串与异常换行。
    const normalized = String(text ?? "").replace(/\r\n/g, "\n");
    if (!normalized)
        return "";
    // startIndex：从每个 `{` 位置尝试做一次括号匹配，找到第一个可解析对象。
    for (let startIndex = normalized.indexOf("{"); startIndex >= 0; startIndex = normalized.indexOf("{", startIndex + 1)) {
        // depth：`{`/`}` 嵌套深度；到 0 表示对象结束。
        let depth = 0;
        // inString：是否处于 JSON 字符串字面量内部。
        let inString = false;
        // escaped：上一字符是否为反斜杠转义符。
        let escaped = false;
        for (let index = startIndex; index < normalized.length; index += 1) {
            const ch = normalized[index] ?? "";
            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === "\\") {
                    escaped = true;
                    continue;
                }
                if (ch === "\"") {
                    inString = false;
                }
                continue;
            }
            if (ch === "\"") {
                inString = true;
                continue;
            }
            if (ch === "{") {
                depth += 1;
                continue;
            }
            if (ch === "}") {
                depth -= 1;
                if (depth === 0) {
                    const candidate = normalized.slice(startIndex, index + 1).trim();
                    if (!candidate)
                        break;
                    try {
                        const parsed = JSON.parse(candidate);
                        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                            return candidate;
                        }
                    }
                    catch {
                        // ignore：继续尝试下一个 `{` 起点
                    }
                    break;
                }
            }
        }
    }
    return "";
}
/**
 * 解析模型返回的 JSON 协议。
 */
function parseJsonCommitSummaryFromText(rawText) {
    // jsonText：候选 JSON 文本。
    const jsonText = extractJsonText(rawText);
    if (!jsonText)
        return null;
    try {
        // parsed：反序列化后的原始对象。
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return null;
        const record = parsed;
        // messageCandidate：兼容少量别名，但统一收敛到 message。
        const messageCandidate = String(record.message ?? record.commitMessage ?? record.title ?? "").trim();
        const message = normalizeCommitMessage(messageCandidate);
        if (!message)
            return null;
        // overviewRaw：优先读取数组；否则兼容单字符串。
        const overviewRaw = Array.isArray(record.overview)
            ? record.overview
            : typeof record.overview === "string"
                ? [record.overview]
                : Array.isArray(record.changeSummary)
                    ? record.changeSummary
                    : typeof record.changeSummary === "string"
                        ? [record.changeSummary]
                        : [];
        const overviewLines = overviewRaw
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
            .map((line) => normalizeOverviewLine(line))
            .filter(Boolean)
            .map((line) => `- ${line}`);
        return { message, overviewLines };
    }
    catch {
        return null;
    }
}
/**
 * 解析模型返回的 JSON 协议。
 */
function parseJsonCommitSummary(rawText) {
    // candidateTexts：普通输出直接取原文；transcript 只消费 codex 段。
    const candidateTexts = resolveCommitSummaryCandidateTexts(rawText);
    for (const candidateText of candidateTexts) {
        const parsedJson = parseJsonCommitSummaryFromText(candidateText);
        if (parsedJson)
            return parsedJson;
    }
    return null;
}
/**
 * 判断提交信息是否已符合 Conventional Commits 形式。
 */
function isConventionalCommitMessage(message) {
    return /^(?:feat|fix|docs|refactor|perf|test|build|ci|chore|revert)(?:\([^)]+\))?!?:\s+\S+/i.test(message);
}
/**
 * 根据自然语言前缀推断 Conventional Commits 类型。
 */
function inferCommitTypeFromMessage(message) {
    if (/^(?:修复|修正|解决|处理|避免|兜底)/.test(message))
        return "fix";
    if (/^(?:新增|添加|支持|实现|引入)/.test(message))
        return "feat";
    if (/^(?:文档|补充文档|更新文档|说明)/.test(message))
        return "docs";
    if (/^(?:重构|整理|优化结构)/.test(message))
        return "refactor";
    if (/^(?:测试|补充测试|完善测试)/.test(message))
        return "test";
    return "chore";
}
/**
 * 去掉自然语言句子中的说明性前缀与结尾标点，得到更适合提交标题的 subject。
 */
function normalizeCommitSubject(message) {
    // normalizedMessage：先做单行与空白压缩。
    const normalizedMessage = String(message ?? "")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalizedMessage)
        return "";
    // withoutLabel：去掉“建议提交信息”等冗余标签。
    const withoutLabel = normalizedMessage.replace(/^(?:建议提交信息|commit message|提交信息)\s*[：:]\s*/i, "").trim();
    // withoutPunctuation：去掉句尾标点，避免形成口语句子。
    const withoutPunctuation = withoutLabel.replace(/[。！？.!?；;，,：:]+$/g, "").trim();
    return withoutPunctuation;
}
/**
 * 将候选提交信息标准化为可直接用于 git commit 的单行文本。
 */
function normalizeCommitMessage(message) {
    // subjectCandidate：去掉标签、标点后的候选标题。
    const subjectCandidate = normalizeCommitSubject(message);
    if (!subjectCandidate)
        return "";
    if (isConventionalCommitMessage(subjectCandidate))
        return subjectCandidate;
    // commitType：从自然语言前缀推断 commit 类型。
    const commitType = inferCommitTypeFromMessage(subjectCandidate);
    // normalizedSubject：去掉与类型重复的中文动词，避免出现 `fix: 修复 xxx` 这种冗余。
    const normalizedSubject = subjectCandidate
        .replace(/^(?:修复|修正|解决|处理|避免|兜底)\s*/g, "")
        .replace(/^(?:新增|添加|支持|实现|引入)\s*/g, "")
        .replace(/^(?:文档|补充文档|更新文档|说明)\s*/g, "")
        .replace(/^(?:重构|整理|优化结构)\s*/g, "")
        .replace(/^(?:测试|补充测试|完善测试)\s*/g, "")
        .trim();
    return `${commitType}: ${normalizedSubject || subjectCandidate}`;
}
/**
 * 判断一行文本是否足够像“真正的提交标题”，而不是过程说明/执行痕迹。
 */
function isPotentialCommitMessageLine(line) {
    // normalizedLine：统一去掉首尾空白，便于规则判断。
    const normalizedLine = String(line ?? "").trim();
    if (!normalizedLine)
        return false;
    if (isConventionalCommitMessage(normalizedLine))
        return true;
    // 仅允许常见提交语义前缀进入自然语言兜底，避免把“读取/使用/检查”之类过程语句误转成 `chore: ...`。
    return /^(?:修复|修正|解决|处理|避免|兜底|新增|添加|支持|实现|引入|文档|补充文档|更新文档|说明|重构|整理|优化|测试|补充测试|完善测试|移除|删除|恢复|统一|同步|收紧|调整)/.test(normalizedLine);
}
/**
 * 将过长的概要行收敛成更短的摘要短句。
 */
function normalizeOverviewLine(line) {
    // normalizedLine：先去掉项目符号与收尾标点，统一空白。
    const normalizedLine = String(line ?? "")
        .replace(/^(?:-|\*|\d+[.)])\s*/g, "")
        .replace(/\s+/g, " ")
        .replace(/[。！？.!?；;，,：:]+$/g, "")
        .trim();
    if (!normalizedLine)
        return "";
    // sentenceParts：优先按语义分隔符取第一段，避免单条概述变成长段解释。
    const sentenceParts = normalizedLine
        .split(/[，,；;。！？.!?]|(?:并且|并|同时|以及|且|然后|避免|用于|以便)/)
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    const conciseLine = sentenceParts[0] ?? normalizedLine;
    if (conciseLine.length <= MAX_OVERVIEW_LINE_LENGTH)
        return conciseLine;
    return `${conciseLine.slice(0, MAX_OVERVIEW_LINE_LENGTH - 3).trim()}...`;
}
/**
 * 过滤掉过程性/空洞的正文行，只保留可展示的变更概要内容。
 */
function shouldKeepOverviewLine(line) {
    if (!line)
        return false;
    if (/^(?:建议提交信息|commit message|提交信息)\s*[：:]/i.test(line))
        return false;
    if (/^变更概要\s*[：:]*$/i.test(line))
        return false;
    if (/^(?:我将|我会|我先|接下来|随后|下面我将|先(?:读取|查看|检查|核对|分析|梳理|确认|提取)|正在)/.test(line))
        return false;
    if (/^(?:-|\*|\d+[.)])\s*\((?:pending|in_progress|completed)\)/i.test(line))
        return false;
    return true;
}
/**
 * 从 assistant 原文中提取“变更概要”正文行。
 */
function extractCommitSummaryOverviewLines(rawText) {
    // parsedJson：优先读取 JSON 协议中的结构化正文。
    const parsedJson = parseJsonCommitSummary(rawText);
    if (parsedJson?.overviewLines.length)
        return parsedJson.overviewLines;
    // candidateTexts：如果是 transcript，则只在 codex 段中找正文，避免 user/exec 污染。
    const candidateTexts = resolveCommitSummaryCandidateTexts(rawText);
    for (const candidateText of candidateTexts) {
        // text：当前候选总结文本。
        const text = String(candidateText ?? "").replace(/\r\n/g, "\n");
        // rawLines：保留行顺序，便于定位 heading 与正文。
        const rawLines = text.split("\n").map((line) => String(line ?? "").trim());
        // firstContentLine：正文中第一条非空行；heading 缺失时用于过滤过程说明。
        const firstContentLine = rawLines.find((line) => Boolean(line)) ?? "";
        // headingIndex：显式“变更概要”标题所在位置；未找到则为 -1。
        const headingIndex = rawLines.findIndex((line) => /^变更概要\s*[：:]*$/i.test(line));
        if (headingIndex < 0 && !isPotentialCommitMessageLine(firstContentLine))
            continue;
        // startIndex：正文起始位置；有 heading 时从 heading 下一行开始，否则跳过首个非空行（commit message）。
        const startIndex = headingIndex >= 0
            ? headingIndex + 1
            : Math.max(0, rawLines.findIndex((line) => Boolean(line)) + 1);
        const overviewLines = [];
        for (let index = startIndex; index < rawLines.length; index += 1) {
            // line：当前候选正文行。
            const line = rawLines[index] ?? "";
            if (!shouldKeepOverviewLine(line))
                continue;
            const normalizedOverviewLine = normalizeOverviewLine(line);
            if (!normalizedOverviewLine)
                continue;
            overviewLines.push(`- ${normalizedOverviewLine}`);
        }
        if (overviewLines.length)
            return overviewLines;
    }
    return [];
}
/**
 * 组装统一的 Git 总结展示文本，确保始终包含“变更概要”段落。
 */
function buildNormalizedCommitSummaryText(input) {
    // overviewLines：优先使用模型返回的正文；缺失时回退到服务端提供的补充概要。
    const overviewLines = extractCommitSummaryOverviewLines(input.rawText);
    const fallbackOverviewLines = Array.isArray(input.fallbackOverviewLines) ? input.fallbackOverviewLines.filter(Boolean) : [];
    const effectiveOverviewLines = overviewLines.length ? overviewLines : fallbackOverviewLines;
    if (!effectiveOverviewLines.length) {
        return `${input.message}\n\n变更概要：\n- 本次变更已完成总结，但模型未返回可展示的明细。`;
    }
    return `${input.message}\n\n变更概要：\n${effectiveOverviewLines.join("\n")}`;
}
/**
 * 从 assistant 的总结文本中提取“建议提交信息”。
 * 说明：
 * - 优先解析显式标签（例如：`建议提交信息：feat: xxx`）；
 * - 如果没有显式标签，则回退到首个非空行；
 * - 返回值始终为单行，便于直接回填到 commit message 输入框。
 */
function extractCommitSummaryMessage(rawText) {
    // parsedJson：优先读取结构化 JSON 协议。
    const parsedJson = parseJsonCommitSummary(rawText);
    if (parsedJson?.message)
        return parsedJson.message;
    // candidateTexts：普通输出直接取原文；transcript 只消费 codex 段。
    const candidateTexts = resolveCommitSummaryCandidateTexts(rawText);
    for (const candidateText of candidateTexts) {
        // text：当前候选 assistant 文本。
        const text = String(candidateText ?? "").replace(/\r\n/g, "\n");
        // lines：按行切分后的原始文本。
        const lines = text
            .split("\n")
            .map((line) => String(line ?? "").trim())
            .filter(Boolean);
        for (const line of lines) {
            // explicitMatch：优先识别“建议提交信息：...”这类显式格式。
            const explicitMatch = line.match(/^(?:建议提交信息|commit message|提交信息)\s*[：:]\s*(.+)$/i);
            if (!explicitMatch)
                continue;
            const message = String(explicitMatch[1] ?? "").trim();
            if (!message)
                continue;
            if (isProcessStyleCommitSummary({ firstLine: message, fullText: text }))
                continue;
            return normalizeCommitMessage(message);
        }
        // firstLine：无显式标签时，回退到首个非空行。
        const firstLine = lines[0] ?? "";
        if (!firstLine)
            continue;
        if (isProcessStyleCommitSummary({ firstLine, fullText: text }))
            continue;
        if (!isPotentialCommitMessageLine(firstLine))
            continue;
        return normalizeCommitMessage(firstLine);
    }
    return "";
}
//# sourceMappingURL=gitCommitSummaryResult.js.map