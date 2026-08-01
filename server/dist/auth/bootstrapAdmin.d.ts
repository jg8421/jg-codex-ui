import type { UserStore } from "./userStore";
/**
 * 启动阶段管理员引导钩子（兼容历史调用链）。
 * 当前策略：不再自动创建默认 admin 账户，必须由初始化接口显式创建管理员。
 */
export declare function bootstrapAdmin(_store: UserStore): Promise<void>;
