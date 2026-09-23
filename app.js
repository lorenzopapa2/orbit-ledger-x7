(function () {
  const BOT_ORDER = [
    "珠海学院", "新港人", "生财有术", "Hermes", "境外医疗",
    "Robin Hood", "shopify", "古籍", "Test", "chat"
  ];

  const els = {
    dateSelect: document.getElementById("dateSelect"),
    prevDay: document.getElementById("prevDay"),
    nextDay: document.getElementById("nextDay"),
    statBots: document.getElementById("statBots"),
    statActive: document.getElementById("statActive"),
    statBlockers: document.getElementById("statBlockers"),
    statGen: document.getElementById("statGen"),
    needsSection: document.getElementById("needsSection"),
    needsList: document.getElementById("needsList"),
    botGrid: document.getElementById("botGrid"),
    footNote: document.getElementById("footNote"),
  };

  let dates = [];
  let routinesByName = {};
  let openBlockers = [];
  let currentDate = null;
  let latestDate = null;

  function statusClass(s) {
    if (s === "漏跑") return "missed";
    if (s === "失败" || s === "卡住") return "fail";
    if (s === "部分失败") return "partial";
    if (s === "空闲") return "idle";
    return "ok";
  }

  function normalizeBlocker(botName, x) {
    if (x && typeof x === "object") {
      return {
        bot: botName,
        key: x.key || `${botName}:${x.text || ""}`,
        text: x.text || String(x),
        since: x.since || null,
        days: x.days || 1,
      };
    }
    return {
      bot: botName,
      key: `${botName}:${x}`,
      text: String(x),
      since: null,
      days: 1,
    };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sortBots(bots) {
    const map = Object.fromEntries((bots || []).map((b) => [b.name, b]));
    return BOT_ORDER.map((name) => map[name]).filter(Boolean);
  }

  function fillDateSelect() {
    els.dateSelect.innerHTML = "";
    dates.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      els.dateSelect.appendChild(opt);
    });
  }

  function updateNavButtons() {
    const i = dates.indexOf(currentDate);
    els.prevDay.disabled = i <= 0;
    els.nextDay.disabled = i < 0 || i >= dates.length - 1;
  }

  async function loadRoutines() {
    const res = await fetch("config/routines.json", { cache: "no-store" });
    const data = await res.json();
    routinesByName = {};
    (data.bots || []).forEach((b) => {
      routinesByName[b.name] = b.routines || [];
    });
  }

  async function loadOpenBlockers() {
    try {
      const res = await fetch("data/open-blockers.json", { cache: "no-store" });
      if (!res.ok) {
        openBlockers = [];
        return;
      }
      const data = await res.json();
      openBlockers = data.items || [];
    } catch (_) {
      openBlockers = [];
    }
  }

  async function loadIndex() {
    const res = await fetch("data/index.json", { cache: "no-store" });
    const data = await res.json();
    dates = (data.dates || []).slice().sort();
    if (dates.length > 7) dates = dates.slice(-7);
    latestDate = data.latest && dates.includes(data.latest)
      ? data.latest
      : dates[dates.length - 1];
    currentDate = latestDate;
    fillDateSelect();
    if (currentDate) els.dateSelect.value = currentDate;
  }

  function collectNeeds(bots, date) {
    // Latest day prefers persistent open-blockers (deduped across days).
    if (date === latestDate && openBlockers.length) {
      return openBlockers.map((it) => ({
        bot: it.bot,
        text: it.text,
        days: it.days || 1,
        key: it.key,
      }));
    }
    const items = [];
    bots.forEach((b) => {
      (b.blockers || []).forEach((x) => items.push(normalizeBlocker(b.name, x)));
    });
    return items;
  }

  function renderNeeds(bots, date) {
    const items = collectNeeds(bots, date);
    if (!items.length) {
      els.needsSection.hidden = true;
      els.needsList.innerHTML = "";
      return;
    }
    els.needsSection.hidden = false;
    els.needsList.innerHTML = items
      .map((it) => {
        const days = it.days && it.days > 1
          ? `<span class="days-tag">第 ${it.days} 天</span>`
          : it.days === 1
            ? `<span class="days-tag">第 1 天</span>`
            : "";
        return `<li><span class="bot-tag">${escapeHtml(it.bot)}</span>${escapeHtml(
          it.text
        )}${days}</li>`;
      })
      .join("");
  }

  function renderCard(bot) {
    const routines = routinesByName[bot.name] || [];
    const routineHtml = routines.length
      ? `<ul class="routines">${routines
          .map((r) => {
            const cls = r.paused ? "paused" : "";
            const tag = r.paused ? "（已暂停）" : "";
            return `<li class="${cls}">${escapeHtml(r.name)} · ${escapeHtml(
              r.schedule
            )}${tag}</li>`;
          })
          .join("")}</ul>`
      : `<p class="empty">无例行任务</p>`;

    const highlights = bot.highlights || [];
    const highlightsHtml = highlights.length
      ? `<ul class="highlights">${highlights
          .map((h) => `<li>${escapeHtml(h)}</li>`)
          .join("")}</ul>`
      : `<p class="empty">暂无</p>`;

    const links = bot.links || [];
    const linksHtml = links.length
      ? `<ul class="links">${links
          .map((u) => {
            const safe = escapeHtml(u);
            return `<li><a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a></li>`;
          })
          .join("")}</ul>`
      : `<p class="empty">无公开链接</p>`;

    const blockers = (bot.blockers || []).map((x) => normalizeBlocker(bot.name, x));
    const blockersHtml = blockers.length
      ? `<div><p class="section-title">待办</p><ul class="blockers">${blockers
          .map((x) => {
            const days =
              x.days && x.days >= 1
                ? `<span class="days-tag">第 ${x.days} 天</span>`
                : "";
            return `<li>${escapeHtml(x.text)}${days}</li>`;
          })
          .join("")}</ul></div>`
      : "";

    const formatTag =
      bot.formatOk === false
        ? `<span class="format-warn">未按格式</span>`
        : "";

    const statusLineHtml = bot.statusLine
      ? `<div><p class="section-title">状态行</p><p class="status-line">${escapeHtml(
          bot.statusLine
        )}</p></div>`
      : "";

    const rulesHtml = `<div>
      <p class="section-title">规则文件</p>
      ${
        bot.rulesPath
          ? `<p class="rules-line"><code>${escapeHtml(
              bot.rulesPath
            )}</code>${
              bot.rulesUpdated
                ? ` · 更新 ${escapeHtml(bot.rulesUpdated)}`
                : ""
            }</p>`
          : `<p class="empty">尚未读到 RULES.md / 规则文件</p>`
      }
    </div>`;

    return `<article class="card">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(bot.name)}${formatTag}</h3>
          <div class="meta">最后活跃 · ${escapeHtml(bot.lastActive || "—")}</div>
        </div>
        <span class="badge ${statusClass(bot.status)}">${escapeHtml(
          bot.status || "—"
        )}</span>
      </div>
      ${statusLineHtml}
      <div>
        <p class="section-title">例行任务</p>
        ${routineHtml}
      </div>
      ${rulesHtml}
      <div>
        <p class="section-title">今日要点</p>
        ${highlightsHtml}
      </div>
      <div>
        <p class="section-title">产出链接</p>
        ${linksHtml}
      </div>
      ${blockersHtml}
    </article>`;
  }

  async function loadDay(date) {
    currentDate = date;
    els.dateSelect.value = date;
    updateNavButtons();
    const res = await fetch(`data/${date}.json`, { cache: "no-store" });
    if (!res.ok) {
      els.botGrid.innerHTML = `<p class="empty">该日暂无数据</p>`;
      els.statBots.textContent = "0";
      els.statActive.textContent = "0";
      els.statBlockers.textContent = "0";
      els.statGen.textContent = "—";
      els.needsSection.hidden = true;
      return;
    }
    const data = await res.json();
    const bots = sortBots(data.bots || []);
    const active = bots.filter((b) => b.status !== "空闲").length;
    const needs = collectNeeds(bots, date);

    els.statBots.textContent = String(bots.length);
    els.statActive.textContent = String(active);
    els.statBlockers.textContent = String(needs.length);
    els.statGen.textContent = (data.generatedAt || "—").replace(" CST", "");
    els.footNote.textContent = `日期 ${date} · ${bots.length} bots`;

    renderNeeds(bots, date);
    els.botGrid.innerHTML = bots.map(renderCard).join("");
  }

  els.dateSelect.addEventListener("change", () => loadDay(els.dateSelect.value));
  els.prevDay.addEventListener("click", () => {
    const i = dates.indexOf(currentDate);
    if (i > 0) loadDay(dates[i - 1]);
  });
  els.nextDay.addEventListener("click", () => {
    const i = dates.indexOf(currentDate);
    if (i >= 0 && i < dates.length - 1) loadDay(dates[i + 1]);
  });

  (async function init() {
    try {
      await loadRoutines();
      await loadOpenBlockers();
      await loadIndex();
      if (!currentDate) {
        els.botGrid.innerHTML = `<p class="empty">尚无汇总数据</p>`;
        return;
      }
      await loadDay(currentDate);
    } catch (e) {
      els.botGrid.innerHTML = `<p class="empty">加载失败</p>`;
      console.error(e);
    }
  })();
})();
