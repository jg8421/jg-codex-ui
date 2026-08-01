/**
 * 规范化并校验 Git remote 名称：
 * - 禁止空白/NUL；
 * - 禁止以 `-` 开头（避免被 git 解析为 option）；
 * - 仅允许常见安全字符：字母数字 `.` `_` `-`。
 *
 * 说明：
 * - Git 本身允许更宽松的名称；这里做更保守的约束，优先安全与可预期。
 */
export declare function normalizeRequestedGitRemoteName(raw: unknown): string | null;
