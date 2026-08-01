import type { StoredUser } from "../auth/userTypes";
import type { UserAccessInfo } from "./accessControl";
export type ThreadListVisibilityUser = Pick<UserAccessInfo, "role" | "workspaces">;
export type WorkspaceRoutingSnapshot = {
    updatedAtMs: number;
    rootsDesc: string[];
};
export declare function normalizeWorkspacePaths(workspaces: string[]): string[];
export declare function buildWorkspaceRoutingSnapshot(users: Array<Pick<StoredUser, "role" | "workspaces">>): WorkspaceRoutingSnapshot;
export declare function resolveWorkspaceRootForCwd(snapshot: WorkspaceRoutingSnapshot, cwd: string): string | null;
export declare function resolveThreadListWorkspaceFilter(requestedCwd: unknown, user: ThreadListVisibilityUser): Promise<string | null>;
export declare function normalizeThreadCwd(rawThreadCwd: unknown): string;
export declare function isThreadCwdVisibleToUser(input: {
    cwd: string;
    user: ThreadListVisibilityUser;
    routingSnapshot: WorkspaceRoutingSnapshot | null;
}): boolean;
export declare function shouldIncludeThreadForList(input: {
    thread: {
        cwd?: unknown;
    };
    user: ThreadListVisibilityUser;
    workspaceFilterCwd: string | null;
    routingSnapshot: WorkspaceRoutingSnapshot | null;
}): boolean;
