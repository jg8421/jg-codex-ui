import type { SkillCallMarker } from "./types";
/**
 * 从 `commandExecution` item 中提取 skill 调用标记。
 *
 * 支持来源：
 * - `item.commandActions[*].path`
 * - `item.commandActions[*].command`
 * - `item.command`
 */
export declare function extractSkillCallMarkerFromCommandExecutionItem(item: unknown): SkillCallMarker | null;
