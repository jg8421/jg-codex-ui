"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGitMergePreviewText = buildGitMergePreviewText;
exports.parseDiff3ConflictMarkers = parseDiff3ConflictMarkers;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const gitCommand_1 = require("./gitCommand");
/**
 * 将 CRLF 统一为 LF，便于按行解析冲突标记。
 */
function normalizeNewlinesToLf(text) {
    return String(text ?? "").replace(/\r\n/g, "\n");
}
/**
 * 生成三方合并预览文本（包含 diff3 冲突标记）。
 *
 * 说明：
 * - 这里用 `git merge-file -p --diff3` 来生成可解析的冲突块；
 * - 通过临时文件传入 base/ours/theirs，避免 shell 管道与注入风险。
 */
async function buildGitMergePreviewText(opts) {
    // repoRoot：用于执行 git merge-file 的工作目录。
    const repoRoot = String(opts.repoRoot ?? "").trim();
    // tmpDir：临时目录；每次调用独立创建，避免并发互相覆盖。
    const tmpDir = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "codex-git-merge-preview-"));
    // basePath/oursPath/theirsPath：merge-file 的输入文件路径。
    const basePath = node_path_1.default.join(tmpDir, "base.txt");
    const oursPath = node_path_1.default.join(tmpDir, "ours.txt");
    const theirsPath = node_path_1.default.join(tmpDir, "theirs.txt");
    try {
        await promises_1.default.writeFile(basePath, String(opts.base ?? ""), "utf8");
        await promises_1.default.writeFile(oursPath, String(opts.ours ?? ""), "utf8");
        await promises_1.default.writeFile(theirsPath, String(opts.theirs ?? ""), "utf8");
        const out = await (0, gitCommand_1.runGitCommand)({
            cwd: repoRoot,
            args: ["merge-file", "-p", "--diff3", oursPath, basePath, theirsPath],
        });
        // merge-file：exitCode=1 表示“有冲突”，但 stdout 仍然是可用的 diff3 标记文本；
        // exitCode=2 才表示命令执行失败。
        if (out.exitCode !== 0 && out.exitCode !== 1) {
            const details = String(out.stderr || out.stdout || "").trim() || "git merge-file failed";
            throw new Error(`git_merge_preview_failed: ${details}`);
        }
        return String(out.stdout ?? "");
    }
    finally {
        // 清理临时目录；失败也忽略，避免影响主流程。
        try {
            await promises_1.default.rm(tmpDir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    }
}
/**
 * 解析 `git merge-file -p --diff3` 输出中的冲突标记，提取冲突块。
 *
 * 约定：
 * - 识别 `<<<<<<<` / `|||||||` / `=======` / `>>>>>>>` 四类行；
 * - 返回的文本段与 ours/base/theirs 块都尽量保留原始换行。
 */
function parseDiff3ConflictMarkers(text) {
    // input：统一换行符，避免 Windows CRLF 影响 startsWith 判断。
    const input = normalizeNewlinesToLf(text);
    // lines：按行切分（不含 `\n`），后续会手动补回换行。
    const lines = input.split("\n");
    // segments：最终输出的分段列表。
    const segments = [];
    // buf：累计普通文本段。
    let buf = "";
    /**
     * 将当前 buf 刷入 segments（若非空）。
     */
    const flushText = () => {
        if (!buf)
            return;
        segments.push({ kind: "text", text: buf });
        buf = "";
    };
    let i = 0;
    while (i < lines.length) {
        // line：当前行（不含换行）。
        const line = lines[i] ?? "";
        // fullLine：把换行加回去，保证拼接后的文本尽可能接近原文。
        const fullLine = i === lines.length - 1 ? line : `${line}\n`;
        if (!line.startsWith("<<<<<<<")) {
            buf += fullLine;
            i += 1;
            continue;
        }
        // 进入冲突块：先刷出前面的普通文本。
        flushText();
        // ours/base/theirs：三个块文本。
        let ours = "";
        let base = "";
        let theirs = "";
        // 跳过 `<<<<<<< ...`
        i += 1;
        // 解析 ours：直到 `|||||||` 或 EOF。
        while (i < lines.length) {
            const l = lines[i] ?? "";
            if (l.startsWith("|||||||"))
                break;
            const fl = i === lines.length - 1 ? l : `${l}\n`;
            ours += fl;
            i += 1;
        }
        // 若缺失 diff3 base 标记，则按空 base 继续解析（容错）。
        if (i < lines.length && (lines[i] ?? "").startsWith("|||||||")) {
            i += 1; // 跳过 `||||||| ...`
            while (i < lines.length) {
                const l = lines[i] ?? "";
                if (l.startsWith("======="))
                    break;
                const fl = i === lines.length - 1 ? l : `${l}\n`;
                base += fl;
                i += 1;
            }
        }
        // 跳过 `=======`
        if (i < lines.length && (lines[i] ?? "").startsWith("======="))
            i += 1;
        // 解析 theirs：直到 `>>>>>>>` 或 EOF。
        while (i < lines.length) {
            const l = lines[i] ?? "";
            if (l.startsWith(">>>>>>>"))
                break;
            const fl = i === lines.length - 1 ? l : `${l}\n`;
            theirs += fl;
            i += 1;
        }
        // 跳过 `>>>>>>> ...`
        if (i < lines.length && (lines[i] ?? "").startsWith(">>>>>>>"))
            i += 1;
        segments.push({ kind: "conflict", ours, base, theirs });
    }
    flushText();
    return segments;
}
//# sourceMappingURL=gitMergePreview.js.map