/**
 * 单个文件在 `git status --porcelain=v1 -z` 输出中的状态项。
 *
 * 说明：
 * - x/y 是原始 porcelain 的两个状态字符（index/worktree）。
 * - 为便于 UI 与提交逻辑，额外提供 staged/unstaged/untracked 与 rename 信息。
 */
export type GitStatusFile = {
    /**
     * 目标路径（对 rename/copy：通常为新路径）。
     */
    path: string;
    /**
     * Index 状态字符（porcelain 的第 1 位）。
     */
    x: string;
    /**
     * Worktree 状态字符（porcelain 的第 2 位）。
     */
    y: string;
    /**
     * 是否为未跟踪文件（`??`）。
     */
    untracked: boolean;
    /**
     * 是否存在已暂存变更（index 侧有状态）。
     */
    staged: boolean;
    /**
     * 是否存在未暂存变更（worktree 侧有状态）。
     */
    unstaged: boolean;
    /**
     * 是否处于冲突/未合并状态（unmerged）。
     *
     * 说明：
     * - `git status --porcelain=v1` 在冲突时会出现 `UU/AA/DD/AU/UA/UD/DU` 等组合；
     * - 该字段用于 UI 快速呈现“一键策略/三方合并器入口”。
     */
    conflicted: boolean;
    /**
     * rename/copy 的来源路径（旧路径）。
     */
    renamedFrom?: string;
};
/**
 * 分支信息快照（用于展示当前分支与 ahead/behind）。
 */
export type GitBranchSnapshot = {
    /**
     * 当前分支名；若处于 detached HEAD，则可能为 `HEAD`。
     */
    name: string;
    /**
     * 上游分支引用（如 `origin/main`）；缺失表示未设置 upstream。
     */
    upstream?: string;
    /**
     * 相对 upstream 落后的提交数。
     */
    behind: number;
    /**
     * 相对 upstream 领先的提交数。
     */
    ahead: number;
};
/**
 * Git 状态快照（用于 Git 变更管理面板）。
 */
export type GitStatusSnapshot = {
    /**
     * 仓库根目录（realpath/canonical 后）。
     */
    repoRoot: string;
    /**
     * 分支/同步信息。
     */
    branch: GitBranchSnapshot;
    /**
     * 是否工作区完全干净（无任何变更、无未跟踪）。
     */
    isClean: boolean;
    /**
     * 文件状态列表（路径相对 repoRoot）。
     */
    files: GitStatusFile[];
};
/**
 * Git log 单条记录（用于展示最近提交）。
 */
export type GitLogItem = {
    /**
     * commit hash（40 位）。
     */
    hash: string;
    /**
     * 作者名。
     */
    authorName: string;
    /**
     * ISO 日期字符串（`--date=iso-strict`）。
     */
    authorDate: string;
    /**
     * 提交标题（subject）。
     */
    subject: string;
    /**
     * 当前分支的 upstream 是否已包含该提交。
     */
    isPushed: boolean;
    /**
     * 通过本应用成功 push 的时间；旧提交或外部 push 可能缺失。
     */
    pushedAt?: string;
};
/**
 * 分支类型：本地分支（refs/heads）或远程分支（refs/remotes）。
 */
export type GitBranchKind = "local" | "remote";
/**
 * 单条分支信息（用于分支切换/新建面板）。
 */
export type GitBranchItem = {
    /**
     * 分支短名：
     * - local 示例："main"
     * - remote 示例："origin/main"
     */
    name: string;
    /**
     * 分支类型：local/remote。
     */
    kind: GitBranchKind;
    /**
     * 是否为当前分支（仅对 local 有意义；detached HEAD 时始终为 false）。
     */
    isCurrent: boolean;
    /**
     * upstream（仅 local 分支可能有，如 "origin/main"）。
     */
    upstream?: string;
};
/**
 * 分支快照（用于展示与选择分支）。
 */
export type GitBranchesSnapshot = {
    /**
     * 仓库根目录（realpath/canonical 后）。
     */
    repoRoot: string;
    /**
     * 当前分支名；detached 时通常为 "HEAD"。
     */
    current: string;
    /**
     * 是否处于 detached HEAD（此时无法认为有“当前分支”）。
     */
    detached: boolean;
    /**
     * 分支列表（local + remote）。
     */
    branches: GitBranchItem[];
};
