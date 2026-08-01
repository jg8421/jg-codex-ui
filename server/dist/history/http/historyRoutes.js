"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistoryRoutes = createHistoryRoutes;
const express_1 = __importDefault(require("express"));
const env_1 = require("../../env");
/**
 * 解析消息查询 limit，范围 [1, 500]。
 */
function parseHistoryLimit(rawLimit, defaultLimit) {
    const parsedLimit = Number(rawLimit);
    if (!Number.isFinite(parsedLimit))
        return Math.min(500, Math.max(1, Math.floor(defaultLimit)));
    return Math.min(500, Math.max(1, Math.floor(parsedLimit)));
}
/**
 * 解析 beforeTs；非法值返回 null（表示不启用 before 过滤）。
 */
function parseBeforeTs(rawBeforeTs) {
    const parsedBeforeTs = Number(rawBeforeTs);
    if (!Number.isFinite(parsedBeforeTs))
        return null;
    return Math.max(0, Math.floor(parsedBeforeTs));
}
/**
 * 将异常序列化为可返回给前端的结构：
 * - details：始终返回可读的错误文本；
 * - stack：仅在非生产环境或 admin 账号下返回（便于定位线上 500）。
 */
function serializeHistoryRouteError(req, err) {
    const details = String(err);
    const stack = err instanceof Error ? String(err.stack ?? "") : "";
    const userRole = String(req?.user?.role ?? "").trim();
    const includeStack = process.env.NODE_ENV !== "production" || userRole === "admin";
    if (!includeStack || !stack)
        return { details };
    return { details, stack };
}
/**
 * 创建历史查询 HTTP 路由。
 */
function createHistoryRoutes(options) {
    const router = express_1.default.Router();
    router.get("/threads/:threadId/messages", async (req, res) => {
        const threadId = String(req.params.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        try {
            if (!(await options.requireThreadAccess(req, res, threadId)))
                return;
            const limit = parseHistoryLimit(req.query?.limit, (0, env_1.getWebHistoryPageLimit)());
            const beforeTs = parseBeforeTs(req.query?.beforeTs);
            const items = await options.historyQuery.listMessages({ threadId, limit, beforeTs });
            res.json({ ok: true, items });
        }
        catch (err) {
            const serialized = serializeHistoryRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("history routes: list messages failed", { threadId, details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/threads/:threadId/file-changes", async (req, res) => {
        const threadId = String(req.params.threadId ?? "").trim();
        if (!threadId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        // listThreadFileChanges：专用索引链路；若未启用则返回 404，避免误用旧 messages 扫描接口。
        const listThreadFileChanges = options.historyQuery.listThreadFileChanges;
        if (typeof listThreadFileChanges !== "function") {
            res.status(404).json({ ok: false, error: "not_found" });
            return;
        }
        try {
            if (!(await options.requireThreadAccess(req, res, threadId)))
                return;
            const items = await Promise.resolve(listThreadFileChanges(threadId));
            res.json({ ok: true, items });
        }
        catch (err) {
            const serialized = serializeHistoryRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("history routes: list file changes failed", { threadId, details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/threads/:threadId/messages/:messageId/diff", async (req, res) => {
        const threadId = String(req.params.threadId ?? "").trim();
        const messageId = String(req.params.messageId ?? "").trim();
        if (!threadId || !messageId) {
            res.status(400).json({ ok: false, error: "invalid_request" });
            return;
        }
        const getMessageDiff = options.historyQuery.getMessageDiff;
        if (typeof getMessageDiff !== "function") {
            res.status(404).json({ ok: false, error: "not_found" });
            return;
        }
        try {
            if (!(await options.requireThreadAccess(req, res, threadId)))
                return;
            const diff = await getMessageDiff({ threadId, messageId });
            if (!diff) {
                res.status(404).json({ ok: false, error: "not_found" });
                return;
            }
            res.json({ ok: true, diff });
        }
        catch (err) {
            const serialized = serializeHistoryRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("history routes: get message diff failed", { threadId, messageId, details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    return router;
}
//# sourceMappingURL=historyRoutes.js.map