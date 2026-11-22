import { auth, db } from "./firebase.js";
import { ADMIN_UID, escapeHtml, formatDate, plainTextFromHtml, slugify } from "./shared.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const postForm = document.querySelector("#post-form");
const postMessage = document.querySelector("#post-message");
const postList = document.querySelector("#admin-post-list");
const contentEditor = document.querySelector("#post-content");
let postsCache = [];

function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch (_) {}
  return "";
}

function message(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}
function resetEditor() {
  editorRange = null;
  postForm.reset();
  document.querySelector("#post-id").value = "";
  contentEditor.innerHTML = "";
  contentEditor.style.backgroundColor = document.querySelector("#editor-bg-color").value;
  document.querySelector("#editor-heading").textContent = "Write an article";
  message(postMessage, "");
}
function requireAdmin(user) {
  if (!user || user.uid !== ADMIN_UID) {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    message(loginMessage, "This account does not have admin access. Sign in with the admin account configured for this website.", true);
    return false;
  }
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  message(loginMessage, "");
  loadPosts();
  return true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message(loginMessage, "Signing in…");
  try {
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      message(loginMessage, "Signed in, but this account is not the configured admin account.", true);
      return;
    }
    requireAdmin(result.user);
  } catch (error) {
    message(loginMessage, error.message || "Sign-in failed.", true);
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  await signOut(auth);
  resetEditor();
});
document.querySelector("#reset-editor").addEventListener("click", resetEditor);

async function loadPosts() {
  postList.innerHTML = '<p class="muted">Loading articles…</p>';
  try {
    const snapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    postsCache = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    document.querySelector("#post-count").textContent = postsCache.length;
    renderAdminPosts();
  } catch (error) {
    postList.innerHTML = '<p class="muted">Could not load posts. Check Firestore rules and browser console.</p>';
    console.error(error);
  }
}
function renderAdminPosts() {
  postList.innerHTML = "";
  if (!postsCache.length) {
    postList.innerHTML = '<p class="muted">No articles yet. Write your first one using the editor.</p>';
    return;
  }
  postsCache.forEach((post) => {
    const item = document.createElement("div");
    item.className = "admin-post-item";
    item.innerHTML = `<h3>${escapeHtml(post.title || "Untitled")}</h3>
      <div class="post-meta"><span>${escapeHtml(post.category || "Other")}</span><span class="${post.status === "published" ? "status-published" : "status-draft"}">${post.status === "published" ? "Published" : "Draft"}</span></div>
      <div class="admin-post-actions">
        <button class="small-button" type="button" data-action="edit" data-id="${escapeHtml(post.id)}">Edit</button>
        <button class="small-button" type="button" data-action="toggle" data-id="${escapeHtml(post.id)}">${post.status === "published" ? "Unpublish" : "Publish"}</button>
        <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(post.id)}">Delete</button>
      </div>`;
    postList.appendChild(item);
  });
}
postList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const post = postsCache.find((item) => item.id === button.dataset.id);
  if (!post) return;
  if (button.dataset.action === "edit") {
    document.querySelector("#post-id").value = post.id;
    document.querySelector("#post-title").value = post.title || "";
    const slugInput = document.querySelector("#post-slug");
    slugInput.value = post.slug || slugify(post.title || "");
    delete slugInput.dataset.manual;
    document.querySelector("#post-category").value = post.category || "Other";
    document.querySelector("#post-status").value = post.status || "draft";
    document.querySelector("#post-image").value = post.imageUrl || "";
    document.querySelector("#post-excerpt").value = post.excerpt || "";
    contentEditor.innerHTML = post.contentHtml || "";
    // Rebuild graph canvases when reopening saved drafts/articles in the editor.
    // Canvas pixels are not stored in HTML, but the chart's data-* attributes are.
    renderSavedGraphsInEditor(contentEditor);
    const editorBg = post.contentBackground || "#ffffff";
    document.querySelector("#editor-bg-color").value = editorBg;
    contentEditor.style.backgroundColor = editorBg;
    document.querySelector("#editor-heading").textContent = "Edit article";
    message(postMessage, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (button.dataset.action === "toggle") {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      await updateDoc(doc(db, "posts", post.id), { status: nextStatus, updatedAt: serverTimestamp() });
      await loadPosts();
    } catch (error) {
      message(postMessage, error.message, true);
    }
  } else if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${post.title}" permanently?`)) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      await loadPosts();
      if (document.querySelector("#post-id").value === post.id) resetEditor();
    } catch (error) {
      message(postMessage, error.message, true);
    }
  }
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user || user.uid !== ADMIN_UID) {
    message(postMessage, "Admin access is required.", true);
    return;
  }
  const title = document.querySelector("#post-title").value.trim();
  const category = document.querySelector("#post-category").value;
  const status = document.querySelector("#post-status").value;
  const imageUrl = document.querySelector("#post-image").value.trim();
  const excerpt = document.querySelector("#post-excerpt").value.trim();
  const contentHtml = contentEditor.innerHTML.trim();
  const contentBackground = document.querySelector("#editor-bg-color").value;
  const contentText = plainTextFromHtml(contentHtml);
  if (!title || !contentText) {
    message(postMessage, "Please add a title and article content.", true);
    return;
  }
  const postId = document.querySelector("#post-id").value;
  const rawSlug = document.querySelector("#post-slug").value.trim();
  if (/^https?:\/\//i.test(rawSlug)) {
    message(postMessage, "Slug must be a short URL name, not an image URL. Put the image URL in Cover Image.", true);
    return;
  }
  const cleanSlug = slugify(rawSlug || title);
  document.querySelector("#post-slug").value = cleanSlug;
  // Firestore documents are limited to 1 MiB. Keep a margin for metadata.
  if (new Blob([contentHtml]).size > 850000) {
    message(postMessage, "Article content is too large to save. Remove or resize embedded images/graphs.", true);
    return;
  }
  const data = {
    title, slug: cleanSlug, category, status, imageUrl, excerpt, contentHtml, contentBackground,
    updatedAt: serverTimestamp()
  };
  message(postMessage, "Saving article…");
  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), data);
      message(postMessage, "Article updated.");
    } else {
      await addDoc(collection(db, "posts"), { ...data, createdAt: serverTimestamp(), authorUid: user.uid });
      message(postMessage, "Article saved.");
    }
    resetEditor();
    message(postMessage, "Article saved successfully.");
    await loadPosts();
  } catch (error) {
    message(postMessage, error.message || "Could not save article.", true);
    console.error(error);
  }
});

