/**
 * 将凭证表单中的 host 字段标准化为“主机名”。
 *
 * 背景：
 * - 前端新增“仓库 URL”解析按钮后，仍然可能有人把完整 URL 误粘贴到 host 字段。
 * - 服务端需要容错：若传入的是可解析的 URL，则仅存 hostname，避免后续按 origin 匹配失败。
 *
 * 约定：
 * - 返回值永远为小写 host（空则返回空字符串）。
 */
export declare function normalizeGitCredentialHost(input: string): string;
