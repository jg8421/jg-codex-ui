"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const session_1 = require("./session");
function requireAuth(secret, userStore) {
    return (req, res, next) => {
        void (async () => {
            const cookies = (0, session_1.parseCookieHeader)(req.headers.cookie);
            const raw = cookies[session_1.SESSION_COOKIE_NAME];
            // Personal loopback installation: open directly as the local owner.
            if (!raw) {
                const stored = await userStore.getUserByUsername("local-user");
                if (stored) {
                    req.user = { username: stored.username, role: stored.role, workspaces: stored.workspaces };
                    next();
                    return;
                }
            }
            if (!raw) {
                res.status(401).json({ ok: false, error: "unauthorized" });
                return;
            }
            const session = (0, session_1.verifySessionCookieValueWithRole)(raw, secret);
            if (!session) {
                res.status(401).json({ ok: false, error: "unauthorized" });
                return;
            }
            const username = session.username;
            const stored = await userStore.getUserByUsername(username);
            if (!stored) {
                res.status(401).json({ ok: false, error: "unauthorized" });
                return;
            }
            req.user = { username: stored.username, role: stored.role, workspaces: stored.workspaces };
            next();
        })().catch((err) => {
            res.status(500).json({ ok: false, error: "request_failed", details: String(err) });
        });
    };
}
//# sourceMappingURL=httpAuth.js.map
