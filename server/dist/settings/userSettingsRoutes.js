"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSettingsRoutes = createUserSettingsRoutes;
const express_1 = __importDefault(require("express"));
const userSettingsTypes_1 = require("./userSettingsTypes");
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
/**
 * 从请求中读取已鉴权用户名；缺失时返回 401。
 */
function resolveAuthenticatedUsername(req, res) {
    const username = String(req?.user?.username ?? "").trim();
    if (!username) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return null;
    }
    return username;
}
/**
 * 对外返回给前端的用户配置：剥离 Windows `\\?\` 前缀，避免 UI 展示异常。
 */
function sanitizeUserSettingsForClient(settings) {
    // 原始 defaultWorkspace（允许为空）。
    const rawDefaultWorkspace = settings.defaultWorkspace;
    if (!rawDefaultWorkspace)
        return settings;
    // 剥离 verbatim 前缀后的 defaultWorkspace。
    const sanitizedDefaultWorkspace = (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(rawDefaultWorkspace);
    if (sanitizedDefaultWorkspace === rawDefaultWorkspace)
        return settings;
    return { ...settings, defaultWorkspace: sanitizedDefaultWorkspace };
}
/**
 * 创建用户配置同步 API 路由。
 */
function createUserSettingsRoutes(opts) {
    const router = express_1.default.Router();
    router.get("/", async (req, res) => {
        const username = resolveAuthenticatedUsername(req, res);
        if (!username)
            return;
        try {
            const settings = await opts.userSettingsStore.getUserSettings(username);
            const sanitizedSettings = sanitizeUserSettingsForClient(settings);
            res.json({ ok: true, settings: sanitizedSettings });
        }
        catch (error) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(error) });
        }
    });
    router.put("/", async (req, res) => {
        const username = resolveAuthenticatedUsername(req, res);
        if (!username)
            return;
        try {
            const body = (req.body ?? {});
            // 兼容两种 payload：`{ settings: ... }` 或直接顶层 settings 对象。
            const rawSettings = Object.prototype.hasOwnProperty.call(body, "settings") ? body.settings : body;
            const normalizedSettings = (0, userSettingsTypes_1.normalizeUserSettings)(rawSettings);
            // 入库前先剥离 Windows `\\?\` 前缀，避免把 verbatim 形式写进用户配置。
            const sanitizedSettings = sanitizeUserSettingsForClient(normalizedSettings);
            const settings = await opts.userSettingsStore.replaceUserSettings(username, sanitizedSettings);
            const sanitizedOutput = sanitizeUserSettingsForClient(settings);
            res.json({ ok: true, settings: sanitizedOutput });
        }
        catch (error) {
            res.status(500).json({ ok: false, error: "request_failed", details: String(error) });
        }
    });
    return router;
}
//# sourceMappingURL=userSettingsRoutes.js.map