// The redesigned editor has dedicated Draft and Publish actions.
document.querySelector("#status-sidebar").addEventListener("change", (e) => {
  document.querySelector("#post-status").value = e.target.value;
  document.querySelector("#publish-button").textContent = e.target.value === "published" ? "Publish" : "Save Draft";
});
document.querySelector("#publish-button").addEventListener("click", () => {
  document.querySelector("#post-status").value = "published";
  document.querySelector("#status-sidebar").value = "published";
});
document.querySelector("#save-draft-button").addEventListener("click", () => {
  document.querySelector("#post-status").value = "draft";
  document.querySelector("#status-sidebar").value = "draft";
});
document.querySelector("#publish-bottom").addEventListener("click", () => {
  document.querySelector("#post-status").value = "published";
  document.querySelector("#status-sidebar").value = "published";
});
document.querySelector("#editor-cancel").addEventListener("click", resetEditor);
document.querySelector("#post-title").addEventListener("input", () => {
  const slugInput = document.querySelector("#post-slug");
  if (!slugInput.dataset.manual) slugInput.value = slugify(document.querySelector("#post-title").value);
});
document.querySelector("#post-slug").addEventListener("input", (e) => { e.target.dataset.manual = "true"; });
document.querySelector("#post-image").addEventListener("input", () => {
  const box = document.querySelector("#cover-preview");
  const url = document.querySelector("#post-image").value.trim();
  box.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Cover preview">` : '<span>▧</span><small>Cover image preview</small>';
});
document.querySelector("#text-style").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#text-style").addEventListener("change", (e) => {
  restoreEditorRange();
  document.execCommand("formatBlock", false, e.target.value);
});
const quoteButton = document.querySelector("#insert-quote");
quoteButton.addEventListener("mousedown", rememberEditorRange);
quoteButton.addEventListener("click", () => {
  restoreEditorRange();
  const selection = window.getSelection();
  const selectedText = selection && selection.toString();
  if (selectedText) {
    document.execCommand("formatBlock", false, "blockquote");
  } else {
    const quote = document.createElement("blockquote");
    quote.textContent = "Quote text…";
    insertEditorNode(quote);
    const range = document.createRange();
    range.selectNodeContents(quote);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    editorRange = range.cloneRange();
  }
});
const editorBgColor = document.querySelector("#editor-bg-color");
const codeBgColor = document.querySelector("#code-bg-color");
const codeTextColor = document.querySelector("#code-text-color");
const dialogCodeBg = document.querySelector("#dialog-code-bg");
const dialogCodeText = document.querySelector("#dialog-code-text");

