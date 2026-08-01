/**
 * 从 assistant 原文中提取“变更概要”正文行。
 */
export declare function extractCommitSummaryOverviewLines(rawText: string): string[];
/**
 * 组装统一的 Git 总结展示文本，确保始终包含“变更概要”段落。
 */
export declare function buildNormalizedCommitSummaryText(input: {
    rawText: string;
    message: string;
    fallbackOverviewLines?: string[];
}): string;
/**
 * 从 assistant 的总结文本中提取“建议提交信息”。
 * 说明：
 * - 优先解析显式标签（例如：`建议提交信息：feat: xxx`）；
 * - 如果没有显式标签，则回退到首个非空行；
 * - 返回值始终为单行，便于直接回填到 commit message 输入框。
 */
export declare function extractCommitSummaryMessage(rawText: string): string;
