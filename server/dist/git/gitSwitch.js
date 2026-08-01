"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidNewBranchName = assertValidNewBranchName;
exports.switchToGitBranch = switchToGitBranch;
exports.createAndSwitchGitBranch = createAndSwitchGitBranch;
const gitCommand_1 = require("./gitCommand");
const gitBranches_1 = require("./gitBranches");
const gitRefFormat_1 = require("./gitRefFormat");
/**
 * 校验新分支名是否合法（使用 git 原生命令，避免自行实现复杂规则）。
 */
async function assertValidNewBranchName(repoRoot, branchName) {
    // repoRoot：校验命令不要求目录是仓库，但沿用 repoRoot 作为执行 cwd。
    await (0, gitRefFormat_1.assertValidBranchShortName)(repoRoot, branchName);
}
/**
 * 从远程短名（如 "origin/feature/a"）推导潜在的本地分支短名（如 "feature/a"）。
 *
 * 说明：
 * - Git 远程名通常为第一个 `/` 之前的部分；
 * - 若无 `/`，则无法推导，返回 null。
 */
function inferLocalBranchNameFromRemote(remoteShortName) {
    // text：规范化输入。
    const text = String(remoteShortName ?? "").trim();
    // slashIdx：第一个 `/` 位置。
    const slashIdx = text.indexOf("/");
    if (slashIdx <= 0)
        return null;
    // localCandidate：去掉 "origin/" 前缀后的本地候选名。
    const localCandidate = text.slice(slashIdx + 1).trim();
    return localCandidate || null;
}
/**
 * 切换到指定分支。
 *
 * 支持：
 * - local：`git switch <target>`
 * - remote：若本地已存在同名分支则切换之，否则 `git switch --track <remote>`
 */
async function switchToGitBranch(repoRoot, target) {
    // normalizedTarget：规范化 target。
    const normalizedTarget = String(target ?? "").trim();
    if (!normalizedTarget) {
        return { stdout: "", stderr: "target is required", exitCode: 1 };
    }
    // index：获取本地/远程分支名索引用于校验。
    const index = await (0, gitBranches_1.getGitBranchNameIndex)(repoRoot);
    // isLocal：是否为已存在的本地分支。
    const isLocal = index.locals.has(normalizedTarget);
    // isRemote：是否为已存在的远程分支（如 "origin/main"）。
    const isRemote = index.remotes.has(normalizedTarget);
    if (!isLocal && !isRemote) {
        return { stdout: "", stderr: "branch not found", exitCode: 1 };
    }
    if (isLocal) {
        // localSwitch：切换到本地分支。
        const localSwitch = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["switch", normalizedTarget], timeoutMs: 120_000 });
        return localSwitch;
    }
    // inferredLocal：从 remote 名推导可能存在的本地分支名。
    const inferredLocal = inferLocalBranchNameFromRemote(normalizedTarget);
    // hasInferredLocal：推导出的本地分支名是否已存在。
    const hasInferredLocal = inferredLocal ? index.locals.has(inferredLocal) : false;
    if (inferredLocal && hasInferredLocal) {
        // localSwitchFromRemote：若本地已存在对应分支，优先切换本地分支（避免重复创建/冲突）。
        const localSwitchFromRemote = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["switch", inferredLocal], timeoutMs: 120_000 });
        return localSwitchFromRemote;
    }
    // trackSwitch：从远程分支创建并 track（由 git 自动决定本地分支名，一般为去掉 remote/ 前缀）。
    const trackSwitch = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["switch", "--track", normalizedTarget], timeoutMs: 120_000 });
    return trackSwitch;
}
/**
 * 新建分支并切换到新分支。
 *
 * 规则：
 * - baseRef 默认 "HEAD"
 * - trackUpstream 仅在 baseRef 为远程分支（origin/*）时生效
 */
async function createAndSwitchGitBranch(repoRoot, input) {
    // newBranch：新分支名（规范化）。
    const newBranch = String(input.newBranch ?? "").trim();
    // baseRef：基准引用（规范化），允许 "HEAD" 或已存在的 local/remote。
    const baseRef = String(input.baseRef ?? "HEAD").trim() || "HEAD";
    // trackUpstream：是否在创建时设置 upstream（仅 remote baseRef 支持）。
    const trackUpstream = Boolean(input.trackUpstream);
    if (!newBranch)
        return { stdout: "", stderr: "newBranch is required", exitCode: 1 };
    // 校验新分支名格式。
    await assertValidNewBranchName(repoRoot, newBranch);
    // index：获取本地/远程分支名索引用于校验 baseRef。
    const index = await (0, gitBranches_1.getGitBranchNameIndex)(repoRoot);
    // baseIsLocal：baseRef 是否为本地分支名。
    const baseIsLocal = index.locals.has(baseRef);
    // baseIsRemote：baseRef 是否为远程分支名。
    const baseIsRemote = index.remotes.has(baseRef);
    if (baseRef !== "HEAD" && !baseIsLocal && !baseIsRemote) {
        return { stdout: "", stderr: "baseRef not found", exitCode: 1 };
    }
    if (trackUpstream && baseRef !== "HEAD" && !baseIsRemote) {
        return { stdout: "", stderr: "trackUpstream requires remote baseRef", exitCode: 1 };
    }
    // args：git switch 参数数组。
    const args = ["switch", "-c", newBranch];
    if (baseRef !== "HEAD") {
        if (trackUpstream) {
            // --track：让新分支跟踪 baseRef（远程分支）。
            args.push("--track", baseRef);
        }
        else {
            // baseRef：仅创建并从 baseRef 派生，不设置 upstream。
            args.push(baseRef);
        }
    }
    // createRes：执行创建并切换。
    const createRes = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args, timeoutMs: 120_000 });
    return createRes;
}
//# sourceMappingURL=gitSwitch.js.map