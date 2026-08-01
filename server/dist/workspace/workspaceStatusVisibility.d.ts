import type { StoredUser } from "../auth/userTypes";
/**
 * 解析对指定 cwd 可见的用户名列表：
 * - admin 永远可见；
 * - member 仅在其分配工作区根目录覆盖该 cwd 时可见。
 */
export declare function resolveVisibleUsernamesForCwd(cwdRaw: string, users: StoredUser[]): string[];
