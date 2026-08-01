import type { UserRole } from "../auth/userTypes";
export type UserAccessInfo = {
    username: string;
    role: UserRole;
    workspaces: string[];
};
export type AllowedRoots = {
    allowAnyRoot: boolean;
    roots: string[];
};
export declare function isPathWithinRoot(root: string, candidate: string): boolean;
export declare function resolveAllowedRootsForUser(user: Pick<UserAccessInfo, "role" | "workspaces"> | null | undefined): AllowedRoots;
export declare function assertCwdAllowedForUser(opts: {
    cwd: string;
    user: Pick<UserAccessInfo, "role" | "workspaces">;
}): Promise<string>;
