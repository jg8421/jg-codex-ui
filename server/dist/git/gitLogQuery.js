"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryGitLogItems = queryGitLogItems;
exports.resolveCurrentGitBranchName = resolveCurrentGitBranchName;
exports.resolveCurrentGitUpstreamRef = resolveCurrentGitUpstreamRef;
exports.resolveCurrentGitHeadHash = resolveCurrentGitHeadHash;
exports.listUnpushedCommitHashes = listUnpushedCommitHashes;
const gitCommand_1 = require("./gitCommand");
/**
 * 查询最近 Git 日志，并补充当前 upstream 视角下的推送状态。
 */
async function queryGitLogItems(input) {
    // repoRoot：当前 Git 仓库根目录。
    const repoRoot = String(input.repoRoot ?? "").trim();
    // limit：日志条数上限；最少 1，避免拼出非法命令。
    const limit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 50;
    // branchName：当前分支名；detached HEAD 时可能为 `HEAD`。
    const branchName = await resolveCurrentGitBranchName(repoRoot);
    // upstreamRef：当前分支 upstream；缺失时为 null。
    const upstreamRef = await resolveCurrentGitUpstreamRef(repoRoot);
    // baseItems：仅包含 git log 原始字段的基础列表。
    const baseItems = await listBaseGitLogItems({ repoRoot, limit });
    if (!baseItems.length) {
        return {
            branchName,
            upstreamRef,
            items: baseItems,
        };
    }
    // commitHashes：用于一次性查询本地 push 元数据。
    const commitHashes = baseItems.map((item) => item.hash);
    // pushedAtByHash：仅记录由应用内成功 push 写入过的 commit 时间。
    const pushedAtByHash = input.pushMetadataStore && branchName
        ? await input.pushMetadataStore.listPushedCommits({
            repoRoot,
            branchName,
            commitHashes,
        })
        : new Map();
    // items：并发补充每条 commit 的 isPushed/pushedAt 字段。
    const items = await Promise.all(baseItems.map(async (item) => {
        const isPushed = upstreamRef ? await isCommitContainedByUpstream({ repoRoot, upstreamRef, commitHash: item.hash }) : false;
        const pushedAt = pushedAtByHash.get(item.hash);
        return {
            ...item,
            isPushed,
            pushedAt: pushedAt || undefined,
        };
    }));
    return {
        branchName,
        upstreamRef,
        items,
    };
}
/**
 * 获取当前分支名；detached HEAD 时返回 `HEAD`。
 */
async function resolveCurrentGitBranchName(repoRoot) {
    const branchNameResult = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-parse", "--abbrev-ref", "HEAD"],
    });
    if (branchNameResult.exitCode !== 0)
        return "HEAD";
    return String(branchNameResult.stdout ?? "").trim() || "HEAD";
}
/**
 * 获取当前分支的 upstream 引用；未配置时返回 null。
 */
async function resolveCurrentGitUpstreamRef(repoRoot) {
    const upstreamResult = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    });
    if (upstreamResult.exitCode !== 0)
        return null;
    const upstreamRef = String(upstreamResult.stdout ?? "").trim();
    return upstreamRef || null;
}
/**
 * 获取当前 HEAD commit hash；失败时返回 null。
 */
async function resolveCurrentGitHeadHash(repoRoot) {
    const headResult = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-parse", "HEAD"],
    });
    if (headResult.exitCode !== 0)
        return null;
    const headHash = String(headResult.stdout ?? "").trim();
    return headHash || null;
}
/**
 * 列出当前分支相对 upstream 尚未推送的 commit hash 集合。
 */
async function listUnpushedCommitHashes(input) {
    const repoRoot = String(input.repoRoot ?? "").trim();
    const upstreamRef = String(input.upstreamRef ?? "").trim();
    if (!repoRoot || !upstreamRef)
        return [];
    // revListResult：只列出 upstream 不包含、但 HEAD 包含的 commit。
    const revListResult = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-list", "--reverse", `${upstreamRef}..HEAD`],
    });
    if (revListResult.exitCode !== 0)
        return [];
    return String(revListResult.stdout ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
}
/**
 * 获取基础 Git log 列表，不包含推送状态字段。
 */
async function listBaseGitLogItems(input) {
    // format：使用 FS/RS 分隔符，避免 subject 中空格影响解析。
    const format = "%H%x1f%an%x1f%ad%x1f%s%x1e";
    const logResult = await (0, gitCommand_1.runGitCommand)({
        cwd: input.repoRoot,
        args: ["log", "-n", String(input.limit), "--date=iso-strict", `--pretty=format:${format}`],
    });
    if (logResult.exitCode !== 0) {
        throw new Error(logResult.stderr || logResult.stdout || "git log failed");
    }
    return parseGitLogOutput(logResult.stdout);
}
/**
 * 解析 `git log` 的自定义分隔输出。
 */
function parseGitLogOutput(raw) {
    const text = String(raw ?? "");
    const records = text.split("\x1e").filter(Boolean);
    const items = [];
    for (const record of records) {
        // hash/authorName/authorDate/subject：与 `--pretty=format` 字段顺序保持一致。
        const [hash, authorName, authorDate, subject] = record.split("\x1f");
        const normalizedHash = String(hash ?? "").trim();
        if (!normalizedHash)
            continue;
        items.push({
            hash: normalizedHash,
            authorName: String(authorName ?? "").trim(),
            authorDate: String(authorDate ?? "").trim(),
            subject: String(subject ?? "").trim(),
            isPushed: false,
        });
    }
    return items;
}
/**
 * 判断某个 commit 当前是否已被 upstream 包含。
 */
async function isCommitContainedByUpstream(input) {
    // mergeBaseResult：`--is-ancestor` 为 0 表示 commit 已在 upstream 历史中。
    const mergeBaseResult = await (0, gitCommand_1.runGitCommand)({
        cwd: input.repoRoot,
        args: ["merge-base", "--is-ancestor", input.commitHash, input.upstreamRef],
    });
    return mergeBaseResult.exitCode === 0;
}
//# sourceMappingURL=gitLogQuery.js.map