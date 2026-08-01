"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpAdminRoutes = createMcpAdminRoutes;
const express_1 = __importDefault(require("express"));
const requireAdmin_1 = require("../auth/requireAdmin");
function normalizeName(name) {
    return String(name ?? "").trim();
}
function normalizeUrl(url) {
    return String(url ?? "").trim();
}
function createMcpAdminRoutes(opts) {
    const router = express_1.default.Router();
    router.use(requireAdmin_1.requireAdmin);
    router.get("/servers", async (_req, res) => {
        if (!opts.codexMcp) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        try {
            const servers = await opts.codexMcp.listServers();
            res.json({ ok: true, servers });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: "list_failed", details: String(err) });
        }
    });
    router.post("/add", async (req, res) => {
        if (!opts.codexMcp) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const name = normalizeName(body.name);
        const url = normalizeUrl(body.url);
        if (!name || !url) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            await opts.codexMcp.addUrlServer({ name, url });
            res.json({ ok: true });
        }
        catch (err) {
            res.status(400).json({ ok: false, error: "add_failed", details: String(err) });
        }
    });
    router.post("/remove", async (req, res) => {
        if (!opts.codexMcp) {
            res.status(501).json({ ok: false, error: "not_supported" });
            return;
        }
        const body = (req.body ?? {});
        const name = normalizeName(body.name);
        if (!name) {
            res.status(400).json({ ok: false, error: "invalid_input" });
            return;
        }
        try {
            await opts.codexMcp.removeServer({ name });
            res.json({ ok: true });
        }
        catch (err) {
            res.status(400).json({ ok: false, error: "remove_failed", details: String(err) });
        }
    });
    return router;
}
//# sourceMappingURL=mcpAdminRoutes.js.map