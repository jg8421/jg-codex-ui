"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitBranchesSnapshot = getGitBranchesSnapshot;
exports.getGitBranchNameIndex = getGitBranchNameIndex;
const gitCommand_1 = require("./gitCommand");
/**
 * 解析 `git for-each-ref` 的 NUL 分隔输出。
 *
 * 约定格式：
 * - 每条记录以 `\n` 结束（git 会在每条 ref 后输出换行）；
 * - 每条记录内部字段以 `\0` 分隔；
 * - 字段顺序由调用方的 `--format` 决定。
 */
function parseNullSeparatedRefLines(raw) {
    // text：原始 stdout（允许为空字符串）。
    const text = String(raw ?? "");
    // lines：按行拆分（去掉末尾空行）。
    const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean);
    // rows：每行按 NUL 拆分成字段数组。
    const rows = lines.map((l) => l.split("\0"));
    return rows;
}
/**
 * 获取 repo 的分支快照（local + remote）。
 *
 * 注意：
 * - 该函数只做 git 信息读取，不做权限与 repoRoot 解析；
 * - detached HEAD 时 `current` 通常为 "HEAD"。
 */
async function getGitBranchesSnapshot(repoRoot) {
    // currentRes：获取当前分支名；detached 时为 "HEAD"。
    const currentRes = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["rev-parse", "--abbrev-ref", "HEAD"] });
    // current：当前分支名（失败时兜底为 "HEAD"）。
    const current = currentRes.exitCode === 0 ? String(currentRes.stdout ?? "").trim() : "HEAD";
    // detached：detached HEAD 时 current 会是 "HEAD"。
    const detached = current === "HEAD";
    // format：refname/short/HEAD/upstream，其中 HEAD 为 "*" 或空字符串。
    const format = "%(refname)%00%(refname:short)%00%(HEAD)%00%(upstream:short)";
    // refsRes：列出本地与远程 ref。
    const refsRes = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["for-each-ref", "refs/heads", "refs/remotes", `--format=${format}`],
    });
    // rows：解析 `for-each-ref` 输出为字段数组。
    const rows = refsRes.exitCode === 0 ? parseNullSeparatedRefLines(refsRes.stdout) : [];
    // items：分支条目列表（含 local + remote）。
    const items = [];
    for (const row of rows) {
        // refname：完整 refname（如 "refs/heads/main"）。
        const refname = String(row[0] ?? "").trim();
        // shortName：短名（如 "main" 或 "origin/main"）。
        const shortName = String(row[1] ?? "").trim();
        // headMarker：当前指针标识（通常 "*" 或空字符串）。
        const headMarker = String(row[2] ?? "").trim();
        // upstream：上游短名（仅 local 通常存在，如 "origin/main"）。
        const upstream = String(row[3] ?? "").trim();
        if (!refname || !shortName)
            continue;
        // isRemote：是否是远程 ref。
        const isRemote = refname.startsWith("refs/remotes/");
        // kind：分支类型。
        const kind = isRemote ? "remote" : "local";
        // 过滤远程 HEAD 引用（如 "origin/HEAD"）。
        if (kind === "remote" && /\/HEAD$/.test(shortName))
            continue;
        // isCurrent：仅对本地分支有意义；detached 时始终 false。
        const isCurrent = !detached && kind === "local" && (headMarker === "*" || shortName === current);
        // item：构造分支条目。
        const item = {
            name: shortName,
            kind,
            isCurrent,
            ...(upstream ? { upstream } : {}),
        };
        items.push(item);
    }
    // sorted：排序，保证 UI 稳定：local 在前，其次按名称排序。
    const sorted = items.slice().sort((a, b) => {
        if (a.kind !== b.kind)
            return a.kind === "local" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return {
        repoRoot,
        current,
        detached,
        branches: sorted,
    };
}
/**
 * 获取分支名索引（便于校验用户输入 target/baseRef 是否存在）。
 */
async function getGitBranchNameIndex(repoRoot) {
    // snapshot：分支快照。
    const snapshot = await getGitBranchesSnapshot(repoRoot);
    // locals：本地分支名集合。
    const locals = new Set();
    // remotes：远程分支名集合。
    const remotes = new Set();
    for (const b of snapshot.branches) {
        if (b.kind === "local")
            locals.add(b.name);
        if (b.kind === "remote")
            remotes.add(b.name);
    }
    return { locals, remotes };
}
//# sourceMappingURL=gitBranches.js.map