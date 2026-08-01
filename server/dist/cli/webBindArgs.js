"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWebBindArgsFromArgv = parseWebBindArgsFromArgv;
exports.applyWebBindArgsToEnv = applyWebBindArgsToEnv;
/**
 * 判断 token 是否看起来像一个 flag（用于避免误把下一个参数当作值）。
 * Check whether a token looks like a flag to avoid consuming it as a value.
 */
function isLikelyFlagToken(rawToken) {
    const normalizedToken = String(rawToken ?? "").trim();
    if (!normalizedToken)
        return false;
    return normalizedToken.startsWith("-");
}
/**
 * 判断当前参数是否为支持的 hostname 参数名。
 * Check whether the current arg is a supported hostname flag name.
 */
function isHostnameFlagName(rawArg) {
    return rawArg === "-hostname" || rawArg === "--hostname";
}
/**
 * 判断当前参数是否为支持的 port 参数名。
 * Check whether the current arg is a supported port flag name.
 */
function isPortFlagName(rawArg) {
    return rawArg === "--prot" || rawArg === "--port";
}
/**
 * 读取 `--flag value` 形式中紧随其后的 value（不存在/为空/像 flag 时返回 null）。
 * Read the next value for `--flag value` form; returns null when missing/empty/looks like a flag.
 */
function readNextArgValue(argv, currentArgIndex) {
    const nextArgValue = String(argv[currentArgIndex + 1] ?? "").trim();
    if (!nextArgValue)
        return null;
    if (isLikelyFlagToken(nextArgValue))
        return null;
    return nextArgValue;
}
/**
 * 将字符串端口解析为合法端口号。
 * Parse a raw port string into a valid port number.
 */
function parsePort(rawPort) {
    const normalizedPort = String(rawPort ?? "").trim();
    if (!normalizedPort)
        return null;
    const parsedPort = Number(normalizedPort);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0)
        return null;
    return Math.floor(parsedPort);
}
/**
 * 从 argv 中解析 `-hostname` / `--hostname` 与 `--prot` / `--port`。
 * Parse `-hostname` / `--hostname` and `--prot` / `--port` from argv.
 */
function parseWebBindArgsFromArgv(argv) {
    /**
     * 解析出的 hostname；默认 null。
     * Parsed hostname; null by default.
     */
    let parsedHostname = null;
    /**
     * 解析出的 port；默认 null。
     * Parsed port; null by default.
     */
    let parsedPort = null;
    for (let currentArgIndex = 0; currentArgIndex < argv.length; currentArgIndex += 1) {
        /**
         * 当前遍历到的参数值。
         * Current argument value.
         */
        const currentArgValue = String(argv[currentArgIndex] ?? "").trim();
        if (!currentArgValue)
            continue;
        // hostname inline：-hostname=0.0.0.0 / --hostname=0.0.0.0
        // hostname inline: -hostname=0.0.0.0 / --hostname=0.0.0.0
        if (currentArgValue.startsWith("-hostname=") || currentArgValue.startsWith("--hostname=")) {
            const inlineHostnameValue = currentArgValue.slice(currentArgValue.indexOf("=") + 1).trim();
            if (inlineHostnameValue) {
                parsedHostname = inlineHostnameValue;
                continue;
            }
            // 兼容 `--hostname= 0.0.0.0` / `-hostname= 0.0.0.0` 写法。
            // Support `--hostname= 0.0.0.0` / `-hostname= 0.0.0.0`.
            const nextHostnameValue = readNextArgValue(argv, currentArgIndex);
            if (nextHostnameValue)
                parsedHostname = nextHostnameValue;
            continue;
        }
        // port inline：--prot=8787 / --port=8787
        // port inline: --prot=8787 / --port=8787
        if (currentArgValue.startsWith("--prot=") || currentArgValue.startsWith("--port=")) {
            const inlinePortValue = currentArgValue.slice(currentArgValue.indexOf("=") + 1).trim();
            const parsedInlinePort = parsePort(inlinePortValue);
            if (parsedInlinePort !== null) {
                parsedPort = parsedInlinePort;
                continue;
            }
            // 兼容 `--prot= 8787` / `--port= 8787` 写法。
            // Support `--prot= 8787` / `--port= 8787`.
            const nextPortValue = readNextArgValue(argv, currentArgIndex);
            const parsedNextPort = parsePort(nextPortValue ?? "");
            if (parsedNextPort !== null)
                parsedPort = parsedNextPort;
            continue;
        }
        // hostname separated：-hostname 0.0.0.0 / --hostname 0.0.0.0
        // hostname separated: -hostname 0.0.0.0 / --hostname 0.0.0.0
        if (isHostnameFlagName(currentArgValue)) {
            const nextHostnameValue = readNextArgValue(argv, currentArgIndex);
            if (nextHostnameValue)
                parsedHostname = nextHostnameValue;
            continue;
        }
        // port separated：--prot 8787 / --port 8787
        // port separated: --prot 8787 / --port 8787
        if (isPortFlagName(currentArgValue)) {
            const nextPortValue = readNextArgValue(argv, currentArgIndex);
            const parsedNextPort = parsePort(nextPortValue ?? "");
            if (parsedNextPort !== null)
                parsedPort = parsedNextPort;
            continue;
        }
    }
    return { hostname: parsedHostname, port: parsedPort };
}
/**
 * 将 argv 中解析到的 web bind 参数同步到环境变量。
 * Sync parsed web bind args into environment variables.
 */
function applyWebBindArgsToEnv(argv, env = process.env) {
    /**
     * 解析出的 web bind 参数。
     * Parsed web bind args.
     */
    const parsedWebBindArgs = parseWebBindArgsFromArgv(argv);
    if (parsedWebBindArgs.hostname)
        env.CODEX_WEB_HOST = parsedWebBindArgs.hostname;
    if (typeof parsedWebBindArgs.port === "number")
        env.CODEX_WEB_PORT = String(parsedWebBindArgs.port);
}
//# sourceMappingURL=webBindArgs.js.map