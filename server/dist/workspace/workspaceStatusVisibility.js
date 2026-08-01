"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVisibleUsernamesForCwd = resolveVisibleUsernamesForCwd;
const node_path_1 = __importDefault(require("node:path"));
const accessControl_1 = require("./accessControl");
const windowsVerbatimPath_1 = require("./windowsVerbatimPath");
/**
 * 解析对指定 cwd 可见的用户名列表：
 * - admin 永远可见；
 * - member 仅在其分配工作区根目录覆盖该 cwd 时可见。
 */
function resolveVisibleUsernamesForCwd(cwdRaw, users) {
    /**
     * normalizedCwd：标准化后的线程工作目录。
     */
    const normalizedCwd = node_path_1.default.resolve((0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(String(cwdRaw ?? "").trim()));
    if (!normalizedCwd)
        return [];
    /**
     * visibleUsernames：最终可见用户名列表（去重保序）。
     */
    const visibleUsernames = [];
    const seen = new Set();
    for (const user of users ?? []) {
        /**
         * username：规范化后的用户名；空值直接忽略。
         */
        const username = String(user?.username ?? "").trim();
        if (!username || seen.has(username))
            continue;
        const access = (0, accessControl_1.resolveAllowedRootsForUser)(user);
        const canSeeCwd = access.allowAnyRoot || access.roots.some((root) => (0, accessControl_1.isPathWithinRoot)(root, normalizedCwd));
        if (!canSeeCwd)
            continue;
        seen.add(username);
        visibleUsernames.push(username);
    }
    return visibleUsernames;
}
//# sourceMappingURL=workspaceStatusVisibility.js.map