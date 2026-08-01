"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitPushMetadataStore = createGitPushMetadataStore;
exports.createInMemoryGitPushMetadataStore = createInMemoryGitPushMetadataStore;
const node_path_1 = __importDefault(require("node:path"));
const authDb_1 = require("../auth/sqlite/authDb");
const sqliteGitPushMetadataStore_1 = require("./sqlite/sqliteGitPushMetadataStore");
/**
 * 解析 Git push 元数据仓库所使用的 SQLite 路径。
 */
function resolveGitPushMetadataStoreDbPath(options) {
    const rawDbPath = String(options.dbPath ?? options.filePath ?? "").trim();
    if (!rawDbPath)
        throw new Error("git push metadata store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
/**
 * 创建基于 SQLite 的 Git push 元数据仓库。
 */
function createGitPushMetadataStore(options) {
    const authDb = options.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveGitPushMetadataStoreDbPath(options) });
    return (0, sqliteGitPushMetadataStore_1.createSqliteGitPushMetadataStore)({ authDb });
}
/**
 * 创建内存版 Git push 元数据仓库。
 */
function createInMemoryGitPushMetadataStore() {
    // pushedAtByKey：使用 `repoRoot::branchName::commitHash` 作为唯一键，便于测试默认场景复用。
    const pushedAtByKey = new Map();
    /**
     * 生成内存 key，避免重复拼接逻辑散落各处。
     */
    function buildMemoryKey(repoRoot, branchName, commitHash) {
        return `${repoRoot}::${branchName}::${commitHash}`;
    }
    return {
        async listPushedCommits(input) {
            const repoRoot = String(input.repoRoot ?? "").trim();
            const branchName = String(input.branchName ?? "").trim();
            const out = new Map();
            for (const rawCommitHash of input.commitHashes) {
                const commitHash = String(rawCommitHash ?? "").trim();
                if (!repoRoot || !branchName || !commitHash)
                    continue;
                const pushedAt = pushedAtByKey.get(buildMemoryKey(repoRoot, branchName, commitHash));
                if (!pushedAt)
                    continue;
                out.set(commitHash, pushedAt);
            }
            return out;
        },
        async upsertPushedCommits(input) {
            const repoRoot = String(input.repoRoot ?? "").trim();
            const branchName = String(input.branchName ?? "").trim();
            const pushedAt = String(input.pushedAt ?? "").trim();
            if (!repoRoot || !branchName || !pushedAt)
                return;
            for (const rawCommitHash of input.commitHashes) {
                const commitHash = String(rawCommitHash ?? "").trim();
                if (!commitHash)
                    continue;
                pushedAtByKey.set(buildMemoryKey(repoRoot, branchName, commitHash), pushedAt);
            }
        },
    };
}
//# sourceMappingURL=gitPushMetadataStore.js.map