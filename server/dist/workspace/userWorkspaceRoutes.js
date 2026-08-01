"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserWorkspaceRoutes = createUserWorkspaceRoutes;
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../env");
const accessControl_1 = require("./accessControl");
const cwdSwitchLogger_1 = require("./cwdSwitchLogger");
const fsSafeMkdir_1 = require("./fsSafeMkdir");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
function normalizeWorkspaceDirInputs(rawWorkspaceDirs) {
    const input = Array.isArray(rawWorkspaceDirs) ? rawWorkspaceDirs : [];
    return input.map((dir) => String(dir ?? "").trim()).filter(Boolean);
}
function mapWorkspaceValidationError(error) {
    const details = String(error?.message ?? error ?? "invalid workspace dir");
    if (details.includes("cwd not allowed")) {
        return { status: 403, code: "path_not_allowed", details };
    }
    if (details.includes("cwd not found") || details.includes("cwd is not a directory") || details.includes("invalid cwd")) {
        return { status: 400, code: "invalid_workspace_dir", details };
    }
    return { status: 400, code: "invalid_input", details };
}
async function resolveRealpathOrFallback(candidatePath) {
    const rawCandidatePath = String(candidatePath ?? "");
    return promises_1.default
        .realpath(rawCandidatePath)
        .then((realpathValue) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(realpathValue))
        .catch(() => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(node_path_1.default.resolve(rawCandidatePath)));
}
function resolveRequestedWorkspaceDir(workspaceDir) {
    // 与 accessControl 的 cwd 解析口径保持一致：相对路径基于 CODEX_CWD。
    const baseCwd = node_path_1.default.resolve((0, env_1.getCodexCwd)());
    const rawWorkspaceDir = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspaceDir ?? "").trim());
    if (rawWorkspaceDir.includes("\0"))
        throw new Error("invalid cwd");
    if (!rawWorkspaceDir)
        throw new Error("invalid cwd");
    return node_path_1.default.isAbsolute(rawWorkspaceDir) ? node_path_1.default.resolve(rawWorkspaceDir) : node_path_1.default.resolve(baseCwd, rawWorkspaceDir);
}
async function resolveTargetRealpathByExistingAncestor(targetPath) {
    // 为了避免“通过 symlink 越权创建目录”，基于最近存在父目录的 realpath 计算目标真实路径。
    let existingAncestorPath = node_path_1.default.resolve(targetPath);
    while (true) {
        try {
            await promises_1.default.stat(existingAncestorPath);
            break;
        }
        catch {
            const parentPath = node_path_1.default.dirname(existingAncestorPath);
            if (parentPath === existingAncestorPath)
                break;
            existingAncestorPath = parentPath;
        }
    }
    const existingAncestorRealpath = await resolveRealpathOrFallback(existingAncestorPath);
    const relativeToAncestor = node_path_1.default.relative(existingAncestorPath, node_path_1.default.resolve(targetPath));
    return relativeToAncestor ? node_path_1.default.resolve(existingAncestorRealpath, relativeToAncestor) : existingAncestorRealpath;
}
async function assertWorkspaceCreateTargetAllowed(workspaceDir, user) {
    const resolvedWorkspaceDir = resolveRequestedWorkspaceDir(workspaceDir);
    const access = (0, accessControl_1.resolveAllowedRootsForUser)(user);
    if (access.allowAnyRoot)
        return resolvedWorkspaceDir;
    if (!access.roots.length)
        throw new Error(`cwd not allowed: ${resolvedWorkspaceDir}`);
    const candidateRealpathBeforeCreate = await resolveTargetRealpathByExistingAncestor(resolvedWorkspaceDir);
    const allowedRootRealpaths = await Promise.all(access.roots.map((rootPath) => resolveRealpathOrFallback(rootPath)));
    const withinAllowedRoots = allowedRootRealpaths.some((rootRealpath) => (0, accessControl_1.isPathWithinRoot)(rootRealpath, candidateRealpathBeforeCreate));
    if (!withinAllowedRoots)
        throw new Error(`cwd not allowed: ${candidateRealpathBeforeCreate}`);
    return resolvedWorkspaceDir;
}
async function ensureWorkspaceDirectoryExists(workspaceDir, user) {
    const allowedTargetWorkspaceDir = await assertWorkspaceCreateTargetAllowed(workspaceDir, user);
    // 路径不存在时自动创建；存在时保持幂等。
    await (0, fsSafeMkdir_1.ensureDirectoryExists)(promises_1.default, allowedTargetWorkspaceDir);
}
function createUserWorkspaceRoutes(opts) {
    const router = express_1.default.Router();
    router.get("/user-created", async (req, res) => {
        const username = String(req.user?.username ?? "").trim();
        if (!username) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const workspaceDirs = await opts.userWorkspaceStore.listUserWorkspaceDirs(username);
        // 对外返回给前端的目录列表：剥离 Windows `\\?\` 前缀，避免 UI 展示异常。
        const sanitizedWorkspaceDirs = workspaceDirs.map((workspaceDir) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspaceDir ?? "")));
        res.json({ ok: true, workspaceDirs: sanitizedWorkspaceDirs });
    });
    router.put("/user-created", async (req, res) => {
        const username = String(req.user?.username ?? "").trim();
        const user = req.user;
        if (!username || !user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        const body = (req.body ?? {});
        if (!Array.isArray(body.workspaceDirs)) {
            res.status(400).json({ ok: false, error: "invalid_input", details: "workspaceDirs must be an array" });
            return;
        }
        try {
            const inputWorkspaceDirs = normalizeWorkspaceDirInputs(body.workspaceDirs);
            const seen = new Set();
            const validatedWorkspaceDirs = [];
            for (const workspaceDir of inputWorkspaceDirs) {
                // 用户保存目录时路径不存在则自动创建；创建前先做权限边界校验。
                await ensureWorkspaceDirectoryExists(workspaceDir, user);
                // 复用现有访问控制：同时校验目录存在性与用户权限边界，返回 canonical 绝对路径。
                const canonicalWorkspaceDir = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd: workspaceDir, user });
                if (seen.has(canonicalWorkspaceDir))
                    continue;
                seen.add(canonicalWorkspaceDir);
                validatedWorkspaceDirs.push(canonicalWorkspaceDir);
            }
            (0, cwdSwitchLogger_1.logCwdSwitch)({
                event: "http_user_workspace_dirs_put",
                username,
                role: String(user?.role ?? ""),
                requestedWorkspaceDirs: inputWorkspaceDirs,
                canonicalWorkspaceDirs: validatedWorkspaceDirs,
                workspacesCount: Array.isArray(user?.workspaces) ? user.workspaces.length : 0,
            });
            const workspaceDirs = await opts.userWorkspaceStore.replaceUserWorkspaceDirs(username, validatedWorkspaceDirs);
            // 对外返回给前端的目录列表：剥离 Windows `\\?\` 前缀，避免 UI 展示异常。
            const sanitizedWorkspaceDirs = workspaceDirs.map((workspaceDir) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspaceDir ?? "")));
            res.json({ ok: true, workspaceDirs: sanitizedWorkspaceDirs });
        }
        catch (error) {
            const mapped = mapWorkspaceValidationError(error);
            res.status(mapped.status).json({ ok: false, error: mapped.code, details: mapped.details });
        }
    });
    return router;
}
//# sourceMappingURL=userWorkspaceRoutes.js.map