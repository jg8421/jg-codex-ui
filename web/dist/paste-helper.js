(() => {
  const pending = [];
  let outputDirectory = localStorage.getItem("codex-output-directory") || "";
  let pendingThreadId = "";
  const currentThreadId = () => document.querySelector(".mainTitle[title]")?.getAttribute("title") || "";
  let replayingSend = false;
  const isComposer = (el) => el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
  const toast = (message) => {
    let node = document.getElementById("codex-paste-toast");
    if (!node) {
      node = document.createElement("div"); node.id = "codex-paste-toast";
      Object.assign(node.style, { position: "fixed", bottom: "88px", left: "50%", transform: "translateX(-50%)", zIndex: "99999", padding: "10px 14px", borderRadius: "10px", background: "#1f2937", color: "#fff", font: "14px Microsoft YaHei UI, sans-serif", boxShadow: "0 6px 20px #0004" });
      document.body.appendChild(node);
    }
    node.textContent = message; node.style.display = "block"; clearTimeout(node._timer);
    node._timer = setTimeout(() => { node.style.display = "none"; }, 2600);
  };
  const activeInput = () => document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : document.querySelector("textarea");
  const fixFilenameEncoding = (name) => {
    const value = String(name || "");
    if (!/[\u0080-\u00ff]/.test(value) || [...value].some(char => char.charCodeAt(0) > 255)) return value;
    try { const repaired = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from([...value], char => char.charCodeAt(0))); return repaired || value; } catch { return value; }
  };
  const iconFor = (item) => item.mime?.startsWith("image/") ? "▣" : "▤";
  const typeFor = (item) => {
    const ext = String(item.name || "").split(".").pop();
    return ext && ext !== item.name ? ext.toUpperCase() : (item.mime?.startsWith("image/") ? "IMAGE" : "FILE");
  };
  const renderPending = () => {
    const input = activeInput();
    let bar = document.getElementById("codex-pending-attachments");
    if (!pending.length) { bar?.remove(); return; }
    if (!input) return;
    if (!bar) {
      bar = document.createElement("div"); bar.id = "codex-pending-attachments"; bar.className = "codex-pending-attachments";
      const inputGroup = input.closest(".composerInputGroup");
      const host = input.closest(".composerBox") || input.parentElement;
      host.insertBefore(bar, inputGroup || input);
    }
    bar.replaceChildren(...pending.map((item, index) => {
      const card = document.createElement("div"); card.className = "codex-pending-card";
      const icon = document.createElement("span"); icon.className = "codex-pending-icon"; icon.textContent = iconFor(item);
      const text = document.createElement("span"); text.className = "codex-pending-text";
      const name = document.createElement("b"); name.textContent = item.name || "附件";
      const type = document.createElement("small"); type.textContent = typeFor(item);
      text.append(name, type);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "codex-pending-remove"; remove.title = "移除附件"; remove.textContent = "×";
      remove.addEventListener("click", () => { pending.splice(index, 1); renderPending(); });
      card.append(icon, text, remove); return card;
    }));
  };
  const queue = (data, fallbackName, mime) => {
    pendingThreadId = currentThreadId();
    const name = fixFilenameEncoding(data.originalName || fallbackName || "附件");
    pending.push({ path: data.localPath, name, mime: data.mime || mime || "" });
    try { const threadId = document.querySelector(".mainTitle[title]")?.getAttribute("title") || "current"; const key = "codex-uploaded-artifacts"; const items = JSON.parse(localStorage.getItem(key) || "[]"); items.push({ threadId, name, apiUrl:data.apiUrl || "", at:Date.now() }); localStorage.setItem(key, JSON.stringify(items.slice(-100))); } catch { /* attachment still works without this convenience list */ }
    const input = activeInput(); if (input && !input.value) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(input, "\u200b"); input.dispatchEvent(new Event("input", { bubbles: true })); }
    renderPending();
  };
  const upload = async (file) => {
    const form = new FormData(); form.append("file", file, file.name || "clipboard-image.png");
    const res = await fetch("/api/uploads/attachment", { method: "POST", credentials: "same-origin", body: form }); const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.details || "上传失败"); queue(data, file.name || "clipboard-image.png", file.type);
  };
  const uploadLocalPath = async (path) => {
    const res = await fetch("http://127.0.0.1:8791/copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) }); const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.details || "无法读取该地址的文件"); queue(data, path.split(/[\\/]/).pop(), data.mime);
  };
  const attachForSend = () => {
    const input = activeInput(); if (!input || (!pending.length && !outputDirectory)) return false;
    const paths = [...pending.map(item => `[attachment] ${item.path}`), ...(outputDirectory ? [`[output_directory] ${outputDirectory}`] : [])].join("\n");
    const text = String(input.value || "").replace(/\u200b/g, "").trim(); const value = `${text}${text ? "\n\n" : ""}${paths}`;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    pending.splice(0); pendingThreadId = ""; renderPending(); return true;
  };
  const isSend = (button) => {
    if (!(button instanceof HTMLButtonElement)) return false;
    const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""} ${button.textContent || ""}`;
    return /发送|send/i.test(label);
  };
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (replayingSend || (!pending.length && !outputDirectory) || !isSend(button)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    attachForSend(); replayingSend = true;
    setTimeout(() => { button.click(); replayingSend = false; }, 80);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!isComposer(event.target) || !pending.length) return;
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!attachForSend()) return;
    replayingSend = true;
    setTimeout(() => {
      const send = [...document.querySelectorAll("button")].find(isSend);
      send?.click(); replayingSend = false;
    }, 80);
  }, true);
  document.addEventListener("paste", async (event) => {
    if (!isComposer(event.target)) return;
    const files = Array.from(event.clipboardData?.files || []);
    const plain = String(event.clipboardData?.getData("text/plain") || "").trim();
    const copiedPaths = plain.split(/\r?\n/).map(x => x.trim().replace(/^"|"$/g, "")).filter(x => /^[A-Za-z]:\\/.test(x));
    if (!files.length && !copiedPaths.length) return;
    event.preventDefault(); toast("正在添加附件…");
    try { if (files.length) for (const file of files) await upload(file); else for (const path of copiedPaths) await uploadLocalPath(path); toast("附件已添加，可直接发送"); }
    catch (error) { toast(`附件添加失败：${error.message || error}`); }
  }, true);
  window.codexSetOutputDirectory = () => { const value = window.prompt("Output directory", outputDirectory); if (value === null) return; outputDirectory = value.trim(); if (outputDirectory) localStorage.setItem("codex-output-directory", outputDirectory); else localStorage.removeItem("codex-output-directory"); toast(outputDirectory ? "Output directory saved" : "Output directory cleared"); };
  setInterval(() => { const active = currentThreadId(); if (pending.length && active !== pendingThreadId) { pending.splice(0); renderPending(); } }, 250);
})();
