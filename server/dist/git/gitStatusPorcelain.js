"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGitStatusPorcelainZ = parseGitStatusPorcelainZ;
/**
 * 判断某个 porcelain XY 组合是否表示“未合并/冲突”状态。
 *
 * 参考：`git status --porcelain=v1` 的 unmerged 状态组合。
 */
function isPorcelainUnmerged(x, y) {
    // x/y 任一为 U：典型冲突组合（UU/AU/UA/UD/DU 等）。
    if (x === "U" || y === "U")
        return true;
    // AA/DD：双方都新增/双方都删除，也属于冲突。
    if (x === "A" && y === "A")
        return true;
    if (x === "D" && y === "D")
        return true;
    return false;
}
/**
 * 解析 `git status --porcelain=v1 -z` 的 stdout 输出为结构化列表。
 *
 * 注意：
 * - `-z` 模式使用 `\0` 作为分隔符；
 * - rename/copy 条目会额外占用一个 token：`XY <from>\0<to>\0`；
 * - 这里不做路径合法性/安全校验，调用方需要基于 repoRoot 与 access control 再校验。
 */
function parseGitStatusPorcelainZ(output) {
    // tokens：按 NUL 分隔后的原始条目片段；rename/copy 会包含额外的 “to” token。
    const tokens = String(output ?? "").split("\0");
    // files：最终输出的文件状态列表。
    const files = [];
    let idx = 0;
    while (idx < tokens.length) {
        // raw：单个条目的首 token（`XY <path>` 或 `XY <from>`）。
        const raw = tokens[idx];
        if (!raw) {
            idx += 1;
            continue;
        }
        // porcelain v1：前 2 个字符为状态，第三个字符通常为空格。
        if (raw.length < 3) {
            idx += 1;
            continue;
        }
        // x/y：index/worktree 状态字符。
        const x = raw[0] ?? " ";
        const y = raw[1] ?? " ";
        // pathPart：raw 的 path 部分（跳过 `XY `）。
        const pathPart = raw.slice(3);
        // untracked：`??`。
        const untracked = x === "?" && y === "?";
        // staged/unstaged：用于 UI 快速判断。
        const staged = !untracked && x !== " ";
        const unstaged = !untracked && y !== " ";
        // conflicted：是否为未合并/冲突状态（用于 UI 冲突解决入口）。
        const conflicted = !untracked && isPorcelainUnmerged(x, y);
        // rename/copy：`R`/`C` 会附带一个额外的 token 作为目标路径。
        const isRenameOrCopy = x === "R" || x === "C" || y === "R" || y === "C";
        // finalPath：默认使用 pathPart；rename/copy 时使用下一 token。
        let finalPath = pathPart;
        // renamedFrom：rename/copy 的来源路径（旧路径）。
        let renamedFrom;
        if (isRenameOrCopy) {
            const to = tokens[idx + 1];
            if (typeof to === "string" && to) {
                renamedFrom = pathPart;
                finalPath = to;
                idx += 2;
            }
            else {
                // 异常输出兜底：缺失 to token 时按单 token 处理，避免死循环。
                idx += 1;
            }
        }
        else {
            idx += 1;
        }
        // 空 path 兜底：跳过无效条目。
        const normalizedPath = String(finalPath ?? "");
        if (!normalizedPath)
            continue;
        files.push({
            path: normalizedPath,
            x,
            y,
            untracked,
            staged,
            unstaged,
            conflicted,
            renamedFrom,
        });
    }
    return files;
}
//# sourceMappingURL=gitStatusPorcelain.js.map