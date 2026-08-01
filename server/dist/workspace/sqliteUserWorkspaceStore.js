"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteUserWorkspaceStore = createSqliteUserWorkspaceStore;
const node_path_1 = __importDefault(require("node:path"));
/**
 * 规范化用户名输入。
 */
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 去重并保序地规范化用户工作目录。
 */
function normalizeWorkspaceDirs(workspaceDirs) {
    const seen = new Set();
    const normalized = [];
    for (const workspaceDir of workspaceDirs ?? []) {
        const resolvedWorkspaceDir = node_path_1.default.resolve(String(workspaceDir ?? "").trim());
        if (!resolvedWorkspaceDir)
            continue;
        if (seen.has(resolvedWorkspaceDir))
            continue;
        seen.add(resolvedWorkspaceDir);
        normalized.push(resolvedWorkspaceDir);
    }
    return normalized;
}
/**
 * 基于 SQLite 创建用户工作目录仓库。
 */
function createSqliteUserWorkspaceStore(options) {
    const db = options.authDb.db;
    const runInTransaction = options.authDb.runInTransaction;
    const listWorkspaceDirsByUsernameStatement = db.prepare(`
    SELECT workspace_dir
    FROM auth_user_workspace_dirs
    WHERE username = ?
    ORDER BY ord ASC
  `);
    const deleteWorkspaceDirsByUsernameStatement = db.prepare(`
    DELETE FROM auth_user_workspace_dirs
    WHERE username = ?
  `);
    const renameWorkspaceDirOwnerStatement = db.prepare(`
    UPDATE OR REPLACE auth_user_workspace_dirs
    SET username = @nextUsername
    WHERE username = @username
  `);
    const insertWorkspaceDirStatement = db.prepare(`
    INSERT OR REPLACE INTO auth_user_workspace_dirs (
      username, workspace_dir, ord
    ) VALUES (
      @username, @workspaceDir, @ord
    )
  `);
    return {
        async listUserWorkspaceDirs(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                return [];
            const rows = listWorkspaceDirsByUsernameStatement.all(username);
            return rows.map((row) => row.workspace_dir);
        },
        async replaceUserWorkspaceDirs(usernameRaw, workspaceDirs) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const normalizedWorkspaceDirs = normalizeWorkspaceDirs(workspaceDirs);
            runInTransaction(() => {
                deleteWorkspaceDirsByUsernameStatement.run(username);
                for (let index = 0; index < normalizedWorkspaceDirs.length; index += 1) {
                    const workspaceDir = normalizedWorkspaceDirs[index];
                    insertWorkspaceDirStatement.run({
                        username,
                        workspaceDir,
                        ord: index,
                    });
                }
            });
            return normalizedWorkspaceDirs;
        },
        async renameUserWorkspaceOwner(usernameRaw, nextUsernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const nextUsername = normalizeUsername(nextUsernameRaw);
            if (!nextUsername)
                throw new Error("next username is required");
            if (username === nextUsername) {
                const unchangedRows = listWorkspaceDirsByUsernameStatement.all(username);
                return unchangedRows.map((row) => row.workspace_dir);
            }
            runInTransaction(() => {
                renameWorkspaceDirOwnerStatement.run({
                    username,
                    nextUsername,
                });
            });
            const renamedRows = listWorkspaceDirsByUsernameStatement.all(nextUsername);
            return renamedRows.map((row) => row.workspace_dir);
        },
        async deleteUserWorkspaceDirs(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            deleteWorkspaceDirsByUsernameStatement.run(username);
        },
    };
}
//# sourceMappingURL=sqliteUserWorkspaceStore.js.map