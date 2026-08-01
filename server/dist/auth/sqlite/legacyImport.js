"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeImportLegacyJsonSettings = maybeImportLegacyJsonSettings;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
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
 * 去重并保序地规范化“分配工作区”。
 */
function normalizeAssignedWorkspaces(workspaces) {
    const input = Array.isArray(workspaces) ? workspaces : [];
    const seen = new Set();
    const normalized = [];
    for (const workspacePath of input) {
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
 * 去重并保序地规范化“用户保存工作目录”。
 */
function normalizeWorkspaceDirs(workspaceDirs) {
    const input = Array.isArray(workspaceDirs) ? workspaceDirs : [];
    const seen = new Set();
    const normalized = [];
    for (const workspaceDir of input) {
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
 * 安全读取 JSON 文件；文件不存在时返回 null。
 */
async function readJsonFileIfExists(filePath) {
    const normalizedFilePath = String(filePath ?? "").trim();
    if (!normalizedFilePath)
        return null;
    try {
        const rawJson = await promises_1.default.readFile(normalizedFilePath, "utf8");
        return JSON.parse(rawJson);
    }
    catch (error) {
        if (error?.code === "ENOENT")
            return null;
        return null;
    }
}
/**
 * 读取并解析旧版 users.json。
 */
async function readLegacyUsers(filePath) {
    const raw = await readJsonFileIfExists(filePath);
    const users = Array.isArray(raw?.users) ? raw.users : [];
    const seen = new Set();
    const normalizedUsers = [];
    for (const user of users) {
        const username = normalizeUsername(user?.username);
        if (!username || seen.has(username))
            continue;
        const passwordHash = String(user?.passwordHash ?? "").trim();
        if (!passwordHash)
            continue;
        seen.add(username);
        normalizedUsers.push({
            username,
            role: normalizeRole(user?.role),
            passwordHash,
            workspaces: normalizeAssignedWorkspaces(user?.workspaces),
        });
    }
    return normalizedUsers;
}
/**
 * 读取并解析旧版 user-workspaces.json。
 */
async function readLegacyWorkspaceEntries(filePath) {
    const raw = await readJsonFileIfExists(filePath);
    const users = Array.isArray(raw?.users) ? raw.users : [];
    const seen = new Set();
    const normalizedEntries = [];
    for (const user of users) {
        const username = normalizeUsername(user?.username);
        if (!username || seen.has(username))
            continue;
        seen.add(username);
        normalizedEntries.push({
            username,
            workspaceDirs: normalizeWorkspaceDirs(user?.workspaceDirs),
        });
    }
    return normalizedEntries;
}
/**
 * 当 DB 为空时导入旧 JSON 配置数据。
 */
async function maybeImportLegacyJsonSettings(options) {
    const db = options.authDb.db;
    const userCountRow = db.prepare(`SELECT COUNT(*) AS count FROM auth_users`).get();
    const userCount = Number(userCountRow?.count ?? 0);
    if (userCount > 0) {
        return {
            imported: false,
            importedUsers: 0,
            importedAssignedWorkspaces: 0,
            importedWorkspaceDirs: 0,
        };
    }
    const legacyUsers = await readLegacyUsers(options.usersFilePath);
    const legacyWorkspaceEntries = await readLegacyWorkspaceEntries(options.userWorkspacesFilePath);
    if (legacyUsers.length === 0 && legacyWorkspaceEntries.length === 0) {
        return {
            imported: false,
            importedUsers: 0,
            importedAssignedWorkspaces: 0,
            importedWorkspaceDirs: 0,
        };
    }
    const insertUserStatement = db.prepare(`
    INSERT OR REPLACE INTO auth_users (
      username, role, password_hash, created_at_ms, updated_at_ms
    ) VALUES (
      @username, @role, @passwordHash, @createdAtMs, @updatedAtMs
    )
  `);
    const insertAssignedWorkspaceStatement = db.prepare(`
    INSERT OR REPLACE INTO auth_user_assigned_workspaces (
      username, workspace_path, ord
    ) VALUES (
      @username, @workspacePath, @ord
    )
  `);
    const insertWorkspaceDirStatement = db.prepare(`
    INSERT OR REPLACE INTO auth_user_workspace_dirs (
      username, workspace_dir, ord
    ) VALUES (
      @username, @workspaceDir, @ord
    )
  `);
    const nowMs = Date.now();
    let importedUsers = 0;
    let importedAssignedWorkspaces = 0;
    let importedWorkspaceDirs = 0;
    options.authDb.runInTransaction(() => {
        for (const legacyUser of legacyUsers) {
            insertUserStatement.run({
                username: legacyUser.username,
                role: normalizeRole(legacyUser.role),
                passwordHash: legacyUser.passwordHash,
                createdAtMs: nowMs,
                updatedAtMs: nowMs,
            });
            importedUsers += 1;
            for (let index = 0; index < legacyUser.workspaces.length; index += 1) {
                const workspacePath = legacyUser.workspaces[index];
                insertAssignedWorkspaceStatement.run({
                    username: legacyUser.username,
                    workspacePath,
                    ord: index,
                });
                importedAssignedWorkspaces += 1;
            }
        }
        for (const legacyWorkspaceEntry of legacyWorkspaceEntries) {
            for (let index = 0; index < legacyWorkspaceEntry.workspaceDirs.length; index += 1) {
                const workspaceDir = legacyWorkspaceEntry.workspaceDirs[index];
                insertWorkspaceDirStatement.run({
                    username: legacyWorkspaceEntry.username,
                    workspaceDir,
                    ord: index,
                });
                importedWorkspaceDirs += 1;
            }
        }
    });
    return {
        imported: importedUsers > 0 || importedAssignedWorkspaces > 0 || importedWorkspaceDirs > 0,
        importedUsers,
        importedAssignedWorkspaces,
        importedWorkspaceDirs,
    };
}
//# sourceMappingURL=legacyImport.js.map