#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * 解析 npm 包根目录路径。
 * Resolve the package root path.
 */
function resolvePackageRoot() {
  // 当前文件在 `<pkg>/bin/ccw.js`，上一级为包根目录。
  // This file lives at `<pkg>/bin/ccw.js`, so parent is package root.
  return path.resolve(__dirname, "..");
}

/**
 * 解析服务端入口文件路径。
 * Resolve the server entry file path.
 */
function resolveServerEntry(packageRoot) {
  // 发布包内的 server 入口位置固定为 `server/dist/index.js`。
  // Server entry path is fixed as `server/dist/index.js` in the published package.
  return path.join(packageRoot, "server", "dist", "index.js");
}

/**
 * 打印错误并退出。
 * Print an error message and exit.
 */
function fatal(message) {
  // 统一从 stderr 输出，便于 CLI 调用方识别错误。
  // Always write to stderr for CLI-friendly output.
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * 主入口：透传参数并启动服务端入口脚本。
 * Main entry: forward args and run the server entry script.
 */
function main() {
  // npm 包根目录。
  // Package root directory.
  const packageRoot = resolvePackageRoot();
  // 服务端编译产物入口路径。
  // Server build output entry path.
  const serverEntry = resolveServerEntry(packageRoot);

  // 当发布包缺少构建产物时给出明确提示，避免报错信息不友好。
  // Provide a clear error when build output is missing.
  if (!fs.existsSync(serverEntry)) {
    fatal("ccw: 缺少 server/dist/index.js，请先执行 npm run build 后再运行。");
  }

  // 透传参数到 server 入口；参数解析由 server/src/index.ts 处理。
  // Forward args to server entry; arg parsing is handled by server/src/index.ts.
  const forwardedArgs = process.argv.slice(2);
  const nodeArgs = [serverEntry, ...forwardedArgs];

  // 使用当前 Node 可执行文件启动，保持与用户环境一致。
  // Use current Node executable for consistency with the user's environment.
  const child = childProcess.spawn(process.execPath, nodeArgs, {
    stdio: "inherit",
  });

  child.on("error", (err) => {
    fatal(`ccw: 启动失败: ${String(err)}`);
  });

  child.on("exit", (code, signal) => {
    // Windows 上 signal 常为空；这里尽量保持行为可预期。
    // On Windows, signal is often null; keep exit behavior predictable.
    if (typeof code === "number") {
      process.exit(code);
      return;
    }
    if (signal) {
      fatal(`ccw: 子进程退出 (signal=${signal})`);
      return;
    }
    process.exit(1);
  });
}

main();

