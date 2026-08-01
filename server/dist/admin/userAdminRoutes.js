"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserAdminRoutes = createUserAdminRoutes;
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const requireAdmin_1 = require("../auth/requireAdmin");
const fsSafeMkdir_1 = require("../workspace/fsSafeMkdir");
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
function toPublicUser(user) {
    const { passwordHash: _passwordHash, ...rest } = user;
    // 对外返回给前端的工作区列表：剥离 Windows `\\?\` 前缀，避免 UI 展示异常。
    const sanitizedWorkspaces = (rest.workspaces ?? []).map((workspacePath) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspacePath ?? "")));
    return { ...rest, workspaces: sanitizedWorkspaces };
}
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
function normalizeRole(role) {
    return String(role ?? "").trim() === "admin" ? "admin" : "member";
}
function normalizeWorkspaceList(workspaces) {
    const input = Array.isArray(workspaces) ? workspaces : [];
    const seen = new Set();
    const out = [];
    for (const w of input) {
        const trimmed = String(w ?? "").trim();
        if (!trimmed)
            continue;
        // 入库前剥离 Windows `\\?\` 前缀，避免持久化 verbatim 形式。
        const sanitizedWorkspacePath = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(trimmed);
        const resolved = node_path_1.default.resolve(sanitizedWorkspacePath);
        if (seen.has(resolved))
            continue;
        seen.add(resolved);
        out.push(resolved);
    }
    return out;
}
async function ensureWorkspaceDirectoriesExist(workspaces) {
    for (const workspacePath of workspaces) {
        // 分配路径不存在时自动创建，保证“分配即可用”。
        // 兼容 Windows：盘符根目录（如 `C:\`）已存在时，不应执行 mkdir，否则可能触发 EPERM。
        try {
            await (0, fsSafeMkdir_1.ensureDirectoryExists)(promises_1.default, workspacePath);
        }
        catch (error) {
            const message = String(error?.message ?? "");
            if (message.startsWith("cwd is not a directory:")) {
                throw new Error(`workspace is not a directory: ${workspacePath}`);
            }
            throw error;
        }
    }
}
function createUserAdminRoutes(opts) {
    const router = express_1.default.Router();
    router.use(requireAdmin_1.requireAdmin);
    router.get("/users", async (_req, res) => {
        const users = await opts.userStore.listUsers();
        res.json({ ok: true, users: users.map(toPublicUser) });
    });
    router.post("/users", async (req, res) => {
        const body = (req.body ?? {});
        const username = normalizeUsername(body.username);
        const password = String(body.password ?? "");
        const role = normalizeRole(body.role);
        if (!username || !password) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            const created = await opts.userStore.createUser({ username, password, role });
            res.json({ ok: true, user: toPublicUser(created) });
        }
        catch (err) {
            res.status(400).json({ ok: false, error: "create_failed", details: String(err) });
        }
    });
    router.put("/users/:username/workspaces", async (req, res) => {
        const username = normalizeUsername(req.params?.username);
        const body = (req.body ?? {});
        const workspaces = normalizeWorkspaceList(body.workspaces);
        if (!username) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            await ensureWorkspaceDirectoriesExist(workspaces);
            const updated = await opts.userStore.assignWorkspaces(username, workspaces);
            res.json({ ok: true, user: toPublicUser(updated) });
        }
        catch (err) {
            res.status(400).json({ ok: false, error: "assign_failed", details: String(err) });
        }
    });
    router.put("/users/:username/password", async (req, res) => {
        const username = normalizeUsername(req.params?.username);
        const body = (req.body ?? {});
        const password = String(body.password ?? "");
        if (!username || !password) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            const updated = await opts.adminUserMaintenanceService.resetPassword(username, password);
            res.json({ ok: true, user: toPublicUser(updated) });
        }
        catch (err) {
            const details = String(err ?? "");
            const status = details.includes("user not found") ? 404 : 400;
            res.status(status).json({ ok: false, error: "reset_password_failed", details });
        }
    });
    router.put("/users/:username/username", async (req, res) => {
        const username = normalizeUsername(req.params?.username);
        const body = (req.body ?? {});
        const nextUsername = normalizeUsername(body.newUsername);
        if (!username || !nextUsername) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            const updated = await opts.adminUserMaintenanceService.renameUser(username, nextUsername);
            res.json({ ok: true, user: toPublicUser(updated) });
        }
        catch (err) {
            const details = String(err ?? "");
            const status = details.includes("user not found") ? 404 : 400;
            res.status(status).json({ ok: false, error: "rename_failed", details });
        }
    });
    router.delete("/users/:username", async (req, res) => {
        const username = normalizeUsername(req.params?.username);
        if (!username) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            const targetUser = await opts.userStore.getUserByUsername(username);
            if (!targetUser) {
                res.status(404).json({ ok: false, error: "user_not_found" });
                return;
            }
            const actorUsername = normalizeUsername(req.user?.username);
            if (actorUsername && actorUsername === username) {
                res.status(400).json({ ok: false, error: "delete_failed", details: "cannot delete current admin user" });
                return;
            }
            if (targetUser.role === "admin") {
                const users = await opts.userStore.listUsers();
                const adminCount = users.filter((user) => user.role === "admin").length;
                if (adminCount <= 1) {
                    res.status(400).json({ ok: false, error: "delete_failed", details: "cannot delete last admin user" });
                    return;
                }
            }
            await opts.adminUserMaintenanceService.deleteUser(username);
            res.json({ ok: true });
        }
        catch (err) {
            const details = String(err ?? "");
            const status = details.includes("user not found") ? 404 : 400;
            res.status(status).json({ ok: false, error: "delete_failed", details });
        }
    });
    return router;
}
//# sourceMappingURL=userAdminRoutes.js.map