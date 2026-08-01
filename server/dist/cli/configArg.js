"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConfigArgFromArgv = parseConfigArgFromArgv;
exports.applyConfigArgToEnv = applyConfigArgToEnv;
/**
 * 判断当前参数是否为支持的 config 参数名。
 * Check whether the current arg is a supported config flag name.
 */
function isConfigFlagName(rawArg) {
    return rawArg === "--config" || rawArg === "---config";
}
/**
 * 从 argv 中解析 `--config` / `---config` 参数。
 * Parse `--config` / `---config` from argv.
 */
function parseConfigArgFromArgv(argv) {
    /**
     * 默认无配置值。
     * Default result means no config value.
     */
    let parsedConfigValue = null;
    for (let currentArgIndex = 0; currentArgIndex < argv.length; currentArgIndex += 1) {
        /**
         * 当前遍历到的参数值。
         * Current argument value.
         */
        const currentArgValue = String(argv[currentArgIndex] ?? "").trim();
        if (!currentArgValue)
            continue;
        // 形式 1：--config=/path/to/config.json 或 ---config=/path/to/config.json
        // Form 1: --config=/path/to/config.json or ---config=/path/to/config.json
        if (currentArgValue.startsWith("--config=") || currentArgValue.startsWith("---config=")) {
            const inlineConfigValue = currentArgValue.slice(currentArgValue.indexOf("=") + 1).trim();
            if (inlineConfigValue) {
                parsedConfigValue = inlineConfigValue;
                continue;
            }
            // 兼容 `--config= ./config.json` / `---config= ./config.json` 写法。
            // Support `--config= ./config.json` / `---config= ./config.json`.
            const nextArgValue = String(argv[currentArgIndex + 1] ?? "").trim();
            if (nextArgValue)
                parsedConfigValue = nextArgValue;
            continue;
        }
        // 形式 2：--config /path/to/config.json 或 ---config /path/to/config.json
        // Form 2: --config /path/to/config.json or ---config /path/to/config.json
        if (isConfigFlagName(currentArgValue)) {
            const nextArgValue = String(argv[currentArgIndex + 1] ?? "").trim();
            if (nextArgValue)
                parsedConfigValue = nextArgValue;
            continue;
        }
    }
    return { configValue: parsedConfigValue };
}
/**
 * 将 argv 中的 config 参数同步到环境变量 `CODEX_CONFIG`。
 * Sync parsed config arg into env var `CODEX_CONFIG`.
 */
function applyConfigArgToEnv(argv, env = process.env) {
    /**
     * 解析出的 config 值。
     * Parsed config value.
     */
    const parsedConfigArgResult = parseConfigArgFromArgv(argv);
    if (!parsedConfigArgResult.configValue)
        return;
    env.CODEX_CONFIG = parsedConfigArgResult.configValue;
}
//# sourceMappingURL=configArg.js.map