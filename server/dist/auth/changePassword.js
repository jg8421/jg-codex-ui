"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = changePassword;
const password_1 = require("./password");
/**
 * 规范化“当前登录用户”用户名。
 */
function normalizeUsername(raw) {
    return String(raw ?? "").trim();
}
/**
 * 规范化密码输入；仅做必填校验，避免无关策略变化影响现有账号体系。
 */
function normalizePassword(raw, fieldName) {
    const password = String(raw ?? "");
    if (!password.trim())
        return { ok: false, details: `${fieldName} is required` };
    return { ok: true, password };
}
/**
 * 当前用户自助修改密码：
 * - 必须先校验旧密码；
 * - 新密码不能为空，且不能与旧密码相同；
 * - 只修改当前登录用户自己的密码。
 */
async function changePassword(input) {
    /**
     * 当前 session 对应用户名。
     */
    const username = normalizeUsername(input.username);
    if (!username) {
        return { ok: false, status: "unauthorized", details: "username is required" };
    }
    /**
     * 规范化后的旧密码输入。
     */
    const normalizedCurrentPassword = normalizePassword(input.currentPassword, "currentPassword");
    if (!normalizedCurrentPassword.ok) {
        return { ok: false, status: "invalid_request", details: normalizedCurrentPassword.details };
    }
    /**
     * 规范化后的新密码输入。
     */
    const normalizedNewPassword = normalizePassword(input.newPassword, "newPassword");
    if (!normalizedNewPassword.ok) {
        return { ok: false, status: "invalid_request", details: normalizedNewPassword.details };
    }
    if (normalizedCurrentPassword.password === normalizedNewPassword.password) {
        return { ok: false, status: "invalid_request", details: "new password must be different" };
    }
    /**
     * 当前持久化用户；若会话已失效或用户被删除，则拒绝本次改密。
     */
    const storedUser = await input.userStore.getUserByUsername(username);
    if (!storedUser) {
        return { ok: false, status: "unauthorized", details: "user not found" };
    }
    /**
     * 旧密码校验结果。
     */
    const isCurrentPasswordValid = await (0, password_1.verifyPassword)(normalizedCurrentPassword.password, storedUser.passwordHash);
    if (!isCurrentPasswordValid) {
        return { ok: false, status: "invalid_request", details: "current password is incorrect" };
    }
    await input.userStore.setUserPassword(username, normalizedNewPassword.password);
    return { ok: true };
}
//# sourceMappingURL=changePassword.js.map