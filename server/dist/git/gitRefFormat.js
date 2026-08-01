"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidBranchShortName = assertValidBranchShortName;
const gitCommand_1 = require("./gitCommand");
/**
 * 校验分支短名是否合法（使用 git 原生命令，避免自行实现复杂规则）。
 *
 * 说明：
 * - 该校验不要求当前目录已是 Git 仓库；
 * - 用于 `git init -b <name>`、创建/切换分支等场景的输入防御。
 */
async function assertValidBranchShortName(cwd, branchName) {
    // normalized：去掉用户输入首尾空白。
    const normalized = String(branchName ?? "").trim();
    if (!normalized)
        throw new Error("invalid_branch_name");
    // check：`git check-ref-format --branch <name>`，非 0 表示非法。
    const check = await (0, gitCommand_1.runGitCommand)({ cwd, args: ["check-ref-format", "--branch", normalized] });
    if (check.exitCode !== 0) {
        // details：尽量返回 git stderr，便于前端展示原因。
        const details = String(check.stderr || check.stdout || "invalid_branch_name").trim();
        throw new Error(details || "invalid_branch_name");
    }
}
//# sourceMappingURL=gitRefFormat.js.map