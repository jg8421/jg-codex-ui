import type { Router } from "express";
import type { UserSettingsStore } from "./userSettingsStore";
/**
 * 创建用户配置同步 API 路由。
 */
export declare function createUserSettingsRoutes(opts: {
    userSettingsStore: UserSettingsStore;
}): Router;
