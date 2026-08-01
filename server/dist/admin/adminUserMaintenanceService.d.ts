import type { UserStore } from "../auth/userStore";
import type { StoredUser } from "../auth/userTypes";
import type { GitCredentialStore } from "../git/gitCredentialStore";
import type { UserSettingsStore } from "../settings/userSettingsStore";
import type { UserWorkspaceStore } from "../workspace/userWorkspaceStore";
import type { WorkspaceStatusStore } from "../workspace/workspaceStatusStore";
/**
 * 管理员用户维护服务入参。
 */
type CreateAdminUserMaintenanceServiceOptions = {
    userStore: UserStore;
    userWorkspaceStore: UserWorkspaceStore;
    userSettingsStore: UserSettingsStore;
    workspaceStatusStore: WorkspaceStatusStore;
    gitCredentialStore?: Pick<GitCredentialStore, "renameOwnerUsername" | "deleteOwnerCredentials"> | null;
};
/**
 * 管理员用户维护服务接口。
 */
export type AdminUserMaintenanceService = {
    resetPassword(username: string, password: string): Promise<StoredUser>;
    renameUser(username: string, nextUsername: string): Promise<StoredUser>;
    deleteUser(username: string): Promise<void>;
};
/**
 * 基于现有 store 组合出管理员级用户维护能力。
 */
export declare function createAdminUserMaintenanceService(options: CreateAdminUserMaintenanceServiceOptions): AdminUserMaintenanceService;
export {};
