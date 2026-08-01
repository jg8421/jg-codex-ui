/**
 * WS/HTTP 层下发给 Web UI 的聊天消息角色值。
 */
export type ChatRole = "user" | "assistant" | "system" | "reasoning";
/**
 * Web UI 渲染类型：用于切换 terminal/diff/approval 等卡片样式。
 */
export type ChatRender = "text" | "terminal" | "diff" | "approval";
/**
 * 文本指标：用于前端折叠阈值与高度估算。
 */
export type TextMetrics = {
    lines: number;
    chars: number;
};
/**
 * 后端解析后的 Markdown AST（HAST 精简版，可 JSON 序列化）。
 *
 * 说明：
 * - 前端不再解析 Markdown 字符串；
 * - 前端仅负责把 AST 渲染为 React 节点。
 */
export type UiMarkdownAst = {
    type: "root" | "element" | "text";
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: UiMarkdownAst[];
    value?: string;
};
/**
 * CLI 风格 system 工具调用摘要里的“阶段”节点。
 */
export type SystemToolCallStage = {
    title: string;
    steps: string[];
};
/**
 * 解析后的 system 工具调用摘要结构。
 */
export type SystemToolCallSummary = {
    stages: SystemToolCallStage[];
    statusLines: string[];
};
/**
 * skill 调用标记：用于在 UI 层显示“调用了哪个 skill”。
 */
export type SkillCallMarker = {
    name: string;
    /**
     * skill 文件路径（若可获取），用于调试与回放时定位来源。
     */
    path?: string;
};
/**
 * 单条文件变更记录（diff 渲染的最小单元）。
 */
export type FileChange = {
    path: string;
    kind: string;
    diff: string;
    /**
     * addedLines：该文件在 unified diff 中新增行数（不包含 `+++` 头行）。
     */
    addedLines?: number;
    /**
     * deletedLines：该文件在 unified diff 中删除行数（不包含 `---` 头行）。
     */
    deletedLines?: number;
};
/**
 * 文件变更渲染数据（包含变更列表与可选工具输出）。
 */
export type DiffData = {
    title: string;
    changes: FileChange[];
    output?: string;
};
/**
 * 消息投递状态：用于本地乐观消息展示。
 */
export type MessageDeliveryStatus = "pending" | "sent" | "failed";
/**
 * Web UI 的单条聊天消息结构（用于渲染与历史合并）。
 */
export type ChatItem = {
    id: string;
    ts: number;
    role: ChatRole;
    text: string;
    /**
     * plainText：用于复制/折叠预览的“纯文本”（terminal 会做转义与擦除序列归一化）。
     */
    plainText?: string;
    /**
     * metrics：文本指标；优先由后端/增量合并逻辑维护，避免前端重复扫描大字符串。
     */
    metrics?: TextMetrics;
    clientMessageId?: string;
    deliveryStatus?: MessageDeliveryStatus;
    deliveryError?: string;
    streaming?: boolean;
    render?: ChatRender;
    diff?: DiffData;
    /**
     * markdownAst：后端解析后的 Markdown AST（仅对 text 渲染场景生效）。
     */
    markdownAst?: UiMarkdownAst | null;
    /**
     * systemToolCallSummary：后端解析后的 system 工具调用摘要（仅对 system/text 生效）。
     */
    systemToolCallSummary?: SystemToolCallSummary | null;
    /**
     * skillCallMarker：命中 skill 调用时的结构化标记。
     */
    skillCallMarker?: SkillCallMarker | null;
};
/**
 * ChatItem 的补丁结构：仅覆盖需要变更的字段。
 */
export type ChatItemPatch = {
    text?: string;
    plainText?: string;
    metrics?: TextMetrics;
    render?: ChatRender;
    diff?: DiffData;
    markdownAst?: UiMarkdownAst | null;
    systemToolCallSummary?: SystemToolCallSummary | null;
    skillCallMarker?: SkillCallMarker | null;
};
/**
 * 后端投影后的增量操作；前端只需要按 op 合并并渲染即可。
 */
export type ChatOp = {
    op: "upsert";
    item: ChatItem;
    preserveTs?: boolean;
} | {
    op: "text_delta";
    id: string;
    ts: number;
    role: ChatRole;
    delta: string;
    render?: ChatRender;
} | {
    op: "diff_output_delta";
    id: string;
    ts: number;
    delta: string;
} | {
    op: "finalize";
    id: string;
    ts: number;
    patch?: ChatItemPatch;
} | {
    op: "mark_all_streaming_done";
    ts: number;
} | {
    op: "mark_streaming_done_by_prefix";
    ts: number;
    prefix: string;
};
