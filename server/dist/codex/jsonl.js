"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonlDecoder = void 0;
class JsonlDecoder {
    buffer = "";
    push(chunk) {
        this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const out = [];
        while (true) {
            const newlineIndex = this.buffer.indexOf("\n");
            if (newlineIndex === -1)
                break;
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);
            if (!line.trim())
                continue;
            out.push(JSON.parse(line));
        }
        return out;
    }
}
exports.JsonlDecoder = JsonlDecoder;
//# sourceMappingURL=jsonl.js.map