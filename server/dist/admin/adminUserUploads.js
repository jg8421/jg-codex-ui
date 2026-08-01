"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserUploadsDir = getUserUploadsDir;
exports.renameUserUploadsDir = renameUserUploadsDir;
exports.deleteUserUploadsDir = deleteUserUploadsDir;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../env");
const accessControl_1 = require("../workspace/accessControl");
/**
 * 将用户名映射到安全的上传目录名，避免目录穿越与非法文件名。
 */
function toSafeUploadUsername(username) {
    return String(username ?? "").replace(/[^a-zA-Z0-9._-]/g, "_") || "user";
}
/**
 * 计算某个用户的上传目录路径及其是否位于 Codex 工作目录内。
 */
function getUserUploadsDir(username) {
    const safeUser = toSafeUploadUsername(username);
    const codexCwd = node_path_1.default.resolve((0, env_1.getCodexCwd)());
    const uploadBaseDir = node_path_1.default.resolve((0, env_1.getWebUploadBaseDir)());
    const withinCodexCwd = (0, accessControl_1.isPathWithinRoot)(codexCwd, uploadBaseDir);
    return {
        dir: node_path_1.default.join(uploadBaseDir, safeUser),
        withinCodexCwd,
    };
}
/**
 * 将旧用户名的上传目录迁移到新用户名目录；旧目录不存在时视为无操作。
 */
async function renameUserUploadsDir(username, nextUsername) {
    const currentUploadsDir = getUserUploadsDir(username).dir;
    const nextUploadsDir = getUserUploadsDir(nextUsername).dir;
    if (currentUploadsDir === nextUploadsDir)
        return;
    const currentExists = await promises_1.default
        .stat(currentUploadsDir)
        .then((stat) => stat.isDirectory())
        .catch(() => false);
    if (!currentExists)
        return;
    const nextExists = await promises_1.default
        .stat(nextUploadsDir)
        .then((stat) => stat.isDirectory())
        .catch(() => false);
    if (nextExists) {
        throw new Error(`target uploads dir already exists: ${nextUploadsDir}`);
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(nextUploadsDir), { recursive: true });
    await promises_1.default.rename(currentUploadsDir, nextUploadsDir);
}
/**
 * 删除指定用户名对应的上传目录；目录不存在时视为无操作。
 */
async function deleteUserUploadsDir(username) {
    const uploadsDir = getUserUploadsDir(username).dir;
    await promises_1.default.rm(uploadsDir, { recursive: true, force: true });
}
//# sourceMappingURL=adminUserUploads.js.map