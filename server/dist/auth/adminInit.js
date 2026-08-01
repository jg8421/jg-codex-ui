"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAdminInitState = readAdminInitState;
exports.setupAdminPassword = setupAdminPassword;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_1 = require("../env");
const fsSafeMkdir_1 = require("../workspace/fsSafeMkdir");
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
const password_1 = require("./password");
const DEFAULT_ADMIN_PASSWORD = "pass";
async function isDefaultAdminPasswordHash(passwordHash) {
    // 通过密码校验来判断是否为默认口令（避免依赖 hash 格式细节）。
    return (0, password_1.verifyPassword)(DEFAULT_ADMIN_PASSWORD, passwordHash);
}
function normalizeSetupUsername(raw) {
    // 管理员用户名：作为登录账号与 userStore 主键使用。
    const username = String(raw ?? "").trim();
    if (!username)
        return { ok: false, details: "username is required" };
    if (username.length > 64)
        return { ok: false, details: "username is too long" };
    if (/\s/.test(username))
        return { ok: false, details: "username must not contain whitespace" };
    return { ok: true, username };
}
/**
 * 读取 admin 初始化状态：
 * - admin 不存在：requiresSetup=true；
 * - admin 存在但仍为默认口令：requiresSetup=true；
 * - admin 已设置过非默认口令：requiresSetup=false。
 */
async function readAdminInitState(store) {
    // 通过“所有 admin 用户”判断是否仍存在默认口令（支持自定义管理员账号）。
    const users = await store.listUsers();
    const adminUsers = users.filter((u) => u.role === "admin");
    if (!adminUsers.length) {
        return { adminExists: false, isDefaultPassword: false, requiresSetup: true };
    }
    // 只要存在任一 admin 使用默认口令，就建议执行初始化设置。
    for (const user of adminUsers) {
        const passwordHash = String(user.passwordHash ?? "");
        if (!passwordHash)
            continue;
        if (await isDefaultAdminPasswordHash(passwordHash)) {
            return { adminExists: true, isDefaultPassword: true, requiresSetup: true };
        }
    }
    return { adminExists: true, isDefaultPassword: false, requiresSetup: false };
}
function normalizeSetupPassword(raw) {
    // 新密码：用于设置 admin 的最终口令。
    const password = String(raw ?? "");
    if (!password.trim())
        return { ok: false, details: "password is required" };
    if (password === DEFAULT_ADMIN_PASSWORD)
        return { ok: false, details: "password is too weak" };
    if (password.length < 8)
        return { ok: false, details: "password is too short" };
    return { ok: true, password };
}
function normalizeSetupWorkspace(raw) {
    // 初始化工作区：允许相对路径，解析基准与其他 cwd 输入保持一致。
    const baseWorkspace = node_path_1.default.resolve((0, env_1.getCodexCwd)());
    const rawWorkspace = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(raw ?? "").trim());
    if (!rawWorkspace)
        return { ok: false, details: "workspace is required" };
    if (rawWorkspace.includes("\0"))
        return { ok: false, details: "invalid workspace" };
    const resolvedWorkspace = node_path_1.default.isAbsolute(rawWorkspace) ? node_path_1.default.resolve(rawWorkspace) : node_path_1.default.resolve(baseWorkspace, rawWorkspace);
    return { ok: true, workspace: resolvedWorkspace };
}
function createRandomDisabledPassword() {
    // 生成随机强口令，用于“禁用仍为默认口令的 admin 账号”，避免遗留默认口令被利用。
    return node_crypto_1.default.randomBytes(24).toString("base64url");
}
async function rotateDefaultAdminPasswords(input) {
    // 兜底清理：初始化成功后，把所有仍使用默认口令的 admin 账号改成随机强口令。
    const users = await input.store.listUsers();
    const adminUsers = users.filter((u) => u.role === "admin");
    for (const user of adminUsers) {
        const username = String(user.username ?? "").trim();
        if (!username)
            continue;
        if (username === input.skipUsername)
            continue;
        const passwordHash = String(user.passwordHash ?? "");
        if (!passwordHash)
            continue;
        const isDefaultPassword = await isDefaultAdminPasswordHash(passwordHash);
        if (!isDefaultPassword)
            continue;
        await input.store.setUserPassword(username, createRandomDisabledPassword());
    }
}
async function assignInitializedAdminWorkspace(input) {
    // 初始化工作区不存在时自动创建，便于首次接入时直接填写目标目录。
    await (0, fsSafeMkdir_1.ensureDirectoryExists)(promises_1.default, input.workspace);
    return input.store.assignWorkspaces(input.username, [input.workspace]);
}
/**
 * 初始化/更新 admin 密码：
 * - admin 不存在：创建 admin，并分配初始化填写的工作区；
 * - admin 存在且仍为默认口令：仅更新密码；
 * - admin 已配置过：返回 already_configured。
 */
async function setupAdminPassword(input) {
    const normalizedUsername = normalizeSetupUsername(input.username);
    if (!normalizedUsername.ok)
        return { ok: false, status: "invalid_username", details: normalizedUsername.details };
    const normalized = normalizeSetupPassword(input.password);
    if (!normalized.ok)
        return { ok: false, status: "invalid_password", details: normalized.details };
    const normalizedWorkspace = normalizeSetupWorkspace(input.workspace);
    if (!normalizedWorkspace.ok)
        return { ok: false, status: "invalid_workspace", details: normalizedWorkspace.details };
    // 当前系统初始化状态：若已不存在默认口令 admin，则拒绝 setup（避免“任意人再跑一次初始化”）。
    const state = await readAdminInitState(input.store);
    if (!state.requiresSetup)
        return { ok: false, status: "already_configured" };
    // 目标 admin 用户：由初始化请求指定 username。
    const targetUsername = normalizedUsername.username;
    const existingTarget = await input.store.getUserByUsername(targetUsername);
    if (!existingTarget) {
        await input.store.createUser({ username: targetUsername, password: normalized.password, role: "admin" });
        const created = await assignInitializedAdminWorkspace({
            store: input.store,
            username: targetUsername,
            workspace: normalizedWorkspace.workspace,
        });
        await rotateDefaultAdminPasswords({ store: input.store, skipUsername: targetUsername });
        return { ok: true, status: "created", user: created };
    }
    // 若目标用户已存在但不是 admin，则拒绝（避免隐式提权）。
    if (existingTarget.role !== "admin") {
        return { ok: false, status: "invalid_username", details: "username already exists" };
    }
    // 允许在“仍处于默认口令状态”时更新目标 admin 密码（兼容目标 username=admin 的场景）。
    await input.store.setUserPassword(targetUsername, normalized.password);
    const updated = await assignInitializedAdminWorkspace({
        store: input.store,
        username: targetUsername,
        workspace: normalizedWorkspace.workspace,
    });
    await rotateDefaultAdminPasswords({ store: input.store, skipUsername: targetUsername });
    return { ok: true, status: "updated", user: updated };
}
//# sourceMappingURL=adminInit.js.map