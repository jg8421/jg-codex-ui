"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitIndexStageTextOrThrow = getGitIndexStageTextOrThrow;
exports.getGitConflictStageTriplet = getGitConflictStageTriplet;
const gitCommand_1 = require("./gitCommand");
/**
 * 读取 Git index 中指定 stage 的 blob 文本。
 *
 * 说明：
 * - 冲突文件在 index 中会同时存在 stage 1/2/3；
 * - stage 含义：1=base，2=ours，3=theirs；
 * - 使用 `git show :<stage>:<path>` 读取对应内容。
 */
async function getGitIndexStageTextOrThrow(opts) {
    // repoRoot：仓库根目录（用于执行 git 命令）。
    const repoRoot = String(opts.repoRoot ?? "").trim();
    // pathspec：相对 repoRoot 的路径。
    const pathspec = String(opts.pathspec ?? "").trim();
    // stage：index stage 编号（1/2/3）。
    const stage = opts.stage;
    const ref = `:${stage}:${pathspec}`;
    const out = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["show", ref] });
    if (out.exitCode !== 0) {
        const details = String(out.stderr || out.stdout || "").trim() || "git show failed";
        throw new Error(`git_index_stage_read_failed: ${details}`);
    }
    return String(out.stdout ?? "");
}
/**
 * 读取冲突文件的 base/ours/theirs 三份文本。
 */
async function getGitConflictStageTriplet(opts) {
    // base：stage1
    const base = await getGitIndexStageTextOrThrow({ repoRoot: opts.repoRoot, pathspec: opts.pathspec, stage: 1 });
    // ours：stage2
    const ours = await getGitIndexStageTextOrThrow({ repoRoot: opts.repoRoot, pathspec: opts.pathspec, stage: 2 });
    // theirs：stage3
    const theirs = await getGitIndexStageTextOrThrow({ repoRoot: opts.repoRoot, pathspec: opts.pathspec, stage: 3 });
    return { base, ours, theirs };
}
//# sourceMappingURL=gitConflictStages.js.map