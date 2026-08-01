"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unstageGitPaths = unstageGitPaths;
const gitCommand_1 = require("./gitCommand");
/**
 * 解析 git `-z` 输出为 path 列表（以 NUL 分隔）。
 *
 * 注意：
 * - `git diff --name-only -z` 会以 `\0` 分隔文件路径；
 * - 这里不做额外的 path 安全校验，调用方应确保 pathspec 已被规范化/白名单过滤。
 */
function parseZeroDelimitedPaths(output) {
    return String(output ?? "")
        .split("\0")
        .map((path) => path.trim())
        .filter(Boolean);
}
/**
 * 将数组按固定大小分块，避免一次性传入过多 pathspec 导致命令行参数过长。
 */
function chunkArray(items, chunkSize) {
    const normalizedChunkSize = Number.isFinite(chunkSize) ? Math.max(1, Math.floor(chunkSize)) : 1;
    const chunks = [];
    for (let index = 0; index < items.length; index += normalizedChunkSize) {
        chunks.push(items.slice(index, index + normalizedChunkSize));
    }
    return chunks;
}
/**
 * 取消暂存（unstage）指定路径或全部已暂存内容。
 *
 * 语义：
 * - 传入 `paths`：仅对这些路径执行 `git restore --staged -- <paths...>`；
 * - 不传 `paths` 或为空：自动读取当前 index 中已暂存文件，并批量取消暂存；
 * - 不会回滚工作区内容，只影响暂存区（index）。
 */
async function unstageGitPaths(repoRoot, input) {
    // desiredPaths：用户指定的 path 列表；为空时表示“取消全部暂存”。
    const desiredPaths = (input.paths ?? []).map((p) => String(p ?? "").trim()).filter(Boolean);
    // stagedPaths：最终要执行 unstage 的路径集合。
    let stagedPaths = desiredPaths;
    if (!stagedPaths.length) {
        const staged = await (0, gitCommand_1.runGitCommand)({
            cwd: repoRoot,
            args: ["diff", "--cached", "--name-only", "-z"],
        });
        if (staged.exitCode !== 0) {
            return {
                stdout: staged.stdout,
                stderr: staged.stderr || staged.stdout || "git diff --cached failed",
                exitCode: staged.exitCode,
            };
        }
        stagedPaths = parseZeroDelimitedPaths(staged.stdout);
    }
    if (!stagedPaths.length) {
        return { stdout: "No staged changes.\n", stderr: "", exitCode: 0 };
    }
    // phases：逐块执行的结果；用于在失败时拼接输出便于排障。
    const phases = [];
    for (const chunk of chunkArray(stagedPaths, 200)) {
        const out = await (0, gitCommand_1.runGitCommand)({
            cwd: repoRoot,
            args: ["restore", "--staged", "--", ...chunk],
        });
        phases.push(out);
        if (out.exitCode !== 0) {
            return {
                stdout: phases.map((p) => p.stdout).join(""),
                stderr: phases.map((p) => p.stderr).join("") || out.stderr || out.stdout,
                exitCode: out.exitCode,
            };
        }
    }
    return {
        stdout: phases.map((p) => p.stdout).join(""),
        stderr: phases.map((p) => p.stderr).join(""),
        exitCode: 0,
    };
}
//# sourceMappingURL=gitUnstage.js.map