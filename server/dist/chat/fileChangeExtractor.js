"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countUnifiedDiffLineStats = countUnifiedDiffLineStats;
exports.countUnifiedDiffLineStatsWithKind = countUnifiedDiffLineStatsWithKind;
exports.extractFileChangesFromAny = extractFileChangesFromAny;
/**
 * 判断字符串是否为对象被隐式转字符串后的占位值。
 */
function isObjectStringPlaceholder(value) {
    return value.trim().toLowerCase() === "[object object]";
}
/**
 * 从候选值中提取可用字符串；无效时返回空串。
 */
function normalizeStringCandidate(raw) {
    if (typeof raw !== "string")
        return "";
    const value = raw.trim();
    if (!value || isObjectStringPlaceholder(value))
        return "";
    return value;
}
/**
 * 归一化行数值：非法值回退到 null；合法值收敛为非负整数。
 */
function normalizeLineCountCandidate(raw) {
    const parsedCount = Number(raw);
    if (!Number.isFinite(parsedCount))
        return null;
    return Math.max(0, Math.floor(parsedCount));
}
/**
 * 判断是否是 `--- ...` / `+++ ...` 这种“文件头路径行”。
 *
 * 说明：
 * - unified diff 只在“文件头区段”使用 `---`/`+++` 指示 old/new path；
 * - hunk 内也可能出现真实内容行 `+++ foo` / `--- bar`；
 * - 因此这里只判断“像不像文件头路径行”，真正是否当成 header，
 *   交由外层 `inHeaderSection` / header-pair 规则决定。
 */
function isLikelyUnifiedDiffFileHeaderLine(line) {
    const normalizedLine = String(line ?? "");
    if (!/^(---|\+\+\+)[ \t]/.test(normalizedLine))
        return false;
    // `--- ` / `+++ ` 之后的“路径”部分；允许后面跟 timestamp（tab 分隔）。
    const rest = normalizedLine.slice(4).trim();
    const pathPart = rest.split(/\t/)[0] ?? "";
    if (!pathPart)
        return false;
    // git 默认会输出 `a/`/`b/` 前缀，但某些上游也可能直接给 `--- foo.txt` / `+++ foo.txt`。
    // 这里宽松接收“`---`/`+++` + 非空路径”。
    return true;
}
/**
 * 判断当前位置是否为一对 `--- ...` + `+++ ...` 文件头行。
 *
 * 目的：
 * - 兼容某些上游输出仅包含 `---/+++` 文件头而缺少 `diff --git` 的多文件 diff；
 * - 避免把后续文件的 `---/+++` 头行误计为删除/新增。
 */
function isUnifiedDiffFileHeaderPair(lines, idx) {
    const firstLine = lines[idx] ?? "";
    const secondLine = lines[idx + 1] ?? "";
    if (!firstLine.startsWith("---"))
        return false;
    if (!secondLine.startsWith("+++"))
        return false;
    if (!isLikelyUnifiedDiffFileHeaderLine(firstLine) || !isLikelyUnifiedDiffFileHeaderLine(secondLine))
        return false;
    /**
     * 为了避免把正文里的 `--- bar` + `+++ foo`（真实删除/新增行）误认为文件头，
     * 进一步要求：header pair 之后的下一条“非空行”应当是 hunk 头或 meta 行。
     */
    for (let i = idx + 2; i < lines.length; i += 1) {
        const nextLine = String(lines[i] ?? "");
        if (!nextLine)
            continue;
        if (nextLine.startsWith("@@"))
            return true;
        if (nextLine.startsWith("index "))
            return true;
        if (nextLine.startsWith("new file mode "))
            return true;
        if (nextLine.startsWith("deleted file mode "))
            return true;
        if (nextLine.startsWith("old mode "))
            return true;
        if (nextLine.startsWith("new mode "))
            return true;
        if (nextLine.startsWith("similarity index "))
            return true;
        if (nextLine.startsWith("rename from "))
            return true;
        if (nextLine.startsWith("rename to "))
            return true;
        if (nextLine.startsWith("copy from "))
            return true;
        if (nextLine.startsWith("copy to "))
            return true;
        if (nextLine.startsWith("Binary files "))
            return true;
        if (nextLine.startsWith("GIT binary patch"))
            return true;
        if (nextLine.startsWith("diff --git "))
            return true;
        return false;
    }
    return false;
}
/**
 * 统计 unified diff 文本中的新增/删除行数（忽略 `+++`/`---` 头行）。
 */
