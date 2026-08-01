import type { UserRole } from "../auth/userTypes";
/**
 * Codex 执行审批策略：
 * - `never` 风险最高（不做审批）；
 * - 其余策略均比 `never` 更严格。
 */
export type ApprovalPolicy = "untrusted" | "on-failure" | "on-request" | "never";
/**
 * Codex 沙箱策略：
 * - `danger-full-access` 风险最高（不受沙箱限制）；
 * - `workspace-write`/`read-only` 属于受控范围。
 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
/**
 * 按用户角色收敛 approvalPolicy：
 * - admin：允许使用请求值（若合法），否则使用 fallback；
 * - member：仅允许 MEMBER_ALLOWED_APPROVAL_POLICIES；请求值或 fallback 不安全则回退到 MEMBER_FALLBACK_APPROVAL_POLICY。
 */
export declare function coerceApprovalPolicyForUser(opts: {
    userRole: UserRole;
    requested: unknown;
    fallback: ApprovalPolicy;
}): ApprovalPolicy;
/**
 * 按用户角色收敛 sandbox：
 * - admin：允许使用请求值（若合法），否则使用 fallback；
 * - member：仅允许 MEMBER_ALLOWED_SANDBOX_MODES；请求值或 fallback 不安全则回退到 MEMBER_FALLBACK_SANDBOX_MODE。
 */
export declare function coerceSandboxModeForUser(opts: {
    userRole: UserRole;
    requested: unknown;
    fallback: SandboxMode;
}): SandboxMode;
