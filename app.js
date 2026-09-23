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
  let currentDate = null;

  function statusClass(s) {
    if (s === "卡住") return "stuck";
    if (s === "空闲") return "idle";
    return "ok";
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

  async function loadIndex() {
    const res = await fetch("data/index.json", { cache: "no-store" });
    const data = await res.json();
    dates = (data.dates || []).slice().sort();
    // keep last 7
    if (dates.length > 7) dates = dates.slice(-7);
    currentDate = data.latest && dates.includes(data.latest)
      ? data.latest
      : dates[dates.length - 1];
    fillDateSelect();
    if (currentDate) els.dateSelect.value = currentDate;
  }

  function renderNeeds(bots) {
    const items = [];
    bots.forEach((b) => {
      (b.blockers || []).forEach((x) => {
        items.push({ bot: b.name, text: x });
      });
    });
    if (!items.length) {
      els.needsSection.hidden = true;
      els.needsList.innerHTML = "";
      return;
    }
    els.needsSection.hidden = false;
    els.needsList.innerHTML = items
      .map(
        (it) =>
          `<li><span class="bot-tag">${escapeHtml(it.bot)}</span>${escapeHtml(
            it.text
          )}</li>`
      )
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

    const blockers = bot.blockers || [];
    const blockersHtml = blockers.length
      ? `<div><p class="section-title">待办</p><ul class="blockers">${blockers
          .map((x) => `<li>${escapeHtml(x)}</li>`)
          .join("")}</ul></div>`
      : "";

    return `<article class="card">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(bot.name)}</h3>
          <div class="meta">最后活跃 · ${escapeHtml(bot.lastActive || "—")}</div>
        </div>
        <span class="badge ${statusClass(bot.status)}">${escapeHtml(
          bot.status || "—"
        )}</span>
      </div>
      <div>
        <p class="section-title">例行任务</p>
        ${routineHtml}
      </div>
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
    const blockerCount = bots.reduce(
      (n, b) => n + ((b.blockers && b.blockers.length) || 0),
      0
    );

    els.statBots.textContent = String(bots.length);
    els.statActive.textContent = String(active);
    els.statBlockers.textContent = String(blockerCount);
    els.statGen.textContent = (data.generatedAt || "—").replace(" CST", "");
    els.footNote.textContent = `日期 ${date} · ${bots.length} bots`;

    renderNeeds(bots);
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
