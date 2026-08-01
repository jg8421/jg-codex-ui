export type GitCommitSummaryFile = {
    /**
     * path：相对 repoRoot 的文件路径。
     */
    path: string;
    /**
     * crudLabel：面向用户的 CRUD 标签。
     */
    crudLabel: string;
};
/**
 * 构造“静默 Git 提交总结”的服务端提示词。
 * 说明：
 * - 只提供路径清单，不内联 diff/文件正文；
 * - 要求模型自行读取这些路径并在第一行输出建议提交信息。
 */
export declare function buildGitCommitSummaryPrompt(input: {
    repoRoot: string;
    branchName: string;
    files: GitCommitSummaryFile[];
}): string;
