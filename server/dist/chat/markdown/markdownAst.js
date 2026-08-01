"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMarkdownAst = buildMarkdownAst;
/**
 * buildMarkdownAst：在插件版 CommonJS runtime 下停用服务端 Markdown AST 生成。
 *
 * 说明：
 * - 旧实现依赖 unified/remark 的 ESM 包，IDEA 插件内置 Node 以 CommonJS 方式加载时会在启动阶段直接抛错；
 * - 前端 `PlainTextBlock` / `MarkdownTextBlock` 已具备客户端 Markdown 兜底渲染能力；
 * - 因此这里统一返回 null，把 Markdown 渲染职责交回前端，优先保证插件运行稳定。
 */
function buildMarkdownAst(markdown) {
    /**
     * normalizedMarkdown：统一收敛空值输入，同时保留“空文本返回 null”的既有语义。
     */
    const normalizedMarkdown = String(markdown ?? "");
    if (!normalizedMarkdown.trim())
        return null;
    return null;
}
//# sourceMappingURL=markdownAst.js.map