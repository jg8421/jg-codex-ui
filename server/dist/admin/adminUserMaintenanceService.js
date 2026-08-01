"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminUserMaintenanceService = createAdminUserMaintenanceService;
const adminUserUploads_1 = require("./adminUserUploads");
/**
 * 规范化用户名输入。
 */
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 基于现有 store 组合出管理员级用户维护能力。
 */
function createAdminUserMaintenanceService(options) {
    return {
        async resetPassword(usernameRaw, passwordRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const password = String(passwordRaw ?? "");
            if (!password)
                throw new Error("password is required");
            return options.userStore.setUserPassword(username, password);
        },
        async renameUser(usernameRaw, nextUsernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const nextUsername = normalizeUsername(nextUsernameRaw);
            if (!nextUsername)
                throw new Error("next username is required");
            const renamedUser = await options.userStore.renameUser(username, nextUsername);
            await options.userWorkspaceStore.renameUserWorkspaceOwner(username, nextUsername);
            await options.userSettingsStore.renameUserSettingsOwner(username, nextUsername);
            await options.workspaceStatusStore.renameUsername(username, nextUsername);
            await options.gitCredentialStore?.renameOwnerUsername(username, nextUsername);
            await (0, adminUserUploads_1.renameUserUploadsDir)(username, nextUsername);
            return renamedUser;
        },
        async deleteUser(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            await options.userStore.deleteUser(username);
            await options.userWorkspaceStore.deleteUserWorkspaceDirs(username);
            await options.userSettingsStore.deleteUserSettings(username);
            await options.workspaceStatusStore.deleteUsername(username);
            await options.gitCredentialStore?.deleteOwnerCredentials(username);
            await (0, adminUserUploads_1.deleteUserUploadsDir)(username);
        },
    };
}
//# sourceMappingURL=adminUserMaintenanceService.js.map