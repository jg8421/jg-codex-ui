import type { ChatItem } from "./types";
/**
 * 为 ChatItem 追加“后端解析后的渲染字段”，让前端只负责渲染。
 */
export declare function enrichChatItemForUi(item: ChatItem): ChatItem;