function countUnifiedDiffLineStats(diffText) {
    return countUnifiedDiffLineStatsWithKind(diffText, undefined);
}
/**
 * 判断一段文本“像不像” unified diff。
 *
 * 说明：
 * - 我们只需要一个轻量启发式：用于区分“真正的 unified diff”与“仅文件内容”的纯文本；
 * - 纯文本场景常见于新增/删除文件：上游只给出文件内容，没有 `@@` / `diff --git` / `---/+++` 头。
 */
function looksLikeUnifiedDiffText(diffText) {
    const normalizedText = String(diffText ?? "");
    if (!normalizedText)
        return false;
    // hunk 头是最强信号。
    if (normalizedText.includes("\n@@") || normalizedText.startsWith("@@"))
        return true;
    // 多文件 diff 段落头。
    if (normalizedText.includes("\ndiff --git ") || normalizedText.startsWith("diff --git "))
        return true;
    // 文件头路径对（弱信号，但配合换行出现通常代表 unidiff）。
    if (normalizedText.includes("\n--- ") || normalizedText.startsWith("--- "))
        return true;
    if (normalizedText.includes("\n+++ ") || normalizedText.startsWith("+++ "))
        return true;
    return false;
}
/**
 * 统计纯文本的“真实行数”（去掉末尾因为 split 带来的空行）。
 */
function countRawTextLines(text) {
    const normalizedText = String(text ?? "");
    if (!normalizedText)
        return 0;
    const lines = normalizedText.replace(/\r\n/g, "\n").split("\n");
    // 末尾如果是空字符串，说明原文本以换行结尾；不应当把它当成一行内容。
    const lastLine = lines[lines.length - 1];
    const normalizedLines = lastLine === "" ? lines.slice(0, -1) : lines;
    return normalizedLines.length;
}
/**
 * 统计 diff 文本的新增/删除行数。
 *
 * 兼容两类输入：
 * 1. unified diff：按 `+` / `-` 变更行统计（忽略 `+++`/`---` 头行）。
 * 2. 纯文本（仅文件内容）：按文件变更类型(kind)兜底统计。
 */
function countUnifiedDiffLineStatsWithKind(diffText, changeKind) {
    const normalizedDiffText = String(diffText ?? "");
    if (!normalizedDiffText)
        return { addedLines: 0, deletedLines: 0 };
    // 非 unified diff 的纯文本：不要把内容里以 `-` 开头的行误判为删除行。
    if (!looksLikeUnifiedDiffText(normalizedDiffText)) {
        const rawLineCount = countRawTextLines(normalizedDiffText);
        const normalizedKind = String(changeKind ?? "").trim().toLowerCase();
        if (normalizedKind === "create" || normalizedKind === "add" || normalizedKind === "added" || normalizedKind === "new") {
            return { addedLines: rawLineCount, deletedLines: 0 };
        }
        if (normalizedKind === "delete" ||
            normalizedKind === "remove" ||
            normalizedKind === "removed" ||
            normalizedKind === "del") {
            return { addedLines: 0, deletedLines: rawLineCount };
        }
        return { addedLines: 0, deletedLines: 0 };
    }
    // 部分上游会把换行序列作为字面量 `\\n` 传入；统计前统一展开成真实换行。
    const normalizedNewlineText = normalizedDiffText.includes("\n")
        ? normalizedDiffText
        : normalizedDiffText.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
    const lines = normalizedNewlineText.replace(/\r\n/g, "\n").split("\n");
    /**
     * inHeaderSection：是否处于“文件头信息区段”（即 `diff --git` 到首个 `@@` 之间）。
     *
     * 目的：
     * - 只在 header 内忽略 `+++ b/...` / `--- a/...` 这类文件头路径行；
     * - 避免误伤 hunk 内真实内容行（例如新增内容为 `++ foo`，其 diff 行会是 `+++ foo`）。
     */
    let inHeaderSection = true;
    let addedLines = 0;
    let deletedLines = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        // `diff --git` 是新文件段落的起点：后续直到 `@@` 之前都视为 header。
        if (line.startsWith("diff --git ")) {
            inHeaderSection = true;
            continue;
        }
        // `@@ ... @@` 为 hunk 头：进入正文区段，后续 `+++ foo` / `--- bar` 必须按真实变更统计。
        if (line.startsWith("@@")) {
            inHeaderSection = false;
            continue;
        }
        // 兼容无 `diff --git` 的多文件 diff：在正文区段遇到新的 `---/+++` 文件头对时，切回 header。
        if (!inHeaderSection && isUnifiedDiffFileHeaderPair(lines, i)) {
            inHeaderSection = true;
        }
        // 仅在 header 区段忽略文件头路径行（收敛到 `a/`/`b/`/`/dev/null` 形态）。
        if (inHeaderSection && isLikelyUnifiedDiffFileHeaderLine(line))
            continue;
        if (line.startsWith("+")) {
            addedLines += 1;
            continue;
        }
        if (line.startsWith("-"))
            deletedLines += 1;
    }
    return { addedLines, deletedLines };
}
/**
 * 归一化文件路径，避免对象路径被渲染成 `[object Object]`。
 */
