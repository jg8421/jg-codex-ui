import type { NextFunction, Request, Response } from "express";
import type { UserStore } from "./userStore";
import type { UserRole } from "./userTypes";
declare global {
    namespace Express {
        interface Request {
            user?: {
                username: string;
                role: UserRole;
                workspaces: string[];
            };
        }
    }
}
export declare function requireAuth(secret: string, userStore: UserStore): (req: Request, res: Response, next: NextFunction) => void;
export {};
