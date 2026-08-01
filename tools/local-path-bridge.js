const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const workspace = path.join(process.env.USERPROFILE, "Downloads");
const targetDir = path.join(workspace, ".codex-web", "external-uploads");
const port = Number(process.env.CODEX_PATH_BRIDGE_PORT || 8790);
http.createServer(async (req,res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:8787"); res.setHeader("Access-Control-Allow-Headers", "content-type");
  if(req.method === "OPTIONS") return res.end();
  if(req.method !== "POST" || req.url !== "/copy") { res.statusCode=404; return res.end(); }
  try { let body=""; for await(const part of req) body+=part; const source=path.resolve(String(JSON.parse(body).path||"")); const stat=await fs.promises.stat(source); await fs.promises.mkdir(targetDir,{recursive:true}); const originalName=path.basename(source); const ext=stat.isFile()?path.extname(originalName):""; const filename=`att-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`; const localPath=path.join(targetDir,filename); if(stat.isFile()){ if(stat.size>100*1024*1024) throw Error("file too large"); await fs.promises.copyFile(source,localPath); } else if(stat.isDirectory()) await fs.promises.cp(source,localPath,{recursive:true,errorOnExist:true,filter:(entry)=>!/[\\/](node_modules|\.git)$/.test(entry)}); else throw Error("unsupported path"); res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({ok:true,localPath,originalName,mime:stat.isDirectory()?"inode/directory":"application/octet-stream"})); } catch(error) { res.statusCode=400; res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({ok:false,details:String(error.message||error)})); }
}).listen(port,"127.0.0.1");
