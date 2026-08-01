"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRequestedGitRemoteName = normalizeRequestedGitRemoteName;
/**
 * 规范化并校验 Git remote 名称：
 * - 禁止空白/NUL；
 * - 禁止以 `-` 开头（避免被 git 解析为 option）；
 * - 仅允许常见安全字符：字母数字 `.` `_` `-`。
 *
 * 说明：
 * - Git 本身允许更宽松的名称；这里做更保守的约束，优先安全与可预期。
 */
function normalizeRequestedGitRemoteName(raw) {
    // candidate：只接受字符串输入。
    const candidate = typeof raw === "string" ? raw : "";
    // trimmed：去掉首尾空白。
    const trimmed = candidate.trim();
    if (!trimmed)
        return null;
    if (trimmed.includes("\0"))
        return null;
    if (/\s/.test(trimmed))
        return null;
    if (trimmed.startsWith("-"))
        return null;
    // NOTE：remote 名通常是 origin/upstream；限制字符集避免出现难以在 URL/JSON/UI 里稳定展示的名字。
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed))
        return null;
    return trimmed;
}
//# sourceMappingURL=gitRemoteName.js.map