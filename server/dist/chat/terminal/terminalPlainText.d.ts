import { countLines, getTextMetrics } from "../textMetrics";
export { countLines, getTextMetrics };
/**
 * 以增量方式模拟终端输出，处理常见光标移动与擦除序列。
 *
 * 说明：
 * - 该逻辑与 Web 侧旧实现保持一致（用于保持展示/复制行为不变）；
 * - 仅覆盖常见的 `\r`、`\b` 与部分 CSI 序列，不追求完整 VT100 支持。
 */
export declare function appendTerminalDelta(existing: string, delta: string): string;
/**
 * 规范化终端文本，支持包含 ANSI 增量符号的场景。
 */
export declare function normalizeTerminalText(text: string): string;
