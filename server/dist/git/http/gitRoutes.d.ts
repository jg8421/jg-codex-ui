import express from "express";
import type { GitAuthenticatedCommandRunner } from "../gitAuthenticatedCommand";
import type { GitCredentialStore } from "../gitCredentialStore";
import type { GitPushMetadataStore } from "../gitPushMetadataStore";
type CreateGitRoutesOptions = {
    gitCredentialStore?: GitCredentialStore | null;
    gitPushMetadataStore?: GitPushMetadataStore | null;
    gitAuthenticatedCommandRunner: GitAuthenticatedCommandRunner;
};
/**
 * 创建基于 cwd 的 Git HTTP 路由：
 * - GET `/status?cwd=...`
 * - GET `/branches?cwd=...`
 * - GET `/log?cwd=...&limit=...`
 * - POST `/commit` body: { cwd, message, files }
 * - POST `/switch` body: { cwd, action, ... }
 * - POST `/pull` body: { cwd, mode }
 * - POST `/push` body: { cwd }
 */
export declare function createGitRoutes(options: CreateGitRoutesOptions): express.Router;
export {};
