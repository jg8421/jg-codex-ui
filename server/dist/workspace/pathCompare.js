"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExactPathKey = toExactPathKey;
exports.isExactPathEqual = isExactPathEqual;
const node_path_1 = __importDefault(require("node:path"));
function isWindowsLikePath(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed)
        return false;
    if (trimmed.startsWith("\\\\"))
        return true;
    if (trimmed.startsWith("//"))
        return true;
    return /^[a-zA-Z]:[\\/]/.test(trimmed) || /^[a-zA-Z]:$/.test(trimmed);
}
function stripTrailingSeparatorsNonRootWin32(value) {
    const normalized = String(value ?? "");
    if (/^[a-zA-Z]:\\$/.test(normalized))
        return normalized;
    return normalized.replace(/[\\\/]+$/g, "");
}
function stripTrailingSlashNonRootPosix(value) {
    const normalized = String(value ?? "");
    if (normalized === "/")
        return "/";
    return normalized.replace(/\/+$/g, "");
}
function toExactPathKey(rawPath) {
    const trimmed = String(rawPath ?? "").trim();
    if (!trimmed)
        return "";
    if (isWindowsLikePath(trimmed)) {
        const resolved = node_path_1.default.win32.resolve(trimmed);
        const normalized = node_path_1.default.win32.normalize(resolved);
        const withoutTrailing = stripTrailingSeparatorsNonRootWin32(normalized);
        return withoutTrailing.toLowerCase();
    }
    const normalized = node_path_1.default.posix.normalize(trimmed);
    const withoutTrailing = stripTrailingSlashNonRootPosix(normalized);
    return withoutTrailing;
}
function isExactPathEqual(left, right) {
    const l = toExactPathKey(left);
    const r = toExactPathKey(right);
    return Boolean(l) && l === r;
}
//# sourceMappingURL=pathCompare.js.map