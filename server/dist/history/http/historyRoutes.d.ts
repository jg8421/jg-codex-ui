import express from "express";
import type { Request, Response } from "express";
import type { HistoryQueryService } from "../query/historyQueryService";
/**
 * 线程访问校验函数签名。
 */
export type RequireThreadAccess = (req: Request, res: Response, threadId: string) => Promise<boolean>;
/**
 * 历史路由构造参数。
 */
export type CreateHistoryRoutesOptions = {
    historyQuery: HistoryQueryService;
    requireThreadAccess: RequireThreadAccess;
};
/**
 * 创建历史查询 HTTP 路由。
 */
export declare function createHistoryRoutes(options: CreateHistoryRoutesOptions): express.Router;
