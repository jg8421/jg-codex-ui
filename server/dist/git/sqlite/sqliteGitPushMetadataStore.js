"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteGitPushMetadataStore = createSqliteGitPushMetadataStore;
/**
 * 基于 SQLite 创建 Git push 元数据仓库。
 */
function createSqliteGitPushMetadataStore(options) {
    const db = options.authDb.db;
    const upsertPushedCommitStatement = db.prepare(`
    INSERT INTO auth_git_pushed_commits (
      repo_root,
      branch_name,
      commit_hash,
      pushed_at
    ) VALUES (
      @repoRoot,
      @branchName,
      @commitHash,
      @pushedAt
    )
    ON CONFLICT(repo_root, branch_name, commit_hash)
    DO UPDATE SET pushed_at = excluded.pushed_at
  `);
    return {
        async listPushedCommits(input) {
            // repoRoot：仓库根目录；为空时直接返回空映射。
            const repoRoot = String(input.repoRoot ?? "").trim();
            // branchName：当前分支名；为空时无法命中分支维度记录。
            const branchName = String(input.branchName ?? "").trim();
            // commitHashes：当前批次待查询的 commit hash 集合。
            const commitHashes = input.commitHashes.map((item) => String(item ?? "").trim()).filter(Boolean);
            if (!repoRoot || !branchName || !commitHashes.length)
                return new Map();
            // placeholders：为 IN 子句按 commit 数量动态生成 `?` 占位符。
            const placeholders = commitHashes.map(() => "?").join(", ");
            // listStatement：按仓库/分支/commit 集合批量查询 pushedAt。
            const listStatement = db.prepare(`
        SELECT commit_hash, pushed_at
        FROM auth_git_pushed_commits
        WHERE repo_root = ? AND branch_name = ? AND commit_hash IN (${placeholders})
      `);
            const rows = listStatement.all(repoRoot, branchName, ...commitHashes);
            const out = new Map();
            for (const row of rows) {
                const commitHash = String(row.commit_hash ?? "").trim();
                const pushedAt = String(row.pushed_at ?? "").trim();
                if (!commitHash || !pushedAt)
                    continue;
                out.set(commitHash, pushedAt);
            }
            return out;
        },
        async upsertPushedCommits(input) {
            // repoRoot：当前 push 所属仓库根目录。
            const repoRoot = String(input.repoRoot ?? "").trim();
            // branchName：当前 push 所属分支。
            const branchName = String(input.branchName ?? "").trim();
            // pushedAt：本次 push 成功时间，保存为 ISO 字符串。
            const pushedAt = String(input.pushedAt ?? "").trim();
            // commitHashes：本次 push 影响到的 commit 集合。
            const commitHashes = input.commitHashes.map((item) => String(item ?? "").trim()).filter(Boolean);
            if (!repoRoot || !branchName || !pushedAt || !commitHashes.length)
                return;
            options.authDb.runInTransaction(() => {
                for (const commitHash of commitHashes) {
                    upsertPushedCommitStatement.run({
                        repoRoot,
                        branchName,
                        commitHash,
                        pushedAt,
                    });
                }
            });
        },
    };
}
//# sourceMappingURL=sqliteGitPushMetadataStore.js.map