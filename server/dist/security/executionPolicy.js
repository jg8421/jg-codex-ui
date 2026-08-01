"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceApprovalPolicyForUser = coerceApprovalPolicyForUser;
exports.coerceSandboxModeForUser = coerceSandboxModeForUser;
const roles_1 = require("../auth/roles");
/**
 * member 允许的审批策略集合（显式禁用 `never`）。
 */
const MEMBER_ALLOWED_APPROVAL_POLICIES = new Set(["untrusted", "on-failure", "on-request"]);
/**
 * member 允许的沙箱策略集合（显式禁用 `danger-full-access`）。
 */
const MEMBER_ALLOWED_SANDBOX_MODES = new Set(["read-only", "workspace-write"]);
/**
 * 当请求值/默认值不安全时，member 的审批策略兜底值。
 */
const MEMBER_FALLBACK_APPROVAL_POLICY = "on-request";
/**
 * 当请求值/默认值不安全时，member 的沙箱策略兜底值。
 */
const MEMBER_FALLBACK_SANDBOX_MODE = "workspace-write";
/**
 * 解析客户端上报的 approvalPolicy；非法值返回 null。
 */
function parseApprovalPolicy(requested) {
    const raw = typeof requested === "string" ? requested.trim() : "";
    if (raw === "untrusted" || raw === "on-failure" || raw === "on-request" || raw === "never")
        return raw;
    return null;
}
/**
 * 解析客户端上报的 sandbox；非法值返回 null。
 */
function parseSandboxMode(requested) {
    const raw = typeof requested === "string" ? requested.trim() : "";
    if (raw === "read-only" || raw === "workspace-write" || raw === "danger-full-access")
        return raw;
    return null;
}
/**
 * 按用户角色收敛 approvalPolicy：
 * - admin：允许使用请求值（若合法），否则使用 fallback；
 * - member：仅允许 MEMBER_ALLOWED_APPROVAL_POLICIES；请求值或 fallback 不安全则回退到 MEMBER_FALLBACK_APPROVAL_POLICY。
 */
function coerceApprovalPolicyForUser(opts) {
    const requestedPolicy = parseApprovalPolicy(opts.requested);
    if ((0, roles_1.isAdminRole)(opts.userRole)) {
        return requestedPolicy ?? opts.fallback;
    }
    if (requestedPolicy && MEMBER_ALLOWED_APPROVAL_POLICIES.has(requestedPolicy))
        return requestedPolicy;
    if (MEMBER_ALLOWED_APPROVAL_POLICIES.has(opts.fallback))
        return opts.fallback;
    return MEMBER_FALLBACK_APPROVAL_POLICY;
}
/**
 * 按用户角色收敛 sandbox：
 * - admin：允许使用请求值（若合法），否则使用 fallback；
 * - member：仅允许 MEMBER_ALLOWED_SANDBOX_MODES；请求值或 fallback 不安全则回退到 MEMBER_FALLBACK_SANDBOX_MODE。
 */
function coerceSandboxModeForUser(opts) {
    const requestedSandbox = parseSandboxMode(opts.requested);
    if ((0, roles_1.isAdminRole)(opts.userRole)) {
        return requestedSandbox ?? opts.fallback;
    }
    if (requestedSandbox && MEMBER_ALLOWED_SANDBOX_MODES.has(requestedSandbox))
        return requestedSandbox;
    if (MEMBER_ALLOWED_SANDBOX_MODES.has(opts.fallback))
        return opts.fallback;
    return MEMBER_FALLBACK_SANDBOX_MODE;
}
//# sourceMappingURL=executionPolicy.js.map