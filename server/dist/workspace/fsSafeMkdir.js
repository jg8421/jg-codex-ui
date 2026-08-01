"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoryExists = ensureDirectoryExists;
/**
 * 确保目录存在：
 * - 已存在且为目录：直接返回（避免对 Windows 盘符根目录 `C:\` 等路径执行 mkdir 触发 EPERM）
 * - 不存在（ENOENT）：创建目录（recursive）
 * - 已存在但不是目录：抛出与 cwd 校验一致的错误格式
 */
async function ensureDirectoryExists(fsOps, dirPath) {
    const existingStat = await fsOps
        .stat(dirPath)
        .then((st) => st)
        .catch((error) => {
        const code = String(error?.code ?? "");
        if (code === "ENOENT")
            return null;
        throw error;
    });
    if (existingStat) {
        if (!existingStat.isDirectory()) {
            throw new Error(`cwd is not a directory: ${dirPath}`);
        }
        return;
    }
    await fsOps.mkdir(dirPath, { recursive: true });
}
//# sourceMappingURL=fsSafeMkdir.js.map