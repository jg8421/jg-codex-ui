"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CwdSuggestError = void 0;
exports.suggestCwds = suggestCwds;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../env");
const windowsVerbatimPath_1 = require("../workspace/windowsVerbatimPath");
// 目录建议接口的可预期错误类型（客户端可据此展示更友好的提示）。
class CwdSuggestError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "CwdSuggestError";
        this.code = code;
    }
}
exports.CwdSuggestError = CwdSuggestError;
// 判断 candidate 是否位于 root 目录之下（含 root 本身）。
function isPathWithinRoot(root, candidate) {
    const rel = path_1.default.relative(root, candidate);
    if (!rel)
        return true;
    if (rel.startsWith(".."))
        return false;
    if (path_1.default.isAbsolute(rel))
        return false;
    return true;
}
// 统一限制返回数量，避免 readdir 结果过大影响响应时间。
function normalizeLimit(raw) {
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(n))
        return 50;
    const limit = Math.floor(n);
    if (limit <= 0)
        return 50;
    return Math.min(100, limit);
}
// 将用户输入解析为“要列举的目录(listDir) + 目录名匹配前缀(namePrefix)”。
function parseQuery(query) {
    const trimmed = query.trim();
    const normalized = trimmed.replace(/[\\/]+/g, path_1.default.sep);
    const endsWithSep = normalized.endsWith(path_1.default.sep);
    const listDirRaw = endsWithSep ? normalized : path_1.default.dirname(normalized);
    const namePrefix = endsWithSep ? "" : path_1.default.basename(normalized);
    return { listDir: listDirRaw, namePrefix };
}
// 在可能存在权限/平台差异时，realpath 失败则回退到 resolve，以确保逻辑可继续执行。
async function resolveRealpathOrFallback(candidate) {
    const rawCandidate = String(candidate ?? "");
    return fs_1.default.promises
        .realpath(rawCandidate)
        .then((realpathValue) => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(realpathValue))
        .catch(() => (0, windowsVerbatimPath_1.stripWindowsVerbatimPathPrefix)(path_1.default.resolve(rawCandidate)));
}
// 校验 listDir 真实路径是否位于允许范围内：
// - allowAnyRoot=true：admin 不限制；
// - 提供 allowedRoots：按调用方传入范围（通常是管理员分配目录）；
// - 未提供 allowedRoots：回退到 CODEX_ALLOWED_CWD_ROOTS 全局边界。
async function ensureListDirAllowed(listDir, opts) {
    const resolved = path_1.default.resolve(listDir);
    const real = await resolveRealpathOrFallback(resolved);
    if (opts.allowAnyRoot)
        return real;
    // 上层显式传入 allowedRoots 时，优先按该范围校验（例如用户分配目录）。
    const allowedRoots = (opts.allowedRoots ?? []).filter(Boolean);
    if (allowedRoots.length) {
        const allowedRootsReal = await Promise.all(allowedRoots.map((root) => resolveRealpathOrFallback(root)));
        const allowed = allowedRootsReal.some((root) => isPathWithinRoot(root, real));
        if (!allowed)
            throw new CwdSuggestError("path_not_allowed", "path not allowed");
        return real;
    }
    // 未提供 allowedRoots 时，退化为全局边界校验，保持独立调用场景安全。
    const globalRoots = (0, env_1.getCodexAllowedCwdRoots)().filter(Boolean);
    if (!globalRoots.length)
        throw new CwdSuggestError("path_not_allowed", "path not allowed");
    const globalRootsReal = await Promise.all(globalRoots.map((root) => resolveRealpathOrFallback(root)));
    const withinGlobal = globalRootsReal.some((root) => isPathWithinRoot(root, real));
    if (!withinGlobal)
        throw new CwdSuggestError("path_not_allowed", "path not allowed");
    return real;
}
// 列举 listDir 下满足“目录 + namePrefix 前缀匹配”的子目录，按字典序排序后返回。
async function listDirectorySuggestions(listDir, namePrefix, limit) {
    let dirents;
    try {
        dirents = await fs_1.default.promises.readdir(listDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const out = [];
    for (const d of dirents) {
        if (!d.isDirectory())
            continue;
        if (namePrefix && !d.name.startsWith(namePrefix))
            continue;
        out.push(path_1.default.join(listDir, d.name));
        if (out.length >= limit)
            break;
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
}
// 返回用于“工作区添加/切换”的服务器目录建议列表（右模糊：前缀匹配）。
async function suggestCwds(opts) {
    const rawQuery = String(opts.query ?? "").trim();
    if (!rawQuery)
        return [];
    if (rawQuery.includes("\0"))
        throw new CwdSuggestError("invalid_query", "invalid query");
    const { listDir, namePrefix } = parseQuery(rawQuery);
    const baseCwd = path_1.default.resolve((0, env_1.getCodexCwd)());
    const resolvedListDir = path_1.default.isAbsolute(listDir) ? path_1.default.resolve(listDir) : path_1.default.resolve(baseCwd, listDir);
    let st;
    try {
        st = await fs_1.default.promises.stat(resolvedListDir);
    }
    catch {
        return [];
    }
    if (!st.isDirectory())
        return [];
    const allowedListDir = await ensureListDirAllowed(resolvedListDir, { allowAnyRoot: Boolean(opts.allowAnyRoot), allowedRoots: opts.allowedRoots });
    const limit = normalizeLimit(opts.limit);
    return listDirectorySuggestions(allowedListDir, namePrefix, limit);
}
//# sourceMappingURL=cwdSuggest.js.map