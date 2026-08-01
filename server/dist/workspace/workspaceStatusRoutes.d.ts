import express from "express";
import type { WorkspaceStatusStore } from "./workspaceStatusStore";
type CreateWorkspaceStatusRoutesOptions = {
    workspaceStatusStore: WorkspaceStatusStore;
};
/**
 * 创建“按当前用户返回工作目录状态汇总”的 API 路由。
 */
export declare function createWorkspaceStatusRoutes(options: CreateWorkspaceStatusRoutesOptions): express.Router;
export {};