editorBgColor.addEventListener("input", () => {
  contentEditor.style.backgroundColor = editorBgColor.value;
});

function selectedCodeBlock() {
  const selection = window.getSelection();
  const range = editorRange || (selection.rangeCount ? selection.getRangeAt(0) : null);
  if (!range) return null;
  let node = range.startContainer;
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const pre = node?.closest?.("pre");
  return pre && contentEditor.contains(pre) ? pre : null;
}
function applyCodeColor(property, value) {
  const pre = selectedCodeBlock();
  if (!pre) return false;
  pre.style[property] = value;
  return true;
}
codeBgColor.addEventListener("input", () => {
  dialogCodeBg.value = codeBgColor.value;
  applyCodeColor("backgroundColor", codeBgColor.value);
});
codeTextColor.addEventListener("input", () => {
  dialogCodeText.value = codeTextColor.value;
  const pre = selectedCodeBlock();
  if (pre) pre.style.color = codeTextColor.value;
});
dialogCodeBg.addEventListener("input", () => { codeBgColor.value = dialogCodeBg.value; });
dialogCodeText.addEventListener("input", () => { codeTextColor.value = dialogCodeText.value; });

document.querySelectorAll(".editor-toolbar [data-command]").forEach((button) => {
  button.addEventListener("mousedown", rememberEditorRange);
  button.addEventListener("click", () => {
    restoreEditorRange();
    const command = button.dataset.command;
    const value = button.dataset.value || null;
    document.execCommand(command, false, value);
  });
});
document.querySelector("#insert-link").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#insert-link").addEventListener("click", () => {
  restoreEditorRange();
  const url = prompt("Enter the full link URL (https://…):");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    message(postMessage, "Please use a full http:// or https:// URL.", true);
    return;
  }
  restoreEditorRange();
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.textContent = window.getSelection()?.toString() || url;
  insertEditorNode(anchor);
});
document.querySelector("#insert-image").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#insert-image").addEventListener("click", () => {
  restoreEditorRange();
  const url = prompt("Enter the image URL (https://…):");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    message(postMessage, "Please use a full http:// or https:// image URL.", true);
    return;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Article image";
  img.className = "article-inline-image";
  insertEditorNode(img);
});
// Insert structured HTML at the last selection inside the article editor.
let editorRange = null;
function rememberEditorRange() {
  const selection = window.getSelection();
  if (selection.rangeCount && contentEditor.contains(selection.anchorNode)) editorRange = selection.getRangeAt(0).cloneRange();
}
contentEditor.addEventListener("keyup", rememberEditorRange);
contentEditor.addEventListener("mouseup", rememberEditorRange);
// Preserve the editor caret when toolbar buttons take focus.
document.querySelectorAll(".editor-toolbar button, .editor-toolbar select, .editor-toolbar input").forEach((control) => {
  control.addEventListener("mousedown", rememberEditorRange);
});
function restoreEditorRange() {
  contentEditor.focus();
  if (editorRange && contentEditor.contains(editorRange.commonAncestorContainer)) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(editorRange.cloneRange());
  }
}
function insertEditorNode(node) {
  contentEditor.focus();
  const selection = window.getSelection();
  const range = editorRange && contentEditor.contains(editorRange.commonAncestorContainer)
    ? editorRange.cloneRange() : document.createRange();
  if (!editorRange || !contentEditor.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(contentEditor);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);
  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
  editorRange = after.cloneRange();
}

