"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPathWithinRoot = isPathWithinRoot;
exports.resolveAllowedRootsForUser = resolveAllowedRootsForUser;
exports.assertCwdAllowedForUser = assertCwdAllowedForUser;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../env");
const roles_1 = require("../auth/roles");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
// 判断 candidate 是否位于 root 目录之下（含 root 本身）。
function isPathWithinRoot(root, candidate) {
    const rel = node_path_1.default.relative(root, candidate);
    if (!rel)
        return true;
    if (rel.startsWith(".."))
        return false;
    if (node_path_1.default.isAbsolute(rel))
        return false;
    return true;
}
function normalizeRoots(roots) {
    const seen = new Set();
    const out = [];
    for (const r of roots) {
        const trimmedRoot = String(r ?? "").trim();
        const sanitizedRoot = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(trimmedRoot);
        const resolved = node_path_1.default.resolve(sanitizedRoot);
        if (!resolved)
            continue;
        if (seen.has(resolved))
            continue;
        seen.add(resolved);
        out.push(resolved);
    }
    return out;
}
// 计算用户可访问的根目录：
// - admin：允许从 `/` 起跳；
// - member：仅允许访问被管理员分配的 workspaces（不再与 CODEX_ALLOWED_CWD_ROOTS 取交集）。
function resolveAllowedRootsForUser(user) {
    const role = user?.role;
    if ((0, roles_1.isAdminRole)(role)) {
        return { allowAnyRoot: true, roots: [] };
    }
    const assigned = normalizeRoots(user?.workspaces ?? []);
    return { allowAnyRoot: false, roots: assigned };
}
async function resolveRealpathOrFallback(candidate) {
    const rawCandidate = String(candidate ?? "");
    return promises_1.default
        .realpath(rawCandidate)
        .then((realpathValue) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(realpathValue))
        .catch(() => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(node_path_1.default.resolve(rawCandidate)));
}
// 校验 cwd 是否在用户允许范围内；返回 canonical（尽力 realpath）后的 cwd。
async function assertCwdAllowedForUser(opts) {
    const base = node_path_1.default.resolve((0, env_1.getCodexCwd)());
    const raw = typeof opts.cwd === "string" ? (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(opts.cwd.trim()) : "";
    if (raw.includes("\0"))
        throw new Error("invalid cwd");
    // 空 cwd 等价于使用默认 CODEX_CWD，保持与历史行为一致。
    const resolved = raw ? (node_path_1.default.isAbsolute(raw) ? node_path_1.default.resolve(raw) : node_path_1.default.resolve(base, raw)) : base;
    let st;
    try {
        st = await promises_1.default.stat(resolved);
    }
    catch {
        throw new Error(`cwd not found: ${resolved}`);
    }
    if (!st.isDirectory())
        throw new Error(`cwd is not a directory: ${resolved}`);
    const candidateReal = await resolveRealpathOrFallback(resolved);
    const allowed = resolveAllowedRootsForUser(opts.user);
    if (allowed.allowAnyRoot)
        return candidateReal;
    // 非 admin：必须在管理员分配的工作区根目录内。
    if (!allowed.roots.length)
        throw new Error(`cwd not allowed: ${candidateReal}`);
    const allowedRootsReal = await Promise.all(allowed.roots.map((r) => resolveRealpathOrFallback(r)));
    const ok = allowedRootsReal.some((root) => isPathWithinRoot(root, candidateReal));
    if (!ok)
        throw new Error(`cwd not allowed: ${candidateReal}`);
    return candidateReal;
}
//# sourceMappingURL=accessControl.js.map