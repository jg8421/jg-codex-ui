"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSkillCallMarkerFromCommandExecutionItem = extractSkillCallMarkerFromCommandExecutionItem;
/**
 * 匹配 `.../skills/<name>/SKILL.md`（兼容 `/` 与 `\\` 分隔符）。
 */
const SKILL_PATH_PATTERN = /(?:^|\/)skills\/([^/\s"'`]+)\/SKILL\.md$/i;
/**
 * 在任意命令文本中提取 skill 文件路径片段。
 *
 * 说明：
 * - 先把 `\\` 统一替换为 `/`，避免 Windows 路径漏检；
 * - 仅匹配不包含空白/引号的片段，降低误判概率。
 */
const SKILL_PATH_FRAGMENT_PATTERN = /([^\s"'`]+\/skills\/[^/\s"'`]+\/SKILL\.md)/gi;
/**
 * 归一化路径分隔符，统一后续正则匹配输入。
 */
function normalizePathSeparators(rawPath) {
    return rawPath.replace(/\\/g, "/");
}
/**
 * 从“单个路径字符串”提取 skill 调用标记。
 */
function extractSkillCallMarkerFromPath(rawPath) {
    const normalizedPath = typeof rawPath === "string" ? normalizePathSeparators(rawPath.trim()) : "";
    if (!normalizedPath)
        return null;
    const matched = SKILL_PATH_PATTERN.exec(normalizedPath);
    if (!matched)
        return null;
    const skillName = String(matched[1] ?? "").trim();
    if (!skillName)
        return null;
    return {
        name: skillName,
        path: typeof rawPath === "string" ? rawPath.trim() : normalizedPath,
    };
}
/**
 * 从“命令文本”中提取第一个可识别的 skill 路径并返回标记。
 */
function extractSkillCallMarkerFromCommandText(rawText) {
    const normalizedText = typeof rawText === "string" ? normalizePathSeparators(rawText) : "";
    if (!normalizedText)
        return null;
    const localPattern = new RegExp(SKILL_PATH_FRAGMENT_PATTERN.source, "gi");
    let matchedFragment = localPattern.exec(normalizedText);
    while (matchedFragment) {
        const candidatePath = String(matchedFragment[1] ?? "").trim();
        const marker = extractSkillCallMarkerFromPath(candidatePath);
        if (marker)
            return marker;
        matchedFragment = localPattern.exec(normalizedText);
    }
    return null;
}
/**
 * 从 `commandExecution` item 中提取 skill 调用标记。
 *
 * 支持来源：
 * - `item.commandActions[*].path`
 * - `item.commandActions[*].command`
 * - `item.command`
 */
function extractSkillCallMarkerFromCommandExecutionItem(item) {
    const normalizedItem = (item ?? {});
    const commandActions = Array.isArray(normalizedItem.commandActions) ? normalizedItem.commandActions : [];
    for (const rawAction of commandActions) {
        const action = (rawAction ?? {});
        const markerFromPath = extractSkillCallMarkerFromPath(action.path);
        if (markerFromPath)
            return markerFromPath;
        const markerFromActionCommand = extractSkillCallMarkerFromCommandText(action.command);
        if (markerFromActionCommand)
            return markerFromActionCommand;
    }
    return extractSkillCallMarkerFromCommandText(normalizedItem.command);
}
//# sourceMappingURL=skillCallMarker.js.map