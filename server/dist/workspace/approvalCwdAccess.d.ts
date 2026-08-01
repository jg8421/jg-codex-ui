import type { UserApprovalCwdCheckMode } from "../settings/userSettingsTypes";
import type { UserRole } from "../auth/userTypes";
/**
 * 审批 cwd 校验时需要的最小用户权限信息。
 */
export type ApprovalCwdAccessUser = {
    role: UserRole;
    workspaces: string[];
};
/**
 * 判断 method 是否属于需要走审批 cwd 校验的审批请求。
 */
export declare function isApprovalRequestMethod(method: unknown): boolean;
/**
 * 从审批请求参数中提取待校验 cwd；缺失时回退到线程 cwd。
 */
export declare function extractApprovalRequestCwd(rawParams: unknown, fallbackCwd: string | null): string | null;
/**
 * 按指定模式判断审批 cwd 是否位于用户允许范围内。
 */
export declare function isApprovalCwdAllowedForUser(input: {
    approvalRequestCwd: string;
    approvalCwdCheckMode: UserApprovalCwdCheckMode;
    user: ApprovalCwdAccessUser;
    userWorkspaceDirs: string[];
}): boolean;
