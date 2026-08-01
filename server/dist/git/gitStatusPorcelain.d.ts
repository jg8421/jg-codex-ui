import type { GitStatusFile } from "./gitTypes";
/**
 * 解析 `git status --porcelain=v1 -z` 的 stdout 输出为结构化列表。
 *
 * 注意：
 * - `-z` 模式使用 `\0` 作为分隔符；
 * - rename/copy 条目会额外占用一个 token：`XY <from>\0<to>\0`；
 * - 这里不做路径合法性/安全校验，调用方需要基于 repoRoot 与 access control 再校验。
 */
export declare function parseGitStatusPorcelainZ(output: string): GitStatusFile[];
