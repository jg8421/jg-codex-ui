"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApprovalRequestMethod = isApprovalRequestMethod;
exports.extractApprovalRequestCwd = extractApprovalRequestCwd;
exports.isApprovalCwdAllowedForUser = isApprovalCwdAllowedForUser;
const node_path_1 = __importDefault(require("node:path"));
const accessControl_1 = require("./accessControl");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
/**
 * 从候选值中提取首个非空字符串。
 */
function pickFirstNonEmptyString(candidates) {
    for (const candidate of candidates) {
        if (typeof candidate !== "string")
            continue;
        const normalizedCandidate = candidate.trim();
        if (normalizedCandidate)
            return normalizedCandidate;
    }
    return "";
}
/**
 * 规范化绝对路径文本；空值返回空串。
 */
function normalizeAbsolutePath(rawPath) {
    const normalizedPath = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(rawPath ?? "").trim());
    if (!normalizedPath)
        return "";
    return node_path_1.default.resolve(normalizedPath);
}
/**
 * 判断 method 是否属于需要走审批 cwd 校验的审批请求。
 */
function isApprovalRequestMethod(method) {
    const normalizedMethod = String(method ?? "").trim();
    return (normalizedMethod === "item/commandExecution/requestApproval" ||
        normalizedMethod === "item/fileChange/requestApproval" ||
        normalizedMethod === "applyPatchApproval" ||
        normalizedMethod === "execCommandApproval");
}
/**
 * 从审批请求参数中提取待校验 cwd；缺失时回退到线程 cwd。
 */
function extractApprovalRequestCwd(rawParams, fallbackCwd) {
    const params = (rawParams ?? {});
    const rawApprovalCwd = pickFirstNonEmptyString([params?.cwd, params?.workingDirectory, params?.request?.cwd]);
    if (rawApprovalCwd) {
        const normalizedFallbackCwd = normalizeAbsolutePath(fallbackCwd);
        if (!node_path_1.default.isAbsolute(rawApprovalCwd) && normalizedFallbackCwd) {
            return normalizeAbsolutePath(node_path_1.default.resolve(normalizedFallbackCwd, rawApprovalCwd));
        }
        return normalizeAbsolutePath(rawApprovalCwd) || null;
    }
    return normalizeAbsolutePath(fallbackCwd) || null;
}
/**
 * 按指定模式判断审批 cwd 是否位于用户允许范围内。
 */
function isApprovalCwdAllowedForUser(input) {
    /**
     * 归一化后的待校验 cwd。
     */
    const normalizedApprovalRequestCwd = normalizeAbsolutePath(input.approvalRequestCwd);
    if (!normalizedApprovalRequestCwd)
        return false;
    if (input.approvalCwdCheckMode === "user-workspace-dirs") {
        /**
         * 用户保存的工作目录列表；为空时直接拒绝。
         */
        const normalizedUserWorkspaceDirs = input.userWorkspaceDirs
            .map((workspaceDir) => normalizeAbsolutePath(workspaceDir))
            .filter(Boolean);
        if (!normalizedUserWorkspaceDirs.length)
            return false;
        return normalizedUserWorkspaceDirs.some((workspaceDir) => (0, accessControl_1.isPathWithinRoot)(workspaceDir, normalizedApprovalRequestCwd));
    }
    /**
     * 按 auth workspaces 计算出的允许根目录。
     */
    const allowedRoots = (0, accessControl_1.resolveAllowedRootsForUser)(input.user);
    if (allowedRoots.allowAnyRoot)
        return true;
    if (!allowedRoots.roots.length)
        return false;
    return allowedRoots.roots.some((workspaceRoot) => (0, accessControl_1.isPathWithinRoot)(normalizeAbsolutePath(workspaceRoot), normalizedApprovalRequestCwd));
}
//# sourceMappingURL=approvalCwdAccess.js.map