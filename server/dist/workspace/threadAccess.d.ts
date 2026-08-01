import type { UserRole } from "../auth/userTypes";
import type { CodexAppServer } from "../codex/codexAppServer";
type ThreadAccessUser = {
    username: string;
    role: UserRole;
    workspaces: string[];
};
/**
 * 断言当前用户可以访问指定 threadId。
 * 规则：threadId -> 读取 thread.cwd -> 复用 assertCwdAllowedForUser 校验是否在用户分配 workspaces 内。
 */
export declare function assertThreadAllowedForUser(opts: {
    threadId: string;
    user: ThreadAccessUser;
    codex: Pick<CodexAppServer, "readThread">;
}): Promise<{
    canonicalCwd: string;
}>;
export {};
