"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitFileDiffText = getGitFileDiffText;
const gitCommand_1 = require("./gitCommand");
const gitStatusPorcelain_1 = require("./gitStatusPorcelain");
/**
 * 判断 git diff 类命令的退出码是否可接受。
 *
 * 说明：
 * - `git diff` 在“存在差异”时通常返回 1；
 * - `git diff` 在“无差异”时返回 0；
 * - 其他值一般表示错误（例如 128）。
 */
function isGitDiffExitCodeOk(exitCode) {
    return exitCode === 0 || exitCode === 1;
}
/**
 * 对指定 pathspec 运行 `git status --porcelain=v1 -z -- <path>` 并返回第一条匹配项。
 *
 * 目的：
 * - diff API 需要知道该文件是否 untracked，以及 staged/unstaged 情况；
 * - 只查单个 pathspec，避免全量 status 带来的开销。
 */
async function getGitStatusForPath(repoRoot, pathspec) {
    const res = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["status", "--porcelain=v1", "-z", "--", pathspec],
    });
    if (res.exitCode !== 0)
        return null;
    const items = (0, gitStatusPorcelain_1.parseGitStatusPorcelainZ)(res.stdout);
    return items.length ? items[0] : null;
}
/**
 * 运行 git diff 并返回 stdout；当退出码表示错误时抛出异常。
 */
async function runGitDiff(repoRoot, args) {
    const res = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args });
    if (!isGitDiffExitCodeOk(res.exitCode)) {
        throw new Error(res.stderr || res.stdout || `git diff failed (exitCode=${res.exitCode})`);
    }
    // exitCode=1 也可能是“文件不存在”等错误，这里用 stderr 做兜底识别。
    const stderr = String(res.stderr ?? "").trim();
    const stdout = String(res.stdout ?? "");
    if (res.exitCode === 1 && !stdout.trim() && stderr) {
        throw new Error(stderr);
    }
    return stdout;
}
/**
 * 获取单文件 diff 文本（支持 untracked）。
 *
 * 返回值：
 * - text：适合直接在 UI `<pre>` 中展示的 patch 文本（可能为空字符串）
 * - resolvedMode：auto 模式下实际采用的模式（便于 UI 展示）
 */
async function getGitFileDiffText(input) {
    const status = await getGitStatusForPath(input.repoRoot, input.pathspec);
    const untracked = Boolean(status?.untracked);
    const staged = Boolean(status?.staged);
    const unstaged = Boolean(status?.unstaged);
    // untracked：用 `--no-index` 将 “/dev/null -> file” 当成一个 diff 来展示。
    if (untracked) {
        const text = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--no-index", "--", "/dev/null", input.pathspec]);
        return { text, resolvedMode: "untracked" };
    }
    // 显式指定 staged/unstaged：直接执行对应命令。
    if (input.mode === "staged") {
        const text = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--cached", "--", input.pathspec]);
        return { text, resolvedMode: "staged" };
    }
    if (input.mode === "unstaged") {
        const text = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--", input.pathspec]);
        return { text, resolvedMode: "unstaged" };
    }
    // auto：尽可能把用户“看得到的变更”展示出来。
    if (staged && unstaged) {
        const stagedText = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--cached", "--", input.pathspec]);
        const unstagedText = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--", input.pathspec]);
        const parts = [];
        if (stagedText.trim())
            parts.push(`# 已暂存\n${stagedText.trimEnd()}`);
        if (unstagedText.trim())
            parts.push(`# 未暂存\n${unstagedText.trimEnd()}`);
        return { text: parts.join("\n\n").trimEnd(), resolvedMode: "both" };
    }
    if (staged) {
        const text = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--cached", "--", input.pathspec]);
        return { text, resolvedMode: "staged" };
    }
    const text = await runGitDiff(input.repoRoot, ["diff", "--no-color", "--", input.pathspec]);
    return { text, resolvedMode: "unstaged" };
}
//# sourceMappingURL=gitDiff.js.map