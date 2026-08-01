"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapAdmin = bootstrapAdmin;
/**
 * 启动阶段管理员引导钩子（兼容历史调用链）。
 * 当前策略：不再自动创建默认 admin 账户，必须由初始化接口显式创建管理员。
 */
async function bootstrapAdmin(_store) {
    // no-op: 管理员初始化入口统一收敛到 /api/auth/bootstrap-admin/setup。
}
//# sourceMappingURL=bootstrapAdmin.js.map