/**
 * 从原始 stderr chunk 中提取最后一个非空行，便于状态缓存与告警识别复用同一份解析逻辑。
 */
export declare function getLatestCodexStderrLine(raw: unknown): string;
/**
 * 判断当前 stderr 单行是否属于“已知可恢复、无需展示”的 codex 运行时告警。
 */
export declare function isIgnorableCodexRuntimeWarning(stderrLine: string): boolean;