// Insert the YouTube player exactly where the caret is in the article.
document.querySelector("#insert-youtube").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#insert-youtube").addEventListener("click", () => {
  rememberEditorRange();
  const url = prompt("Paste a YouTube video URL:");
  if (!url) return;
  const videoId = getYouTubeVideoId(url.trim());
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    message(postMessage, "Please enter a valid YouTube video URL.", true);
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "article-video";
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
  iframe.title = "YouTube video";
  iframe.loading = "lazy";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  wrapper.appendChild(iframe);
  insertEditorNode(wrapper);
  message(postMessage, "YouTube video inserted at the cursor position.");
});

const codeDialog = document.querySelector("#code-dialog");
document.querySelector("#insert-code").addEventListener("click", () => {
  rememberEditorRange();
  document.querySelector("#code-input").value = "";
  codeDialog.showModal();
  document.querySelector("#code-input").focus();
});
document.querySelector("#cancel-code").addEventListener("click", () => codeDialog.close());
document.querySelector("#code-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = document.querySelector("#code-input").value;
  if (!value.trim()) return;
  const pre = document.createElement("pre");
  pre.style.cssText = `background:${dialogCodeBg.value};color:${dialogCodeText.value};padding:18px;border-radius:10px;overflow-x:auto;white-space:pre;font-size:14px;line-height:1.6;margin:20px 0;`;
  const code = document.createElement("code");
  code.textContent = value; // textContent prevents executable HTML injection.
  pre.appendChild(code);
  codeDialog.close();
  insertEditorNode(pre);
});
document.querySelector("#insert-table").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#insert-table").addEventListener("click", () => {
  rememberEditorRange();
  const rowInput = prompt("Number of rows (including header):", "3");
  if (rowInput === null) return;
  const colInput = prompt("Number of columns:", "3");
  if (colInput === null) return;
  const rows = Number(rowInput), cols = Number(colInput);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 30 || cols > 12) {
    message(postMessage, "Enter 1–30 rows and 1–12 columns.", true);
    return;
  }
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;margin:20px 0";
  for (let r = 0; r < rows; r++) {
    const tr = table.insertRow();
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(r === 0 ? "th" : "td");
      cell.textContent = r === 0 ? `Heading ${c + 1}` : "Edit text";
      cell.style.cssText = "border:1px solid #cbd5e1;padding:10px 12px;text-align:left;" + (r === 0 ? "background:#f1f5f9;font-weight:700" : "");
      tr.appendChild(cell);
    }
  }
  insertEditorNode(table);
  message(postMessage, "Table inserted. Click any cell to edit its text.");
});

// Rehydrate graph previews from their persisted data attributes when loading a saved draft.
function renderSavedGraphsInEditor(container) {
  if (!window.Chart) return;
  container.querySelectorAll(".article-interactive-chart").forEach((wrapper) => {
    let rows = [];
    try { rows = JSON.parse(wrapper.dataset.chartRows || "[]"); } catch (_) {}
    if (!rows.length) return;
    const canvas = wrapper.querySelector("canvas") || document.createElement("canvas");
    if (!canvas.parentNode) wrapper.appendChild(canvas);
    if (canvas._draftChart) canvas._draftChart.destroy();
    const type = wrapper.dataset.chartType || "bar";
    const title = wrapper.dataset.chartTitle || "";
    const color = wrapper.dataset.chartColor || "#829c25";
    const bg = wrapper.dataset.chartBg || "#ffffff";
    const suffix = wrapper.dataset.chartSuffix || "";
    wrapper.style.backgroundColor = bg;
    wrapper.style.height = wrapper.style.height || "420px";
    canvas.style.cssText = "width:100%;height:360px";
    const pie = type === "pie" || type === "doughnut";
    canvas._draftChart = new Chart(canvas, {
      type,
      data: { labels: rows.map(r => r.label), datasets: [{ label: title || "Data", data: rows.map(r => r.value), backgroundColor: pie ? rows.map((_, i) => [color,"#e76f51","#2a9d8f","#e9c46a","#6c63ff","#f28482"][i % 6]) : color, borderColor: color, borderWidth: 2, tension: .35 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: pie }, title: { display: !!title, text: title }, tooltip: { callbacks: { title(items) { return items.length ? items[0].label : ""; }, label(item) { return `${Number(item.raw).toLocaleString()}${suffix}`; } } } } }
    });
  });
}

