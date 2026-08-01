import type { StoredUser } from "./userTypes";
import type { UserStore } from "./userStore";
export type AdminInitState = {
    adminExists: boolean;
    isDefaultPassword: boolean;
    requiresSetup: boolean;
};
/**
 * 读取 admin 初始化状态：
 * - admin 不存在：requiresSetup=true；
 * - admin 存在但仍为默认口令：requiresSetup=true；
 * - admin 已设置过非默认口令：requiresSetup=false。
 */
export declare function readAdminInitState(store: Pick<UserStore, "listUsers">): Promise<AdminInitState>;
export type SetupAdminPasswordResult = {
    ok: true;
    status: "created" | "updated";
    user: StoredUser;
} | {
    ok: false;
    status: "already_configured";
} | {
    ok: false;
    status: "invalid_username";
    details: string;
} | {
    ok: false;
    status: "invalid_password";
    details: string;
} | {
    ok: false;
    status: "invalid_workspace";
    details: string;
};
/**
 * 初始化/更新 admin 密码：
 * - admin 不存在：创建 admin，并分配初始化填写的工作区；
 * - admin 存在且仍为默认口令：仅更新密码；
 * - admin 已配置过：返回 already_configured。
 */
export declare function setupAdminPassword(input: {
    store: Pick<UserStore, "getUserByUsername" | "createUser" | "setUserPassword" | "assignWorkspaces" | "listUsers">;
    username: unknown;
    password: unknown;
    workspace: unknown;
}): Promise<SetupAdminPasswordResult>;
