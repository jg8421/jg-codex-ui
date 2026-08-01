"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGitCommitSummaryPrompt = buildGitCommitSummaryPrompt;
/**
 * 构造“静默 Git 提交总结”的服务端提示词。
 * 说明：
 * - 只提供路径清单，不内联 diff/文件正文；
 * - 要求模型自行读取这些路径并在第一行输出建议提交信息。
 */
function buildGitCommitSummaryPrompt(input) {
    // repoRoot：用于限定仓库边界，减少模型误读其他目录。
    const repoRoot = String(input.repoRoot ?? "").trim();
    // branchName：用于补充分支上下文。
    const branchName = String(input.branchName ?? "").trim();
    // files：本次允许参与总结的文件路径列表。
    const files = Array.isArray(input.files) ? input.files : [];
    // fileLines：按行列出路径，便于模型逐个读取。
    const fileLines = [];
    for (const file of files) {
        // path：相对仓库根目录的文件路径。
        const path = String(file?.path ?? "").trim();
        if (!path)
            continue;
        // crudLabel：附带增删改语义，帮助模型快速判断变更类型。
        const crudLabel = String(file?.crudLabel ?? "").trim() || "变更";
        fileLines.push(`- [${crudLabel}] ${path}`);
    }
    return [
        "你是一个资深软件工程师，请根据下面这些 Git 变更文件路径，总结本次提交内容。",
        "",
        "要求：",
        "- 你可以自行读取这些文件与相关 git 信息，但不要假设未列出的文件属于本次提交。",
        "- 必须用中文输出。",
        "- 只输出一个 JSON 对象，不要输出 Markdown、不要输出代码块说明、不要输出额外解释。",
        '- JSON 结构固定为：{"message":"type: subject","overview":["...","..."]}',
        "- `message` 必须符合 Conventional Commits 格式：`type: subject`，其中 type 只能使用 `feat`、`fix`、`docs`、`refactor`、`test`、`chore` 之一。",
        "- `subject` 必须简洁明确，聚焦本次变更结果，不要写完整口语句子，不要写“我将”“用于”“最后给出”等过程性表达。",
        "- `overview` 必须提供 2-4 条中文要点，每条聚焦一个关键修改，不要带“变更概要：”标题。",
        "- `overview` 每条尽量控制在 20-40 字，不要写成长段解释。",
        "- 不允许思考，不要输出任何思考内容、推理过程或中间分析。",
        "- 不要输出你的执行计划、分析步骤、待办列表，也不要写“我将先/我会先/接下来”等过程说明。",
        "- 如果仅凭路径无法准确判断，请自行读取文件内容后再总结。",
        "",
        `上下文：repoRoot=${repoRoot || "(unknown)"}；branch=${branchName || "(unknown)"}`,
        "",
        "文件清单：",
        fileLines.length ? fileLines.join("\n") : "- （无）",
    ].join("\n");
}
//# sourceMappingURL=gitCommitSummaryPrompt.js.map