"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const roles_1 = require("./roles");
// 要求当前请求用户为 admin；用于保护用户管理与其他高权限接口。
function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (!(0, roles_1.isAdminRole)(role)) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
    }
    next();
}
//# sourceMappingURL=requireAdmin.js.map