// Chart builder: store chart data in the article HTML and render it interactively on the reader page.
let activeGraphChart = null;
const graphDialog = document.querySelector("#graph-dialog");
const graphCanvas = document.querySelector("#graph-canvas");
function parseGraphRows() {
  // Split actual Windows, Unix, or Mac line endings (not the literal characters \ and n).
  return document.querySelector("#graph-data").value
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const commaIndex = line.lastIndexOf(",");
      if (commaIndex < 1) return null;
      const label = line.slice(0, commaIndex).trim();
      const rawValue = line.slice(commaIndex + 1).trim().replace(/,/g, "");
      const value = Number(rawValue);
      return label && rawValue !== "" && Number.isFinite(value) ? { label, value } : null;
    })
    .filter(Boolean);
}
function getGraphSuffix() { const selected = document.querySelector("#graph-suffix").value; return selected === "custom" ? document.querySelector("#graph-custom-suffix").value : selected; }
document.querySelector("#graph-suffix").addEventListener("change", () => { document.querySelector("#graph-custom-suffix-wrap").hidden = document.querySelector("#graph-suffix").value !== "custom"; renderGraphPreview(); });
function renderGraphPreview() {
  if (!window.Chart) {
    message(postMessage, "Chart library did not load. Check internet connection and reload admin page.", true);
    return;
  }
  const rows = parseGraphRows();
  if (activeGraphChart) activeGraphChart.destroy();
  const chartType = document.querySelector("#graph-type").value;
  activeGraphChart = new Chart(graphCanvas, {
    type: chartType,
    data: {
      labels: rows.map(row => row.label),
      datasets: [{
        label: document.querySelector("#graph-title").value || "Data",
        data: rows.map(row => row.value),
        backgroundColor: chartType === "pie" ? rows.map((_, i) => [document.querySelector("#graph-color").value,"#e76f51","#2a9d8f","#e9c46a","#6c63ff","#f28482"][i % 6]) : document.querySelector("#graph-color").value,
        borderColor: document.querySelector("#graph-color").value,
        borderWidth: 2,
        fill: chartType === "line" ? false : undefined,
        tension: .35
      }]
    },
    options: { responsive: false, animation: false, plugins: { legend: { display: chartType === "pie" }, title: { display: !!document.querySelector("#graph-title").value, text: document.querySelector("#graph-title").value }, tooltip: { callbacks: { label(item) { return `${Number(item.raw).toLocaleString()}${getGraphSuffix()}`; } } } } }, plugins: [{ id: "chosenCanvasBackground", beforeDraw(chart) { const ctx = chart.ctx; ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = document.querySelector("#graph-bg-color").value; ctx.fillRect(0, 0, chart.width, chart.height); ctx.restore(); } }]
  });
}
document.querySelector("#insert-graph").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#insert-graph").addEventListener("click", () => {
  rememberEditorRange();
  graphDialog.showModal();
  renderGraphPreview();
});
["graph-type","graph-title","graph-data","graph-color","graph-bg-color","graph-suffix","graph-custom-suffix"].forEach(id => document.querySelector(`#${id}`).addEventListener("input", renderGraphPreview));
document.querySelector("#close-graph").addEventListener("click", () => graphDialog.close());
document.querySelector("#graph-cancel").addEventListener("click", () => graphDialog.close());
document.querySelector("#graph-insert").addEventListener("click", () => {
  const rows = parseGraphRows();
  if (rows.length < 2) { message(postMessage, "Enter at least two data rows as Label,Value.", true); return; }
  if (!window.Chart || !activeGraphChart) {
    message(postMessage, "Graph preview is not ready. Check internet connection, then reopen the graph tool.", true);
    return;
  }
  renderGraphPreview();
  const chartTitle = document.querySelector("#graph-title").value.trim();
  const chartBox = document.createElement("div");
  chartBox.className = "article-interactive-chart";
  chartBox.setAttribute("data-chart-type", document.querySelector("#graph-type").value);
  chartBox.setAttribute("data-chart-title", chartTitle);
  chartBox.setAttribute("data-chart-rows", JSON.stringify(rows));
  chartBox.setAttribute("data-chart-color", document.querySelector("#graph-color").value);
  chartBox.setAttribute("data-chart-bg", document.querySelector("#graph-bg-color").value);
  chartBox.setAttribute("data-chart-suffix", getGraphSuffix());
  chartBox.setAttribute("contenteditable", "false");
  chartBox.style.cssText = "display:block;max-width:100%;width:720px;height:420px;margin:24px auto;padding:12px;border-radius:8px";
  const chartPlaceholder = document.createElement("p");
  chartPlaceholder.textContent = `${chartTitle || "Interactive graph"} (interactive chart)`;
  chartPlaceholder.style.cssText = "text-align:center;color:#777;font-size:13px;margin:0 0 8px";
  const chartPreviewCanvas = document.createElement("canvas");
  chartPreviewCanvas.style.cssText = "width:100%;height:360px";
  chartBox.append(chartPlaceholder, chartPreviewCanvas);
  graphDialog.close();
  // Insert the non-editable chart block plus an editable paragraph after it,
  // so the author can continue typing immediately after the graph.
  const continuation = document.createElement("p");
  continuation.innerHTML = "<br>";
  insertEditorNode(chartBox);
  const afterChart = document.createRange();
  afterChart.setStartAfter(chartBox);
  afterChart.collapse(true);
  afterChart.insertNode(continuation);
  const caretRange = document.createRange();
  caretRange.selectNodeContents(continuation);
  caretRange.collapse(true);
  const caretSelection = window.getSelection();
  caretSelection.removeAllRanges();
  caretSelection.addRange(caretRange);
  editorRange = caretRange.cloneRange();
  const editorCanvas = chartBox.querySelector("canvas");
  new Chart(editorCanvas, {
    type: document.querySelector("#graph-type").value,
    data: {
      labels: rows.map(row => row.label),
      datasets: [{
        label: "Collection",
        data: rows.map(row => row.value),
        backgroundColor: document.querySelector("#graph-type").value === "pie" ? rows.map((_, i) => [document.querySelector("#graph-color").value,"#e76f51","#2a9d8f","#e9c46a","#6c63ff","#f28482"][i % 6]) : document.querySelector("#graph-color").value,
        borderColor: document.querySelector("#graph-color").value,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: document.querySelector("#graph-type").value === "pie" },
        title: { display: !!chartTitle, text: chartTitle },
        tooltip: { callbacks: { title(items) { return items.length ? items[0].label : ""; }, label(item) { return `${Number(item.raw).toLocaleString()}${getGraphSuffix()}`; } } }
      }
    }
  });
  message(postMessage, "Interactive graph inserted. Movie names and values will show on hover/tap in the published article.");
});

document.querySelector("#preview-post").addEventListener("mousedown", rememberEditorRange);
document.querySelector("#preview-post").addEventListener("click", () => {
  const title = document.querySelector("#post-title").value.trim() || "Article preview";
  const excerpt = document.querySelector("#post-excerpt").value.trim();
  const content = contentEditor.innerHTML || "<p>Start writing to preview your article.</p>";
  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) {
    message(postMessage, "Your browser blocked the preview window. Allow pop-ups and try again.", true);
    return;
  }
  const contentBackground = document.querySelector("#editor-bg-color").value;
  preview.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Flames preview</title><link rel="stylesheet" href="${new URL("css/style.css", location.href).href}"></head><body><main class="article-main"><p class="preview-note">Preview only — not published</p><header class="article-header"><h1>${escapeHtml(title)}</h1><p class="article-excerpt">${escapeHtml(excerpt)}</p></header><article class="article-content" style="background:${contentBackground};padding:18px;border-radius:12px">${content}</article></main></body></html>`);
  preview.document.close();
});

onAuthStateChanged(auth, (user) => {
  if (user) requireAdmin(user);
  else {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }
});
