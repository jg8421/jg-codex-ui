import type { UserStore } from "./userStore";
export type ChangePasswordResult = {
    ok: true;
} | {
    ok: false;
    status: "invalid_request";
    details: string;
} | {
    ok: false;
    status: "unauthorized";
    details: string;
};
/**
 * 当前用户自助修改密码：
 * - 必须先校验旧密码；
 * - 新密码不能为空，且不能与旧密码相同；
 * - 只修改当前登录用户自己的密码。
 */
export declare function changePassword(input: {
    userStore: Pick<UserStore, "getUserByUsername" | "setUserPassword">;
    username: unknown;
    currentPassword: unknown;
    newPassword: unknown;
}): Promise<ChangePasswordResult>;
