/**
 * 校验分支短名是否合法（使用 git 原生命令，避免自行实现复杂规则）。
 *
 * 说明：
 * - 该校验不要求当前目录已是 Git 仓库；
 * - 用于 `git init -b <name>`、创建/切换分支等场景的输入防御。
 */
export declare function assertValidBranchShortName(cwd: string, branchName: string): Promise<void>;
