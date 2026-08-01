/**
 * 读取 Git index 中指定 stage 的 blob 文本。
 *
 * 说明：
 * - 冲突文件在 index 中会同时存在 stage 1/2/3；
 * - stage 含义：1=base，2=ours，3=theirs；
 * - 使用 `git show :<stage>:<path>` 读取对应内容。
 */
export declare function getGitIndexStageTextOrThrow(opts: {
    repoRoot: string;
    pathspec: string;
    stage: 1 | 2 | 3;
}): Promise<string>;
/**
 * 读取冲突文件的 base/ours/theirs 三份文本。
 */
export declare function getGitConflictStageTriplet(opts: {
    repoRoot: string;
    pathspec: string;
}): Promise<{
    base: string;
    ours: string;
    theirs: string;
}>;
