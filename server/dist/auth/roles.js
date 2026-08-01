"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminUsername = isAdminUsername;
exports.isAdminRole = isAdminRole;
// 统一定义“admin”身份判断，避免在各处散落魔法字符串。
function isAdminUsername(username) {
    return String(username ?? "").trim() === "admin";
}
// 统一定义“admin”角色判断：未来如果新增更多角色，也便于集中维护。
function isAdminRole(role) {
    return String(role ?? "").trim() === "admin";
}
//# sourceMappingURL=roles.js.map