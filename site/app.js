"use strict";

const byId = identifier => document.getElementById(identifier);
const siteUrl = path => new URL(path.replace(/^\/+/, ""), new URL("./", document.baseURI)).href;
const number = value => Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—";
const state = { data: null, view: "stars", query: "", category: "", agent: "", page: 1, pageSize: 25, historyDate: null, favorites: new Set(), filtered: [] };
let toastTimer;

try {
  const saved = JSON.parse(localStorage.getItem("skill-index-favorites") || "[]");
  state.favorites = new Set(Array.isArray(saved) ? saved.filter(value => typeof value === "string") : []);
} catch {
  state.favorites = new Set();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function externalLink(text, url, className = "button") {
  const link = element("a", className, text);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function toast(message) {
  clearTimeout(toastTimer);
  byId("toast").textContent = message;
  byId("toast").hidden = false;
  toastTimer = setTimeout(() => { byId("toast").hidden = true; }, 2800);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function setView(view) {
  state.view = view;
  state.page = 1;
  render();
}

function resetFilters() {
  state.query = "";
  state.category = "";
  state.agent = "";
  state.page = 1;
  state.view = "stars";
  byId("search").value = "";
  byId("category-filter").value = "";
  byId("agent-filter").value = "";
  render();
}

function buildFilterOptions() {
  const counts = new Map();
  const agents = new Set();
  for (const skill of state.data.skills) {
    counts.set(skill.category, (counts.get(skill.category) || 0) + 1);
    skill.agents.forEach(agent => agents.add(agent));
  }
  byId("stat-total").textContent = number(state.data.skills.length);
  byId("stat-categories").textContent = number(counts.size);
  byId("stat-snapshot").textContent = state.data.meta.snapshotDate.replaceAll("-", ".");
  byId("nav-total").textContent = state.data.skills.length;
  byId("heading-count").textContent = state.data.skills.length;
  const categorySelect = byId("category-filter");
  categorySelect.replaceChildren(new Option("全部分类", ""));
  [...counts].sort((first, second) => first[0].localeCompare(second[0], "zh-CN")).forEach(([category, count]) => categorySelect.add(new Option(`${category} · ${count}`, category)));
  const agentSelect = byId("agent-filter");
  agentSelect.replaceChildren(new Option("全部工具", ""));
  [...agents].sort().forEach(agent => agentSelect.add(new Option(agent, agent)));
  if (!counts.has(state.category)) state.category = "";
  if (!agents.has(state.agent)) state.agent = "";
  categorySelect.value = state.category;
  agentSelect.value = state.agent;
  const navigation = byId("category-nav");
  navigation.replaceChildren();
  for (const category of ["开发工具", "设计", "营销", "科研", "知识管理", "软件工程"]) {
    if (!counts.has(category)) continue;
    const button = element("button", "category-button");
    button.type = "button";
    button.dataset.category = category;
    button.append(element("span"), document.createTextNode(category), element("span", "category-number", counts.get(category)));
    navigation.append(button);
  }
  const download = byId("excel-download");
  download.href = siteUrl(state.data.meta.downloads.excel);
  download.download = `GitHub技能累计人气Top500_${state.data.meta.reportDate}.xlsx`;
  download.setAttribute("aria-disabled", "false");
  byId("scope-text").textContent = `在来源收录的 ${number(state.data.meta.coverage)} 个仓库中，按累计 Stars 取前 ${state.data.skills.length}；星标属于整个仓库，非单个技能。这不是 GitHub 官方全站榜单，安装命令未逐项试装。`;
  byId("last-checked").textContent = `${state.historyDate ? "历史整理" : "最近成功更新"} ${formatTime(state.data.meta.collectedAt)} · 北京时间`;
  byId("history-indicator").hidden = !state.historyDate;
  byId("history-indicator").textContent = state.historyDate ? `正在查看 ${state.historyDate} 历史版本` : "";
}

function render() {
  if (!state.data) return;
  const query = state.query.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  state.filtered = state.data.skills.filter(skill => {
    if (state.view === "favorites" && !state.favorites.has(skill.repo)) return false;
    if (state.category && skill.category !== state.category) return false;
    if (state.agent && !skill.agents.includes(state.agent)) return false;
    const searchable = `${skill.repo} ${skill.description} ${skill.originalDescription} ${skill.category} ${skill.agents.join(" ")}`.toLocaleLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  state.filtered.sort((first, second) => state.view === "growth" ? (second.stars7d ?? -Infinity) - (first.stars7d ?? -Infinity) || first.rank - second.rank : first.rank - second.rank);
  const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(Math.max(state.page, 1), pages);
  const offset = (state.page - 1) * state.pageSize;
  const visible = state.filtered.slice(offset, offset + state.pageSize);
  const body = byId("skills-body");
  const fragment = document.createDocumentFragment();
  for (const skill of visible) {
    const row = element("tr");
    const rank = element("td", "rank-cell");
    rank.append(skill.rank <= 3 ? element("span", `rank-medal rank-${skill.rank}`, String(skill.rank).padStart(2, "0")) : document.createTextNode(String(skill.rank).padStart(2, "0")));
    const repository = element("td", "repository-cell");
    const repoLink = externalLink(skill.name, skill.githubUrl, "repo-name");
    repoLink.title = skill.repo;
    repository.append(repoLink, element("span", "repo-owner", skill.owner), element("span", "repo-category", skill.category));
    const ability = element("td", "ability-cell");
    const description = element("span", "ability-text", skill.description);
    description.title = skill.description;
    ability.append(description);
    const stars = element("td", "numeric");
    stars.append(element("span", "star-symbol", "☆"), element("span", "star-value", number(skill.stars)));
    const growth = element("td", "numeric growth-cell");
    growth.append(element("span", `growth-value${skill.stars7d < 0 ? " negative" : ""}`, skill.stars7d === null ? "—" : `${skill.stars7d >= 0 ? "+" : ""}${number(skill.stars7d)}`));
    const actions = element("td");
    const controls = element("div", "row-actions");
    const install = element("button", "install-button", "安装 ↗");
    install.type = "button";
    install.dataset.install = skill.repo;
    install.setAttribute("aria-label", `查看安装 ${skill.repo}`);
    const favorite = element("button", "favorite-button", state.favorites.has(skill.repo) ? "★" : "☆");
    favorite.type = "button";
    favorite.dataset.favorite = skill.repo;
    favorite.setAttribute("aria-label", `${state.favorites.has(skill.repo) ? "取消收藏" : "收藏"} ${skill.repo}`);
    favorite.setAttribute("aria-pressed", String(state.favorites.has(skill.repo)));
    controls.append(install, favorite);
    actions.append(controls);
    row.append(rank, repository, ability, stars, growth, actions);
    fragment.append(row);
  }
  body.replaceChildren(fragment);
  byId("empty-state").hidden = state.filtered.length !== 0;
  byId("result-summary").textContent = `找到 ${number(state.filtered.length)} 个技能仓库${state.category ? ` · ${state.category}` : ""}${state.agent ? ` · ${state.agent}` : ""}`;
  byId("page-summary").textContent = state.filtered.length ? `显示 ${offset + 1}–${offset + visible.length}，共 ${number(state.filtered.length)} 项` : "暂无匹配项";
  byId("page-label").textContent = `${state.page} / ${pages}`;
  byId("previous-page").disabled = state.page === 1;
  byId("next-page").disabled = state.page === pages;
  byId("favorite-count").textContent = state.favorites.size;
  byId("list-subtitle").textContent = state.view === "growth" ? "在前500仓库中，按来源近7日新增星标排序。" : state.view === "favorites" ? "你收藏的技能，只保存在当前浏览器中。" : "按仓库累计 Stars 排序，持续发现更好的工具。";
  document.querySelectorAll("[data-view]").forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-category]").forEach(button => button.classList.toggle("active", button.dataset.category === state.category));
  byId("nav-ranking").classList.toggle("active", state.view !== "favorites");
  byId("nav-favorites").classList.toggle("active", state.view === "favorites");
  byId("stars-sort-hint").hidden = state.view === "growth";
  byId("growth-sort-hint").hidden = state.view !== "growth";
  byId("stars-header").setAttribute("aria-sort", state.view === "growth" ? "none" : "descending");
  byId("growth-header").setAttribute("aria-sort", state.view === "growth" ? "descending" : "none");
}

function openDialog(title, kicker = "SKILL DETAILS") {
  const container = byId("dialog-content");
  container.replaceChildren(element("h2", "", title));
  container.firstElementChild.id = "dialog-title";
  byId("dialog-kicker").textContent = kicker;
  if (!byId("detail-dialog").open) byId("detail-dialog").showModal();
  return container;
}

function codeBlock(command) {
  const block = element("div", "code-block");
  const button = element("button", "copy-button", "复制");
  button.type = "button";
  button.dataset.copy = command;
  button.setAttribute("aria-label", `复制 ${command}`);
  block.append(element("code", "", command), button);
  return block;
}

function showSkill(repo) {
  const skill = state.data.skills.find(item => item.repo === repo);
  if (!skill) return;
  const container = openDialog(skill.name);
  container.append(element("div", "dialog-owner", skill.repo), element("p", "dialog-description", skill.description));
  const stats = element("div", "detail-stats");
  stats.append(element("span", "detail-pill", `☆ ${number(skill.stars)} Stars`), element("span", "detail-pill", skill.category), element("span", "detail-pill", `快照 ${state.data.meta.snapshotDate}`));
  container.append(stats);
  const section = element("section", "detail-section");
  section.append(element("h3", "", "两步安装，按需选择"), element("p", "", "① 先列出仓库中的技能，阅读对应的 README 和 SKILL.md。"), codeBlock(skill.listCommand), element("p", "", "② 在交互列表中选择需要的技能，安装至当前用户的 Codex。"), codeBlock(skill.installCommand));
  container.append(section, element("p", "detail-section", `来源注明的兼容工具：${skill.agents.join("、") || "未注明"}`), element("p", "detail-note", "需要 Node.js/npm/npx。命令未经逐项试装，通用工具不保证识别所有仓库；若失败，请按仓库 README 的官方方式安装。请先检查脚本、依赖、权限与许可证，不要批量安装。星标属于整个仓库，不是安全认证。"));
  const links = element("div", "detail-links");
  links.append(externalLink("查看 GitHub / README ↗", skill.githubUrl, "button button-primary"), externalLink("查看能力来源 ↗", skill.sourceUrl));
  container.append(links);
}

function showGuide() {
  const container = openDialog("让榜单更好用，也更可信。", "ABOUT THIS INDEX");
  const list = element("ol", "guide-list");
  const notes = [
    "这是云端运行的技能索引，由GitHub Actions计划每天北京时间09:00联网更新，不依赖个人电脑开机。平台排队、数据源故障或任务停用可能导致延迟，请核对实际成功时间。",
    `从第三方 The Skill Leaderboard 收录的 ${state.data?.meta.coverage ?? "—"} 个仓库中取累计 Stars 前500，不是GitHub官方全站榜，也不是历史峰值排名。`,
    "累计Stars、7日增长属于仓库，不属于仓库内单项技能。网站更新时间与星标来源快照日期分别展示，不能把旧快照当作实时计数。",
    "中文能力说明基于来源摘要整理，不代表已经测试或保证可用。新入榜尚未翻译时会保留来源原文并标注。",
    "收藏只保存在当前浏览器。‘导出筛选结果’下载当前筛选的全部记录，不仅是当前一页；‘下载Excel’下载本期完整前500。",
    "点‘安装’查看两步命令。先安装Node.js/npm/npx，检查README、SKILL.md和脚本；通用安装失败时使用仓库官方说明。不会自动执行安装。",
    "安全测试必须得到授权；金融、医疗、法律和税务内容不替代专业意见。发布、支付和共享资料需另行确认。",
    "更新失败会保留上次成功数据并提示，不冒充已更新。历史快照从本网站建立时开始记录，不是补造过去的每日榜单。",
  ];
  notes.forEach(note => list.append(element("li", "", note)));
  container.append(list);
  if (state.data) container.append(externalLink("查看数据来源 ↗", state.data.meta.source));
}

async function showHistory() {
  const container = openDialog("每一天，都留下一份记录。", "HISTORY SNAPSHOTS");
  container.append(element("p", "dialog-description", "从网站建立起保存成功更新的每日版本。当天多次更新保留最近一次；来源快照可能滞后于整理日期。"));
  try {
    const response = await fetch(siteUrl("data/history.json"), { cache: "no-store" });
    if (!response.ok) throw new Error("历史列表读取失败");
    const history = await response.json();
    const list = element("div", "history-list");
    const latest = element("button", "history-button", "返回当前最新榜单");
    latest.type = "button";
    latest.addEventListener("click", async () => {
      try { await loadData(); byId("detail-dialog").close(); }
      catch { toast("最新榜单读取失败，请重试"); }
    });
    list.append(latest);
    for (const item of history.entries) {
      const button = element("button", "history-button");
      button.type = "button";
      button.append(element("strong", "", item.date), element("small", "", `${item.count} 项 · 星标快照 ${item.snapshotDate} →`));
      button.addEventListener("click", async () => {
        try {
          await loadData(item.path, item.date);
          byId("detail-dialog").close();
        } catch { toast("历史版本读取失败，请重试"); }
      });
      list.append(button);
    }
    container.append(list);
  } catch {
    container.append(element("p", "detail-note", "暂时无法读取历史记录。当前榜单不受影响，请稍后重试。"));
  }
}

function exportCsv() {
  if (!state.filtered.length) { toast("没有可导出的记录"); return; }
  const headers = ["累计排名", "仓库", "Stars", "近7日新增", "分类", "中文能力", "列出技能", "安装到Codex", "兼容代理", "GitHub", "能力来源", "星标快照"];
  const safeCell = value => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const records = state.filtered.map(skill => [skill.rank, skill.repo, skill.stars, skill.stars7d, skill.category, skill.description, skill.listCommand, skill.installCommand, skill.agents.join(" / "), skill.githubUrl, skill.sourceUrl, state.data.meta.snapshotDate]);
  const blob = new Blob(["\uFEFF" + [headers, ...records].map(row => row.map(safeCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `技能榜单_${state.data.meta.reportDate}_${records.length}项.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast(`已导出 ${records.length} 条筛选结果`);
}

async function readStatus() {
  try {
    const response = await fetch(siteUrl("data/status.json"), { cache: "no-store" });
    if (!response.ok) throw new Error("状态读取失败");
    const status = await response.json();
    const notice = byId("status-notice");
    const snapshotAge = state.data ? Math.floor((Date.now() - Date.parse(state.data.meta.snapshotDate + "T00:00:00+08:00")) / 86400000) : 0;
    const warnings = [];
    if (status.state === "error") warnings.push(`最近一次联网更新失败（${formatTime(status.attemptedAt)}）。当前保留上次成功榜单，并未将旧数据冒充新数据。`);
    if (status.state === "updating") warnings.push("正在联网更新。当前先展示最近一次成功榜单，完成后页面会自动读取新数据。");
    if (snapshotAge > 2) warnings.push(`来源星标快照为 ${state.data.meta.snapshotDate}，已超过2天；请注意数据时效。`);
    notice.hidden = warnings.length === 0;
    notice.textContent = warnings.join(" ");
    byId("top-status-text").textContent = state.historyDate ? "正在查看历史快照" : status.state === "error" ? "更新待恢复" : status.state === "updating" ? "正在更新榜单" : `成功更新 ${formatTime(status.lastSuccessAt)}`;
  } catch {
    byId("status-notice").hidden = false;
    byId("status-notice").textContent = "暂时无法读取更新状态。榜单保留显示，请稍后刷新检查。";
    byId("top-status-text").textContent = "更新状态暂不可用";
  }
}

async function loadData(url = "data/catalog.json", historyDate = null) {
  const response = await fetch(siteUrl(url), { cache: "no-store" });
  if (!response.ok) throw new Error("榜单读取失败");
  const data = await response.json();
  if (!data.meta || !Array.isArray(data.skills) || !data.skills.length) throw new Error("榜单格式不正确");
  state.data = data;
  state.historyDate = historyDate;
  state.page = 1;
  buildFilterOptions();
  render();
  await readStatus();
}

byId("search").addEventListener("input", event => { state.query = event.target.value; state.page = 1; render(); });
byId("category-filter").addEventListener("change", event => { state.category = event.target.value; state.page = 1; render(); });
byId("agent-filter").addEventListener("change", event => { state.agent = event.target.value; state.page = 1; render(); });
byId("page-size").addEventListener("change", event => { state.pageSize = Number(event.target.value); state.page = 1; render(); });
byId("previous-page").addEventListener("click", () => { state.page -= 1; render(); });
byId("next-page").addEventListener("click", () => { state.page += 1; render(); });
byId("reset-filters").addEventListener("click", resetFilters);
byId("empty-reset").addEventListener("click", resetFilters);
byId("nav-ranking").addEventListener("click", resetFilters);
byId("nav-favorites").addEventListener("click", () => { resetFilters(); setView("favorites"); });
byId("nav-history").addEventListener("click", showHistory);
byId("guide-button").addEventListener("click", showGuide);
byId("csv-download").addEventListener("click", exportCsv);
byId("dialog-close").addEventListener("click", () => byId("detail-dialog").close());
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
byId("category-nav").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  byId("category-filter").value = state.category;
  state.page = 1;
  render();
});
byId("skills-body").addEventListener("click", event => {
  const install = event.target.closest("[data-install]");
  if (install) { showSkill(install.dataset.install); return; }
  const favorite = event.target.closest("[data-favorite]");
  if (!favorite) return;
  const repo = favorite.dataset.favorite;
  state.favorites.has(repo) ? state.favorites.delete(repo) : state.favorites.add(repo);
  try { localStorage.setItem("skill-index-favorites", JSON.stringify([...state.favorites])); }
  catch { toast("当前浏览器无法保存收藏，关闭页面后可能丢失"); }
  render();
});
byId("dialog-content").addEventListener("click", async event => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  try { await navigator.clipboard.writeText(button.dataset.copy); toast("安装命令已复制，执行前请先检查仓库内容"); }
  catch { toast("无法访问剪贴板，请手动选择并复制命令"); }
});
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !byId("detail-dialog").open) { event.preventDefault(); byId("search").focus(); }
});
loadData().catch(() => {
  byId("status-notice").hidden = false;
  byId("status-notice").textContent = "暂时无法读取榜单，请检查网络并刷新页面。不会展示虚构排名。";
  byId("result-summary").textContent = "榜单暂不可用";
  byId("top-status-text").textContent = "数据读取失败";
});
setInterval(async () => {
  if (document.hidden || byId("detail-dialog").open) return;
  try {
    if (!state.historyDate) {
      const response = await fetch(siteUrl("data/catalog.json"), { cache: "no-store" });
      if (!response.ok) throw new Error("榜单暂不可用");
      const data = await response.json();
      if (data.meta.collectedAt !== state.data?.meta.collectedAt) {
        state.data = data;
        buildFilterOptions();
        render();
        toast("榜单已更新为最新成功版本");
      }
    }
    await readStatus();
  } catch {
    byId("top-status-text").textContent = "连接暂不可用，保留当前榜单";
  }
}, 60000);
