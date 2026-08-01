const http = require("http"), fs = require("fs"), path = require("path"), url = require("url");
const root = path.resolve(process.env.CODEX_ARTIFACT_ROOT || path.join(process.env.USERPROFILE, "Downloads"));
const safe = (value = "") => { const target = path.resolve(root, value); return target === root || target.startsWith(root + path.sep) ? target : null; };
const ignored = new Set(["node_modules", ".git", ".codex", ".codex-web"]);
async function list(dir = root, prefix = "", out = []) {
  if (out.length >= 800) return out;
  let entries; try { entries = await fs.promises.readdir(dir, { withFileTypes:true }); } catch { return out; }
  for (const entry of entries.sort((a,b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name, "zh-CN") : a.isDirectory() ? 1 : -1))) {
    if (out.length >= 800 || ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name), relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await list(absolute, relative, out);
    else if (entry.isFile()) { const stat = await fs.promises.stat(absolute).catch(() => null); if (stat) out.push({ path:relative, name:entry.name, ext:path.extname(entry.name).slice(1).toUpperCase() || "FILE", size:stat.size, updated:stat.mtimeMs }); }
  }
  return out;
}
http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:8787");
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === "/files") { res.setHeader("Content-Type", "application/json; charset=utf-8"); return res.end(JSON.stringify({ ok:true, root, files:await list() })); }
  if (parsed.pathname === "/open") { const file = safe(parsed.query.path); if (!file) { res.statusCode=403; return res.end(); } try { const stat=await fs.promises.stat(file); if (!stat.isFile()) throw 0; res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`); return fs.createReadStream(file).pipe(res); } catch { res.statusCode=404; return res.end(); } }
  res.statusCode=404; res.end();
}).listen(Number(process.env.CODEX_ARTIFACT_PORT || 8788), "127.0.0.1");
