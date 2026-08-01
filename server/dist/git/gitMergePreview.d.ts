export type Diff3Segment = {
    /**
     * 普通文本段（不包含冲突标记）。
     */
    kind: "text";
    /**
     * 文本内容（保留换行）。
     */
    text: string;
} | {
    /**
     * 冲突段（包含 ours/base/theirs 三部分）。
     */
    kind: "conflict";
    /**
     * ours 分支文本（保留换行）。
     */
    ours: string;
    /**
     * base 文本（保留换行）。
     */
    base: string;
    /**
     * theirs 分支文本（保留换行）。
     */
    theirs: string;
};
/**
 * 生成三方合并预览文本（包含 diff3 冲突标记）。
 *
 * 说明：
 * - 这里用 `git merge-file -p --diff3` 来生成可解析的冲突块；
 * - 通过临时文件传入 base/ours/theirs，避免 shell 管道与注入风险。
 */
export declare function buildGitMergePreviewText(opts: {
    repoRoot: string;
    base: string;
    ours: string;
    theirs: string;
}): Promise<string>;
/**
 * 解析 `git merge-file -p --diff3` 输出中的冲突标记，提取冲突块。
 *
 * 约定：
 * - 识别 `<<<<<<<` / `|||||||` / `=======` / `>>>>>>>` 四类行；
 * - 返回的文本段与 ours/base/theirs 块都尽量保留原始换行。
 */
export declare function parseDiff3ConflictMarkers(text: string): Diff3Segment[];
