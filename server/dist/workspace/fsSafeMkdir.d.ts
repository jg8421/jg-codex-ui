import type * as fs from "node:fs/promises";
export type FsOps = Pick<typeof fs, "mkdir" | "stat">;
/**
 * 确保目录存在：
 * - 已存在且为目录：直接返回（避免对 Windows 盘符根目录 `C:\` 等路径执行 mkdir 触发 EPERM）
 * - 不存在（ENOENT）：创建目录（recursive）
 * - 已存在但不是目录：抛出与 cwd 校验一致的错误格式
 */
export declare function ensureDirectoryExists(fsOps: FsOps, dirPath: string): Promise<void>;
