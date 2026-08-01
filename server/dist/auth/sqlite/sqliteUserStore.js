"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteUserStore = createSqliteUserStore;
const password_1 = require("../password");
/**
 * 规范化用户名输入。
 */
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 规范化角色值。
 */
function normalizeRole(role) {
    return role === "admin" ? "admin" : "member";
}
/**
 * 去重并保序地规范化分配工作区列表。
 */
function normalizeAssignedWorkspaces(workspaces) {
    const seen = new Set();
    const normalized = [];
    for (const workspacePath of workspaces ?? []) {
        const trimmedWorkspacePath = String(workspacePath ?? "").trim();
        if (!trimmedWorkspacePath)
            continue;
        if (seen.has(trimmedWorkspacePath))
            continue;
        seen.add(trimmedWorkspacePath);
        normalized.push(trimmedWorkspacePath);
    }
    return normalized;
}
/**
 * 将数据库行映射为服务端用户结构。
 */
function toStoredUser(userRow, workspaces) {
    return {
        username: userRow.username,
        role: normalizeRole(userRow.role),
        passwordHash: userRow.password_hash,
        workspaces,
    };
}
/**
 * 基于 SQLite 创建用户仓库。
 */
function createSqliteUserStore(options) {
    const db = options.authDb.db;
    const runInTransaction = options.authDb.runInTransaction;
    const insertUserStatement = db.prepare(`
    INSERT INTO auth_users (
      username, role, password_hash, created_at_ms, updated_at_ms
    ) VALUES (
      @username, @role, @passwordHash, @createdAtMs, @updatedAtMs
    )
  `);
    const getUserByUsernameStatement = db.prepare(`
    SELECT username, role, password_hash
    FROM auth_users
    WHERE username = ?
    LIMIT 1
  `);
    const listUsersStatement = db.prepare(`
    SELECT username, role, password_hash
    FROM auth_users
    ORDER BY username ASC
  `);
    const updatePasswordStatement = db.prepare(`
    UPDATE auth_users
    SET password_hash = @passwordHash, updated_at_ms = @updatedAtMs
    WHERE username = @username
  `);
    const renameUserStatement = db.prepare(`
    UPDATE auth_users
    SET username = @nextUsername, updated_at_ms = @updatedAtMs
    WHERE username = @username
  `);
    const deleteUserStatement = db.prepare(`
    DELETE FROM auth_users
    WHERE username = ?
  `);
    const deleteAssignedWorkspacesStatement = db.prepare(`
    DELETE FROM auth_user_assigned_workspaces
    WHERE username = ?
  `);
    const renameAssignedWorkspacesStatement = db.prepare(`
    UPDATE auth_user_assigned_workspaces
    SET username = @nextUsername
    WHERE username = @username
  `);
    const insertAssignedWorkspaceStatement = db.prepare(`
    INSERT OR REPLACE INTO auth_user_assigned_workspaces (
      username, workspace_path, ord
    ) VALUES (
      @username, @workspacePath, @ord
    )
  `);
    const listAssignedWorkspacesByUsernameStatement = db.prepare(`
    SELECT username, workspace_path
    FROM auth_user_assigned_workspaces
    WHERE username = ?
    ORDER BY ord ASC
  `);
    const listAllAssignedWorkspacesStatement = db.prepare(`
    SELECT username, workspace_path
    FROM auth_user_assigned_workspaces
    ORDER BY username ASC, ord ASC
  `);
    const getStoredUserSync = (username) => {
        const userRow = getUserByUsernameStatement.get(username);
        if (!userRow)
            return null;
        const workspaceRows = listAssignedWorkspacesByUsernameStatement.all(username);
        const workspaces = workspaceRows.map((workspaceRow) => workspaceRow.workspace_path);
        return toStoredUser(userRow, workspaces);
    };
    return {
        async createUser(input) {
            const username = normalizeUsername(input.username);
            if (!username)
                throw new Error("username is required");
            const password = String(input.password ?? "");
            if (!password)
                throw new Error("password is required");
            const existingUser = getUserByUsernameStatement.get(username);
            if (existingUser)
                throw new Error("username already exists");
            const nowMs = Date.now();
            const passwordHash = await (0, password_1.hashPassword)(password);
            insertUserStatement.run({
                username,
                role: normalizeRole(input.role),
                passwordHash,
                createdAtMs: nowMs,
                updatedAtMs: nowMs,
            });
            return {
                username,
                role: normalizeRole(input.role),
                passwordHash,
                workspaces: [],
            };
        },
        async getUserByUsername(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                return null;
            return getStoredUserSync(username);
        },
        async setUserPassword(usernameRaw, passwordRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const password = String(passwordRaw ?? "");
            if (!password)
                throw new Error("password is required");
            const passwordHash = await (0, password_1.hashPassword)(password);
            const result = updatePasswordStatement.run({
                username,
                passwordHash,
                updatedAtMs: Date.now(),
            });
            if (Number(result.changes ?? 0) <= 0)
                throw new Error("user not found");
            const updatedUser = getStoredUserSync(username);
            if (!updatedUser)
                throw new Error("user not found");
            return updatedUser;
        },
        async renameUser(usernameRaw, nextUsernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const nextUsername = normalizeUsername(nextUsernameRaw);
            if (!nextUsername)
                throw new Error("next username is required");
            const existingUser = getUserByUsernameStatement.get(username);
            if (!existingUser)
                throw new Error("user not found");
            if (username === nextUsername) {
                const unchangedUser = getStoredUserSync(username);
                if (!unchangedUser)
                    throw new Error("user not found");
                return unchangedUser;
            }
            const targetUser = getUserByUsernameStatement.get(nextUsername);
            if (targetUser)
                throw new Error("username already exists");
            runInTransaction(() => {
                renameUserStatement.run({
                    username,
                    nextUsername,
                    updatedAtMs: Date.now(),
                });
                renameAssignedWorkspacesStatement.run({
                    username,
                    nextUsername,
                });
            });
            const renamedUser = getStoredUserSync(nextUsername);
            if (!renamedUser)
                throw new Error("user not found");
            return renamedUser;
        },
        async deleteUser(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const existingUser = getUserByUsernameStatement.get(username);
            if (!existingUser)
                throw new Error("user not found");
            runInTransaction(() => {
                deleteAssignedWorkspacesStatement.run(username);
                deleteUserStatement.run(username);
            });
        },
        async assignWorkspaces(usernameRaw, workspaces) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const existingUser = getUserByUsernameStatement.get(username);
            if (!existingUser)
                throw new Error("user not found");
            const normalizedWorkspaces = normalizeAssignedWorkspaces(workspaces);
            runInTransaction(() => {
                deleteAssignedWorkspacesStatement.run(username);
                for (let index = 0; index < normalizedWorkspaces.length; index += 1) {
                    const workspacePath = normalizedWorkspaces[index];
                    insertAssignedWorkspaceStatement.run({
                        username,
                        workspacePath,
                        ord: index,
                    });
                }
            });
            const updatedUser = getStoredUserSync(username);
            if (!updatedUser)
                throw new Error("user not found");
            return updatedUser;
        },
        async listUsers() {
            const userRows = listUsersStatement.all();
            const workspaceRows = listAllAssignedWorkspacesStatement.all();
            const workspacesByUsername = new Map();
            for (const workspaceRow of workspaceRows) {
                const currentWorkspaces = workspacesByUsername.get(workspaceRow.username) ?? [];
                currentWorkspaces.push(workspaceRow.workspace_path);
                workspacesByUsername.set(workspaceRow.username, currentWorkspaces);
            }
            return userRows.map((userRow) => toStoredUser(userRow, workspacesByUsername.get(userRow.username) ?? []));
        },
    };
}
//# sourceMappingURL=sqliteUserStore.js.map