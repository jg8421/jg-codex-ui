(() => {
  localStorage.setItem("sidebarCollapsed", "false");
  const dayKey = new Date().toLocaleDateString("sv-SE");
  const storageKey = `deepseek-local-usage:${dayKey}`;
  let usage = (() => { try { return JSON.parse(localStorage.getItem(storageKey)) || { input: 0, output: 0, speed: 0, lastAt: Date.now() }; } catch { return { input: 0, output: 0, speed: 0, lastAt: Date.now() }; } })();
  const seen = new Set();
  const style = document.createElement("style");
  style.textContent = `
    .layout.layout-wide.sidebar-closed { --sidebar-width: clamp(330px, 25vw, 420px) !important; }
    .layout.layout-wide.sidebar-closed .sidebar { display:grid !important; }
    .sidebar { grid-template-columns:1fr !important; } .workspaceRail { display:none !important; }
    .mainHeaderActionsScrollable > :nth-child(n+3), .mainHeaderActionsFixed > :not(#codex-artifact-btn) { display:none !important; }
    body.codex-artifacts-open .layout { padding-right:calc(10px + min(390px, 34vw)) !important; }
    .messageContent, .chatMessage, .chatMessageContent, .markdown-body, .markdown-body p, .chatTurn { line-height:1.42 !important; }
    .markdown-body p { margin-top:.38em !important; margin-bottom:.38em !important; }
    .codex-pending-attachments { display:flex; gap:10px; overflow-x:auto; padding:10px 12px 2px; scrollbar-width:thin; }
    .codex-pending-card { display:flex; align-items:center; gap:10px; flex:0 0 250px; min-width:0; padding:9px 10px; border:1px solid #dce3ed; border-radius:16px; background:#fff; box-shadow:0 1px 4px #0000000a; color:#1f2937; font-family:"Microsoft YaHei UI",sans-serif; }
    .codex-pending-icon { display:grid; place-items:center; flex:0 0 36px; width:36px; height:36px; border-radius:10px; background:#edf4ff; color:#2463d4; font-size:22px; }
    .codex-pending-text { display:grid; min-width:0; flex:1; gap:2px; } .codex-pending-text b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:650; } .codex-pending-text small { color:#748092; font-size:11px; }
    .codex-pending-remove { display:grid; place-items:center; flex:0 0 25px; width:25px; height:25px; border:0; border-radius:50%; background:#20242b; color:#fff; font:22px/1 Arial,sans-serif; cursor:pointer; }
    .codex-message-files { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 8px; } .codex-message-file { display:inline-flex; align-items:center; gap:6px; max-width:300px; min-width:0; padding:5px 8px; border:1px solid #dce3ed; border-radius:999px; background:#fff; color:#1d2939; font:12px/1.2 "Microsoft YaHei UI",sans-serif; } .codex-message-file b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; } .codex-file-logo { display:grid; place-items:center; flex:0 0 auto; width:21px; height:21px; border-radius:5px; color:#fff; font:700 8px/1 Arial,sans-serif; } .codex-file-pdf { background:#e34b52; } .codex-file-doc { background:#3b78d8; } .codex-file-xls { background:#2f9d69; } .codex-file-ppt { background:#e68243; } .codex-file-exe { background:#5d6675; } .codex-file-img { background:#8b62cf; } .codex-file-file { background:#6f7e92; }
    .errorBanner, .error-banner, [class*="errorBanner"] { min-height:0 !important; max-height:48px !important; overflow:hidden !important; padding:6px 14px !important; margin:0 !important; font-size:12px !important; line-height:1.25 !important; border-radius:0 0 10px 10px !important; }
    .errorBanner *, .error-banner *, [class*="errorBanner"] * { font-size:inherit !important; line-height:inherit !important; }
    .workspaceRailRow { position:relative; } .workspaceRailRowMain { padding-right:34px !important; }
    .codex-project-rename { position:absolute; right:7px; top:50%; transform:translateY(-50%); width:24px; height:24px; border:0; border-radius:7px; background:transparent; color:#2563eb; opacity:.9; cursor:pointer; font:16px/1 Arial,sans-serif; }
    .codex-project-rename:hover { background:#eaf1ff; color:#174ea6; }
    .codex-project-name-input { width:calc(100% - 6px); min-width:0; padding:3px 5px; border:1px solid #7aa7ee; border-radius:6px; outline:0; font:inherit; color:inherit; background:#fff; }
    .mainTitle { cursor:text; } .codex-thread-title-input { width:min(720px, 62vw); min-width:220px; padding:5px 8px; border:1px solid #7aa7ee; border-radius:7px; outline:0; color:#172033; font:inherit; font-weight:650; background:#fff; }
    .codex-artifact-btn { display:grid; place-items:center; width:34px; height:34px; border:1px solid #d7e0eb; border-radius:10px; background:#fff; color:#235fc6; cursor:pointer; font-size:17px; }
    .codex-output-dir-btn { border:1px solid #d7e0eb; border-radius:10px; background:#fff; color:#235fc6; cursor:pointer; padding:5px 9px; font:12px/1.2 "Microsoft YaHei UI",sans-serif; white-space:nowrap; }
    .codex-artifact-panel { position:fixed; z-index:9997; top:54px; right:0; bottom:0; width:min(390px, 34vw); min-width:320px; display:none; flex-direction:column; background:#fff; border-left:1px solid #dbe3ed; box-shadow:-10px 0 32px #15233a18; font-family:"Microsoft YaHei UI",sans-serif; }
    .codex-artifact-panel.open { display:flex; } .codex-artifact-head { display:flex; align-items:center; justify-content:space-between; padding:18px 16px 12px; border-bottom:1px solid #e6ebf1; font-weight:700; font-size:16px; } .codex-artifact-head button { border:0; background:transparent; cursor:pointer; font-size:20px; }
    .codex-artifact-list { overflow:auto; padding:8px; } .codex-artifact-file { display:flex; gap:10px; width:100%; padding:10px; border:0; border-radius:9px; background:transparent; color:#1f2937; text-align:left; cursor:pointer; } .codex-artifact-file:hover { background:#f0f5ff; } .codex-artifact-icon { color:#3576d3; font-weight:700; } .codex-artifact-file span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .codex-artifact-empty { padding:24px 12px; color:#758195; font-size:13px; }
    #deepseek-usage { position:static !important; z-index:auto; display:flex; align-items:center; gap:8px; width:max-content; max-width:100%; margin:4px 0 0; padding:5px 8px; border:1px solid var(--border, #d8dee7); border-radius:10px; background:color-mix(in srgb, var(--panel, #fff) 96%, transparent); box-shadow:none; color:var(--text, #142035); font:11px/1.25 Microsoft YaHei UI, sans-serif; white-space:nowrap; }
    #deepseek-usage b { font-weight:700; color:#2563eb; } #deepseek-usage .muted { color:#6b7280; }
  `;
  document.head.appendChild(style);
  const panel = document.createElement("div");
  panel.id = "deepseek-usage";
  panel.innerHTML = `<b>DeepSeek</b><span class="muted">今日计算中…</span>`;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(panel));
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const findUsage = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const input = num(obj.input_tokens ?? obj.inputTokens ?? obj.prompt_tokens ?? obj.promptTokens);
    const output = num(obj.output_tokens ?? obj.outputTokens ?? obj.completion_tokens ?? obj.completionTokens);
    if (input || output) return { input, output };
    for (const key of ["last", "usage", "tokenUsage", "token_usage", "result", "response", "params", "data"]) { const result = findUsage(obj[key]); if (result) return result; }
    return null;
  };
  const render = (balance) => {
    const inputCost = usage.input / 1e6;       // DeepSeek V4 Flash cache-miss: ¥1 / 1M
    const outputCost = usage.output * 2 / 1e6; // DeepSeek V4 Flash output: ¥2 / 1M
    const total = usage.input + usage.output;
    panel.innerHTML = `<b>DeepSeek</b><span>今日 ${Math.round(total).toLocaleString()} tok · ¥${(inputCost + outputCost).toFixed(3)}</span><span class="muted">${usage.speed.toFixed(0)} tok/s${balance != null ? ` · 余额 ¥${balance.toFixed(2)}` : ""}</span>`;
  };
  const addUsage = (value) => {
    if (!value) return;
    const stamp = JSON.stringify(value);
    if (seen.has(stamp)) return;
    seen.add(stamp); if (seen.size > 100) seen.clear();
    const now = Date.now(), delta = value.input + value.output;
    if (!delta) return;
    usage.speed = delta / Math.max(1, (now - usage.lastAt) / 1000);
    usage.input += value.input; usage.output += value.output; usage.lastAt = now;
    localStorage.setItem(storageKey, JSON.stringify(usage)); render();
  };
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = function (...args) {
    const socket = new NativeWebSocket(...args);
    socket.addEventListener("message", (event) => {
      try {
        const raw = String(event.data || "");
        const payload = raw.startsWith("42") ? JSON.parse(raw.slice(2)) : JSON.parse(raw);
        addUsage(findUsage(payload));
      } catch { /* non-JSON frames are irrelevant */ }
    });
    return socket;
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  const refresh = async () => { try { const data = await fetch("/api/deepseek/stats", { credentials:"same-origin" }).then(r => r.json()); render(Number(data?.balance?.total)); } catch { render(); } };
  setInterval(refresh, 60000); refresh();
  const projectNamesKey = "codex-project-display-names";
  const projectNames = (() => { try { return JSON.parse(localStorage.getItem(projectNamesKey)) || {}; } catch { return {}; } })();
  const shortName = (path) => String(path || "").replace(/[\\/]+$/, "").split(/[\\/]/).pop() || String(path || "项目");
  const saveProjectNames = () => localStorage.setItem(projectNamesKey, JSON.stringify(projectNames));
  const applyProjectNames = () => document.querySelectorAll(".workspaceRailRowTitle").forEach((title) => {
    const raw = title.dataset.codexProjectPath || title.textContent.trim();
    if (!raw) return; title.dataset.codexProjectPath = raw;
    const displayName = projectNames[raw] || shortName(raw); if (title.textContent !== displayName) title.textContent = displayName;
    const row = title.closest(".workspaceRailRow");
    if (row && !row.querySelector(".codex-project-rename")) {
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "codex-project-rename"; edit.title = "重命名项目"; edit.setAttribute("aria-label", "重命名项目"); edit.textContent = "✎"; row.appendChild(edit);
    }
  });
  const editProjectName = (button) => {
    const row = button?.closest(".workspaceRailRow"), title = row?.querySelector(".workspaceRailRowTitle"); if (!title) return;
    const raw = title.dataset.codexProjectPath, input = document.createElement("input"); input.className = "codex-project-name-input"; input.value = projectNames[raw] || shortName(raw); input.maxLength = 60;
    const finish = (save) => { if (save && input.value.trim()) { projectNames[raw] = input.value.trim(); saveProjectNames(); } input.replaceWith(title); applyProjectNames(); };
    input.addEventListener("keydown", (event) => { event.stopPropagation(); if (event.key === "Enter") finish(true); if (event.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true), { once: true }); title.replaceWith(input); input.focus(); input.select();
  };
  document.addEventListener("click", (event) => { const button = event.target instanceof Element ? event.target.closest(".codex-project-rename") : null; if (!button) return; event.preventDefault(); event.stopImmediatePropagation(); editProjectName(button); }, true);
  document.addEventListener("dblclick", (event) => { const title = event.target instanceof Element ? event.target.closest(".workspaceRailRowTitle") : null; if (!title) return; event.preventDefault(); event.stopImmediatePropagation(); editProjectName(title.closest(".workspaceRailRow")?.querySelector(".codex-project-rename")); }, true);
  const threadNamesKey = "codex-thread-display-names";
  const threadNames = (() => { try { return JSON.parse(localStorage.getItem(threadNamesKey)) || {}; } catch { return {}; } })();
  const threadRawNamesKey = "codex-thread-original-names";
  const threadRawNames = (() => { try { return JSON.parse(localStorage.getItem(threadRawNamesKey)) || {}; } catch { return {}; } })();
  const persistThreadName = async (id, name) => { try { const current = await fetch("/api/user-settings", { credentials:"same-origin" }).then(r => r.json()); const settings = current?.settings; if (!current?.ok || !settings) return; settings.threadNameOverrides = { ...(settings.threadNameOverrides || {}), [id]: name }; await fetch("/api/user-settings", { method:"PUT", credentials:"same-origin", headers:{"content-type":"application/json"}, body:JSON.stringify({ settings }) }); } catch { /* local copy remains available */ } };
  const applyThreadName = () => { const title = document.querySelector(".mainTitle[title]"); const id = title?.getAttribute("title"), name = id ? threadNames[id] : null; if (title && id && name && !title.querySelector("input")) { if (title.textContent !== name) title.textContent = name; } const rawToName = Object.fromEntries(Object.entries(threadRawNames).filter(([threadId, raw]) => raw && threadNames[threadId]).map(([threadId, raw]) => [raw, threadNames[threadId]])); document.querySelectorAll(".threadPreview").forEach((preview) => { const raw = preview.dataset.codexOriginalName || preview.textContent.trim(); if (!raw) return; preview.dataset.codexOriginalName = raw; const saved = rawToName[raw]; if (saved && preview.textContent !== saved) preview.textContent = saved; }); const preview = document.querySelector(".thread.active .threadPreview"); if (preview && name && preview.textContent !== name) preview.textContent = name; };
  const editThreadName = (title) => {
    const id = title?.getAttribute("title"); if (!id || title.querySelector("input")) return;
    const originalName = title.dataset.codexOriginalName || title.textContent.trim(); const input = document.createElement("input"); input.className = "codex-thread-title-input"; input.value = threadNames[id] || originalName; input.maxLength = 100;
    const finish = (save) => { if (save && input.value.trim()) { threadNames[id] = input.value.trim(); threadRawNames[id] = originalName; localStorage.setItem(threadNamesKey, JSON.stringify(threadNames)); localStorage.setItem(threadRawNamesKey, JSON.stringify(threadRawNames)); persistThreadName(id, threadNames[id]); } input.replaceWith(title); applyThreadName(); };
    input.addEventListener("keydown", (event) => { event.stopPropagation(); if (event.key === "Enter") finish(true); if (event.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true), { once: true }); title.replaceWith(input); input.focus(); input.select();
  };
  document.addEventListener("dblclick", (event) => { const title = event.target instanceof Element ? event.target.closest(".mainTitle") : null; if (!title) return; event.preventDefault(); event.stopImmediatePropagation(); editThreadName(title); }, true);
  new MutationObserver(() => applyProjectNames()).observe(document.documentElement, { childList:true, subtree:true });
  new MutationObserver(() => applyThreadName()).observe(document.documentElement, { childList:true, subtree:true, characterData:true }); setInterval(applyThreadName, 350);
  const openProjectList = () => { const toggle = document.querySelector(".workspaceRailEditToggle"); if (toggle && !document.querySelector(".workspaceRailExpandedList")) toggle.click(); applyProjectNames(); applyThreadName(); };
  let openedSidebarAtStart = false;
  const openSidebarAtStart = () => { if (openedSidebarAtStart) return; const toggle = document.querySelector('.sidebarToggle[aria-expanded="false"]'); if (toggle) { openedSidebarAtStart = true; toggle.click(); } };
  document.addEventListener("DOMContentLoaded", () => { setTimeout(openSidebarAtStart, 120); setTimeout(openProjectList, 300); }); setTimeout(openSidebarAtStart, 350); setTimeout(openProjectList, 600); applyProjectNames();
  const dismissBenignPowerShellWarning = () => document.querySelectorAll(".errorBanner").forEach((banner) => { if (/Shell snapshot not supported yet for PowerShell/i.test(banner.textContent || "")) banner.querySelector("button")?.click(); });
  new MutationObserver(dismissBenignPowerShellWarning).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  dismissBenignPowerShellWarning();
  const artifactUrl = "http://127.0.0.1:8789";
  const currentArtifactThread = () => document.querySelector(".mainTitle[title]")?.getAttribute("title") || "current";
  const artifactSince = () => { const key = `codex-artifact-since:${currentArtifactThread()}`; const saved = Number(localStorage.getItem(key)); if (saved) return saved; const now = Date.now(); localStorage.setItem(key, String(now)); return now; };
  const dockUsagePanel = () => { const usage = document.getElementById("deepseek-usage"), target = document.querySelector(".sidebarHeaderBottom"); if (usage && target && usage.parentElement !== target) target.appendChild(usage); };
  const setupOutputDirectory = () => { const host=document.querySelector(".composerToolbarRight"); if (!host || document.getElementById("codex-output-dir-btn")) return; const button=document.createElement("button"); button.id="codex-output-dir-btn"; button.className="codex-output-dir-btn"; button.type="button"; button.textContent="输出目录"; button.title="设置 AI 文件生成目录"; button.onclick=()=>window.codexSetOutputDirectory?.(); host.prepend(button); };
  const setupArtifacts = () => {
    let panel = document.getElementById("codex-artifact-panel");
    if (!panel) { panel = document.createElement("aside"); panel.id = "codex-artifact-panel"; panel.className = "codex-artifact-panel"; panel.innerHTML = '<div class="codex-artifact-head"><span>本次对话产物</span><button title="关闭">×</button></div><div class="codex-artifact-list"><div class="codex-artifact-empty">正在读取本次对话产物…</div></div>'; panel.querySelector("button").onclick=()=>{ panel.classList.remove("open"); document.body.classList.remove("codex-artifacts-open"); }; document.body.appendChild(panel); }
    let button = document.getElementById("codex-artifact-btn"), host = document.querySelector(".mainHeaderActionsFixed");
    if (host && !button) { button=document.createElement("button"); button.id="codex-artifact-btn"; button.className="codex-artifact-btn"; button.title="本次对话产物"; button.textContent="▤"; host.prepend(button); button.onclick=async()=>{ panel.classList.toggle("open"); document.body.classList.toggle("codex-artifacts-open", panel.classList.contains("open")); if (!panel.classList.contains("open")) return; const list=panel.querySelector(".codex-artifact-list"); list.innerHTML='<div class="codex-artifact-empty">正在读取本次对话产物…</div>'; try { const text=[...document.querySelectorAll(".messageContent, .chatMessage, .markdown-body")].map(node=>node.textContent||"").join("\n"); const names=new Set(); const extensions="md|pdf|docx|xlsx|xls|csv|pptx|ppt|png|jpg|jpeg|webp|txt"; const pathPattern=new RegExp("[A-Za-z]:\\\\[^\\n\\r\\\"'`<>]+?\\.(?:"+extensions+")","gi"); for (const match of text.matchAll(pathPattern)) names.add(match[0].split(/[\\\\/]/).pop()); const namedPattern=new RegExp("(?:创建|新建|生成|保存|上传)[^\\n\\r]{0,80}?([\\w\\u4e00-\\u9fff（）()【】_ .-]+\\.(?:"+extensions+"))","gi"); for (const match of text.matchAll(namedPattern)) names.add(match[1].trim()); const data=await fetch(artifactUrl+"/files").then(r=>r.json()); const files=data.files.filter(file=>names.has(file.name)); list.replaceChildren(...files.map(file=>{ const item=document.createElement("button"); item.className="codex-artifact-file"; const icon=document.createElement("span"); icon.className="codex-artifact-icon"; icon.textContent=file.ext; const name=document.createElement("span"); name.textContent=file.name; item.append(icon,name); item.onclick=()=>window.open(artifactUrl+"/open?path="+encodeURIComponent(file.path),"_blank"); return item; })); if (!files.length) list.innerHTML='<div class="codex-artifact-empty">本次对话暂未识别到生成或上传的文件。</div>'; } catch { list.innerHTML='<div class="codex-artifact-empty">产物服务未启动。</div>'; } }; button.click(); }
  };
  new MutationObserver(() => { setupArtifacts(); dockUsagePanel(); setupOutputDirectory(); }).observe(document.documentElement, { childList:true, subtree:true }); setTimeout(() => { setupArtifacts(); dockUsagePanel(); setupOutputDirectory(); }, 500);
  document.addEventListener("click", async (event) => { const trigger = event.target instanceof Element ? event.target.closest("#codex-artifact-btn") : null; if (!trigger) return; event.preventDefault(); event.stopImmediatePropagation(); const panel=document.getElementById("codex-artifact-panel"); panel.classList.toggle("open"); document.body.classList.toggle("codex-artifacts-open",panel.classList.contains("open")); if(!panel.classList.contains("open"))return; const list=panel.querySelector(".codex-artifact-list"); const threadId=currentArtifactThread(), since=artifactSince(); list.textContent="正在更新本次对话产物…"; try { const all=await fetch(artifactUrl+"/files").then(r=>r.json()); const uploads=JSON.parse(localStorage.getItem("codex-uploaded-artifacts")||"[]").filter(x=>x.threadId===threadId); const files=[...all.files.filter(x=>x.updated>=since),...uploads.map(x=>({name:x.name,ext:(x.name.split(".").pop()||"FILE").toUpperCase(),apiUrl:x.apiUrl}))]; list.replaceChildren(...files.map(file=>{const row=document.createElement("button");row.className="codex-artifact-file";row.textContent=`${file.ext}  ${file.name}`;row.onclick=()=>window.open(file.apiUrl||artifactUrl+"/open?path="+encodeURIComponent(file.path),"_blank");return row})); if(!files.length)list.textContent="本次对话暂未生成或上传文件。"; } catch { list.textContent="产物服务未启动。"; } },true);
  let observedArtifactThread = ""; setInterval(() => { const id=currentArtifactThread(); if (!id || id === observedArtifactThread) return; observedArtifactThread=id; const panel=document.getElementById("codex-artifact-panel"), button=document.getElementById("codex-artifact-btn"); if (panel?.classList.contains("open") && button) { panel.classList.remove("open"); button.click(); } }, 350);
  document.addEventListener("focusin", (event) => { if (!(event.target instanceof HTMLTextAreaElement)) return; setTimeout(() => document.querySelector('.sidebarToggle[aria-expanded="false"]')?.click(), 0); }, true);
  const messageFileType = (name) => { const ext=(name.split(".").pop()||"").toLowerCase(); if(ext==="pdf")return["PDF","pdf"]; if(["doc","docx"].includes(ext))return["DOC","doc"]; if(["xls","xlsx","csv"].includes(ext))return["XLS","xls"]; if(["ppt","pptx"].includes(ext))return["PPT","ppt"]; if(ext==="exe")return["EXE","exe"]; if(["png","jpg","jpeg","webp","gif"].includes(ext))return["IMG","img"]; return[ext.toUpperCase().slice(0,4)||"FILE","file"]; };
  const renderMessageAttachments = () => document.querySelectorAll(".messageContent, .chatMessageContent, .markdown-body").forEach((message) => { if (message.dataset.codexFilesDone) return; const paths=[...message.textContent.matchAll(/\[attachment\]\s+([^\r\n]+)/g)].map(match=>match[1].trim()); if(!paths.length)return; message.dataset.codexFilesDone="1"; const bar=document.createElement("div"); bar.className="codex-message-files"; for(const fullPath of paths){const name=fullPath.split(/[\\/]/).pop()||"附件";const [label,kind]=messageFileType(name);const chip=document.createElement("span");chip.className="codex-message-file";chip.innerHTML=`<i class="codex-file-logo codex-file-${kind}">${label}</i><b></b>`;chip.querySelector("b").textContent=name;bar.appendChild(chip)} message.prepend(bar); const walker=document.createTreeWalker(message,NodeFilter.SHOW_TEXT); const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode); for(const node of nodes)if(node.parentElement!==bar)node.nodeValue=node.nodeValue.replace(/\[attachment\]\s+[^\r\n]+\s*/g,""); });
  new MutationObserver(renderMessageAttachments).observe(document.documentElement,{childList:true,subtree:true,characterData:true}); setTimeout(renderMessageAttachments,600);
})();
