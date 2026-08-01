/**
 * Git diff 的查看模式：
 * - unstaged：仅工作区未暂存（git diff）
 * - staged：仅暂存区（git diff --cached）
 * - auto：根据 status 自动选择（优先展示用户“实际会提交/会看到”的改动）
 */
export type GitDiffMode = "unstaged" | "staged" | "auto";
/**
 * 获取单文件 diff 文本（支持 untracked）。
 *
 * 返回值：
 * - text：适合直接在 UI `<pre>` 中展示的 patch 文本（可能为空字符串）
 * - resolvedMode：auto 模式下实际采用的模式（便于 UI 展示）
 */
export declare function getGitFileDiffText(input: {
    repoRoot: string;
    pathspec: string;
    mode: GitDiffMode;
}): Promise<{
    text: string;
    resolvedMode: "unstaged" | "staged" | "untracked" | "both";
}>;
