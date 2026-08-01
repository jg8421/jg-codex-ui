import express from "express";
import type { CodexMcpCli } from "../codex/codexMcpCli";
type CreateMcpAdminRoutesOptions = {
    codexMcp: CodexMcpCli | null;
};
export declare function createMcpAdminRoutes(opts: CreateMcpAdminRoutesOptions): express.Router;
export {};
