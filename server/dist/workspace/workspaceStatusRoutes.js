"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceStatusRoutes = createWorkspaceStatusRoutes;
const express_1 = __importDefault(require("express"));
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
/**
 * 创建“按当前用户返回工作目录状态汇总”的 API 路由。
 */
function createWorkspaceStatusRoutes(options) {
    const router = express_1.default.Router();
    router.get("/status", async (req, res) => {
        /**
         * username：当前已登录用户名。
         */
        const username = String(req.user?.username ?? "").trim();
        if (!username) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return;
        }
        try {
            const workspaceStatuses = await options.workspaceStatusStore.listWorkspaceStatusByUsername(username);
            res.json({
                ok: true,
                workspaceStatuses: workspaceStatuses.map((workspaceStatus) => ({
                    ...workspaceStatus,
                    cwd: (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(workspaceStatus.cwd ?? "")),
                })),
            });
        }
        catch (error) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(error) });
        }
    });
    return router;
}
//# sourceMappingURL=workspaceStatusRoutes.js.map