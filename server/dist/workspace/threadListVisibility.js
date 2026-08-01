"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWorkspacePaths = normalizeWorkspacePaths;
exports.buildWorkspaceRoutingSnapshot = buildWorkspaceRoutingSnapshot;
exports.resolveWorkspaceRootForCwd = resolveWorkspaceRootForCwd;
exports.resolveThreadListWorkspaceFilter = resolveThreadListWorkspaceFilter;
exports.normalizeThreadCwd = normalizeThreadCwd;
exports.isThreadCwdVisibleToUser = isThreadCwdVisibleToUser;
exports.shouldIncludeThreadForList = shouldIncludeThreadForList;
const node_path_1 = __importDefault(require("node:path"));
const accessControl_1 = require("./accessControl");
const pathCompare_1 = require("./pathCompare");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
// WS/HTTP 统一使用绝对路径 + 去重后的 workspace 列表，避免路径比较歧义。
function normalizeWorkspacePaths(workspaces) {
    const seen = new Set();
    const out = [];
    for (const workspace of workspaces ?? []) {
        const trimmedWorkspace = String(workspace ?? "").trim();
        if (!trimmedWorkspace)
            continue;
        const sanitizedWorkspace = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(trimmedWorkspace);
        const resolvedWorkspace = node_path_1.default.resolve(sanitizedWorkspace);
        if (seen.has(resolvedWorkspace))
            continue;
        seen.add(resolvedWorkspace);
        out.push(resolvedWorkspace);
    }
    return out;
}
// 基于所有 member 用户 workspaces 生成“最具体根目录优先”的路由快照。
function buildWorkspaceRoutingSnapshot(users) {
    const roots = new Set();
    for (const user of users) {
        if (user.role !== "member")
            continue;
        for (const workspace of user.workspaces ?? []) {
            const trimmedWorkspace = String(workspace ?? "").trim();
            if (!trimmedWorkspace)
                continue;
            const sanitizedWorkspace = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(trimmedWorkspace);
            roots.add(node_path_1.default.resolve(sanitizedWorkspace));
        }
    }
    const rootsDesc = Array.from(roots.values()).sort((leftRoot, rightRoot) => rightRoot.length - leftRoot.length);
    return { updatedAtMs: Date.now(), rootsDesc };
}
// 为某个 cwd 匹配最具体 workspace root（最长前缀优先）。
function resolveWorkspaceRootForCwd(snapshot, cwd) {
    const trimmedCwd = String(cwd ?? "").trim();
    if (!trimmedCwd)
        return null;
    const sanitizedCwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(trimmedCwd);
    const resolvedCwd = node_path_1.default.resolve(sanitizedCwd);
    for (const root of snapshot.rootsDesc) {
        if ((0, accessControl_1.isPathWithinRoot)(root, resolvedCwd))
            return root;
    }
    return null;
}
// 解析 list 请求中的 cwd 过滤参数；空值表示不过滤。
async function resolveThreadListWorkspaceFilter(requestedCwd, user) {
    const rawRequestedCwd = typeof requestedCwd === "string" ? requestedCwd.trim() : "";
    if (!rawRequestedCwd)
        return null;
    return (0, accessControl_1.assertCwdAllowedForUser)({ cwd: rawRequestedCwd, user });
}
// 规整 thread.cwd，避免空白/相对路径造成过滤误判。
function normalizeThreadCwd(rawThreadCwd) {
    const threadCwd = typeof rawThreadCwd === "string" ? rawThreadCwd.trim() : "";
    if (!threadCwd)
        return "";
    const sanitizedCwd = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(threadCwd);
    return node_path_1.default.resolve(sanitizedCwd);
}
// 判断线程 cwd 是否对指定用户可见（admin 全可见，member 按分配工作区可见）。
function isThreadCwdVisibleToUser(input) {
    const allowedRoots = (0, accessControl_1.resolveAllowedRootsForUser)(input.user);
    if (allowedRoots.allowAnyRoot)
        return true;
    if (!allowedRoots.roots.length)
        return false;
    if (input.routingSnapshot) {
        const workspaceRoot = resolveWorkspaceRootForCwd(input.routingSnapshot, input.cwd);
        if (workspaceRoot)
            return input.user.workspaces.includes(workspaceRoot);
    }
    return allowedRoots.roots.some((root) => (0, accessControl_1.isPathWithinRoot)(root, input.cwd));
}
// 统一判定某线程是否应进入会话列表（权限 + 可选 workspace 精确过滤）。
function shouldIncludeThreadForList(input) {
    const normalizedThreadCwd = normalizeThreadCwd(input.thread.cwd);
    if (!normalizedThreadCwd)
        return false;
    const visible = isThreadCwdVisibleToUser({
        cwd: normalizedThreadCwd,
        user: input.user,
        routingSnapshot: input.routingSnapshot,
    });
    if (!visible)
        return false;
    if (!input.workspaceFilterCwd)
        return true;
    // 工作区语义按“线程 cwd == 选中 workspace cwd”处理，避免前缀误包含。
    return (0, pathCompare_1.isExactPathEqual)(normalizedThreadCwd, input.workspaceFilterCwd);
}
//# sourceMappingURL=threadListVisibility.js.map