function normalizeFileChangePath(change) {
    // 常见路径来源字段，按优先级尝试。
    const rawPath = change.path ??
        change.file ??
        change.filename ??
        change.target?.path ??
        change.target?.file ??
        change.source?.path ??
        change.source?.file;
    const directPath = normalizeStringCandidate(rawPath);
    if (directPath)
        return directPath;
    if (rawPath && typeof rawPath === "object") {
        // 某些协议会把路径包在对象里，继续提取常见字段。
        const nestedPathObject = rawPath;
        const nestedPath = normalizeStringCandidate(nestedPathObject.path) ||
            normalizeStringCandidate(nestedPathObject.file) ||
            normalizeStringCandidate(nestedPathObject.filename) ||
            normalizeStringCandidate(nestedPathObject.value) ||
            normalizeStringCandidate(nestedPathObject.text);
        if (nestedPath)
            return nestedPath;
    }
    return "";
}
/**
 * 归一化文件变更类型，支持对象结构并提供稳定回退值。
 */
function normalizeFileChangeKind(change) {
    // 常见 kind/type 来源字段，优先使用顶层。
    const rawKind = change.kind ?? change.type ?? change.action ?? change.operation ?? change.op ?? change.status;
    const directKind = normalizeStringCandidate(rawKind);
    if (directKind)
        return directKind;
    if (rawKind && typeof rawKind === "object") {
        // kind 本身可能是对象，如 { type: "edit" }。
        const nestedKindObject = rawKind;
        const nestedKind = normalizeStringCandidate(nestedKindObject.kind) ||
            normalizeStringCandidate(nestedKindObject.type) ||
            normalizeStringCandidate(nestedKindObject.action) ||
            normalizeStringCandidate(nestedKindObject.operation) ||
            normalizeStringCandidate(nestedKindObject.op) ||
            normalizeStringCandidate(nestedKindObject.status) ||
            normalizeStringCandidate(nestedKindObject.value) ||
            normalizeStringCandidate(nestedKindObject.name) ||
            normalizeStringCandidate(nestedKindObject.label) ||
            normalizeStringCandidate(nestedKindObject.text);
        if (nestedKind)
            return nestedKind;
        // 兜底：处理 { added: true } 这类布尔键语义。
        const truthyKey = Object.entries(nestedKindObject).find((entry) => entry[1] === true)?.[0];
        const normalizedTruthyKey = normalizeStringCandidate(truthyKey);
        if (normalizedTruthyKey)
            return normalizedTruthyKey;
    }
    return "change";
}
/**
 * 将未知结构的 fileChange 数组归一化为 `FileChange[]`。
 */
function normalizeFileChanges(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const change of arr) {
        // 每条变更先归一化路径，路径缺失则忽略该条目。
        const path = normalizeFileChangePath(change ?? {});
        if (!path)
            continue;
        // 归一化 kind，避免对象直接 String 化成 `[object Object]`。
        const kind = normalizeFileChangeKind(change ?? {});
        const diff = typeof change?.diff === "string"
            ? String(change.diff)
            : typeof change?.patch === "string"
                ? String(change.patch)
                : typeof change?.unifiedDiff === "string"
                    ? String(change.unifiedDiff)
                    : "";
        // addedLines/deletedLines：优先复用上游已给出的值，缺失时从 diff 文本回填。
        const addedLinesFromField = normalizeLineCountCandidate(change?.addedLines ?? change?.added_lines);
        const deletedLinesFromField = normalizeLineCountCandidate(change?.deletedLines ?? change?.deleted_lines);
        const countedLineStats = countUnifiedDiffLineStatsWithKind(diff, kind);
        out.push({
            path,
            kind,
            diff,
            addedLines: addedLinesFromField ?? countedLineStats.addedLines,
            deletedLines: deletedLinesFromField ?? countedLineStats.deletedLines,
        });
    }
    return out;
}
/**
 * 从未知对象中提取 file changes。
 */
function extractFileChangesFromAny(raw) {
    const record = raw;
    if (!record)
        return [];
    return normalizeFileChanges(record?.changes ??
        record?.diff?.changes ??
        record?.patch?.changes ??
        record?.fileChanges ??
        record?.file_changes ??
        record?.files ??
        record?.edits ??
        []);
}
//# sourceMappingURL=fileChangeExtractor.js.map