"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertThreadAllowedForUser = assertThreadAllowedForUser;
const roles_1 = require("../auth/roles");
const accessControl_1 = require("./accessControl");
/**
 * 断言当前用户可以访问指定 threadId。
 * 规则：threadId -> 读取 thread.cwd -> 复用 assertCwdAllowedForUser 校验是否在用户分配 workspaces 内。
 */
async function assertThreadAllowedForUser(opts) {
    // admin 默认允许访问所有线程（更细粒度的隔离需要 codex/app-server 侧支持）。
    if ((0, roles_1.isAdminRole)(opts.user.role)) {
        return { canonicalCwd: "" };
    }
    // member：通过 thread.cwd 复用 cwd 访问控制校验，确保 thread 在授权 workspaces 内。
    const thread = await opts.codex.readThread(opts.threadId, false);
    const cwd = String(thread?.cwd ?? "").trim();
    if (!cwd)
        throw new Error("cwd not allowed");
    const canonicalCwd = await (0, accessControl_1.assertCwdAllowedForUser)({ cwd, user: opts.user });
    return { canonicalCwd };
}
//# sourceMappingURL=threadAccess.js.map