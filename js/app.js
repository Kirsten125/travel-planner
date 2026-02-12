(() => {
  // ========= 匯率 API =========
  // 支援 TWD 且可取歷史資料
  const FX_API = {
    latest: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
    date: (yyyy_mm_dd) =>
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yyyy_mm_dd}/v1/currencies`
  };

  const FX_AUTO_REFRESH_MS = 60 * 1000; // 60 秒
  const FX_TREND_AUTO_EVERY = 5; // 每 5 次自動更新重抓一次趨勢

  const PRIORITY_CURRENCIES = ["TWD", "USD", "EUR", "JPY", "CNY", "KRW", "GBP", "HKD"];

  const CURRENCY_ZH_MAP = {
    TWD: "新臺幣",
    USD: "美元",
    EUR: "歐元",
    JPY: "日圓",
    CNY: "人民幣",
    KRW: "韓元",
    GBP: "英鎊",
    HKD: "港幣",
    AUD: "澳幣",
    CAD: "加幣",
    CHF: "瑞士法郎",
    SGD: "新幣",
    NZD: "紐幣",
    THB: "泰銖",
    MYR: "馬幣",
    PHP: "菲律賓披索",
    IDR: "印尼盾",
    INR: "印度盧比",
    SEK: "瑞典克朗",
    NOK: "挪威克朗",
    DKK: "丹麥克朗",
    PLN: "波蘭茲羅提",
    CZK: "捷克克朗",
    HUF: "匈牙利福林",
    RON: "羅馬尼亞列伊",
    TRY: "土耳其里拉",
    ZAR: "南非蘭特",
    ILS: "以色列謝克爾",
    ISK: "冰島克朗",
    MXN: "墨西哥披索",
    BRL: "巴西里拉",
    AED: "阿聯酋迪拉姆",
    SAR: "沙烏地里亞爾"
  };

  const KEYS = {
    itinerary: "travel_itinerary_v4",
    expenses: "travel_expenses_v4",
    packing: "travel_packing_v4"
  };

  const state = {
    itinerary: load(KEYS.itinerary, []),
    expenses: load(KEYS.expenses, []),
    packing: load(KEYS.packing, []),
    currencies: []
  };

  const charts = {
    category: null,
    daily: null,
    fx: null
  };

  let editingItineraryId = null;
  let fxAutoTimer = null;
  let fxAutoTickCount = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    initTabs();
    initDefaultDates();
    bindForms();
    bindTableActions();
    bindPackingActions();
    initItineraryDragSort();

    normalizePackingState();
    updateOtherTypeVisibility();

    renderItinerary();
    renderExpenses();
    renderPacking();

    await initCurrencies();
    bindFxLiveEvents();

    await convertCurrency();
    await loadFxTrend();

    startFxAutoRefresh();

    document.addEventListener("visibilitychange", async () => {
      if (!document.hidden) {
        await convertCurrency({ silent: true, auto: true });
      }
    });
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function uid(prefix = "id") {
    if (window.crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function daysAgoStr(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function nowTimeStr() {
    return new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function formatTWD(value) {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatCurrency(value, currency) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function initDefaultDates() {
    const t = todayStr();
    if ($("#iDate")) $("#iDate").value = t;
    if ($("#eDate")) $("#eDate").value = t;
    if ($("#fxEnd")) $("#fxEnd").value = t;
    if ($("#fxStart")) $("#fxStart").value = daysAgoStr(30);
  }

  function initTabs() {
    $$(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tabBtn;

        $$(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        $$(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
        const target = $(`#tab-${tab}`);
        if (target) target.classList.remove("hidden");
      });
    });
  }

  function bindForms() {
    $("#itineraryForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      addItinerary();
    });

    $("#expenseForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      addExpense();
    });

    $("#fxForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await convertCurrency();
    });

    $("#swapBtn")?.addEventListener("click", async () => {
      const from = $("#fxFromInput").value;
      const to = $("#fxToInput").value;
      $("#fxFromInput").value = to;
      $("#fxToInput").value = from;

      normalizeCurrencyInput($("#fxFromInput"));
      normalizeCurrencyInput($("#fxToInput"));

      await convertCurrency();
      await loadFxTrend();
    });

    $("#fxTrendForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await loadFxTrend();
    });

    $("#packingForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      generatePacking();
    });

    $("#addCustomPackingBtn")?.addEventListener("click", addCustomPacking);
    $("#clearPackingBtn")?.addEventListener("click", clearPackingChecks);

    $("#pType")?.addEventListener("change", updateOtherTypeVisibility);
  }

  function bindFxLiveEvents() {
    const onFxInput = debounce(async () => {
      await convertCurrency({ silent: true });
    }, 300);

    $("#fxAmount")?.addEventListener("input", onFxInput);
    $("#fxFromInput")?.addEventListener("input", onFxInput);
    $("#fxToInput")?.addEventListener("input", onFxInput);

    const onCurrencyChanged = debounce(async () => {
      normalizeCurrencyInput($("#fxFromInput"));
      normalizeCurrencyInput($("#fxToInput"));
      await convertCurrency({ silent: true });
      await loadFxTrend({ silent: true });
    }, 300);

    $("#fxFromInput")?.addEventListener("change", onCurrencyChanged);
    $("#fxToInput")?.addEventListener("change", onCurrencyChanged);

    $("#fxFromInput")?.addEventListener("blur", () => normalizeCurrencyInput($("#fxFromInput")));
    $("#fxToInput")?.addEventListener("blur", () => normalizeCurrencyInput($("#fxToInput")));
  }

  function startFxAutoRefresh() {
    stopFxAutoRefresh();

    fxAutoTickCount = 0;

    fxAutoTimer = setInterval(async () => {
      if (document.hidden) return;

      const from = parseCurrencyCode($("#fxFromInput")?.value);
      const to = parseCurrencyCode($("#fxToInput")?.value);
      if (!from || !to) return;

      fxAutoTickCount += 1;

      await convertCurrency({ silent: true, auto: true });

      if (fxAutoTickCount % FX_TREND_AUTO_EVERY === 0) {
        await loadFxTrend({ silent: true, auto: true });
      }
    }, FX_AUTO_REFRESH_MS);
  }

  function stopFxAutoRefresh() {
    if (fxAutoTimer) {
      clearInterval(fxAutoTimer);
      fxAutoTimer = null;
    }
  }

  function updateOtherTypeVisibility() {
    const typeEl = $("#pType");
    const field = $("#otherTypeField");
    if (!typeEl || !field) return;

    if (typeEl.value === "other") {
      field.classList.remove("hidden");
    } else {
      field.classList.add("hidden");
      if ($("#pOtherType")) $("#pOtherType").value = "";
    }
  }

  function bindTableActions() {
    $("#itineraryTbody")?.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest("button[data-delete-id]");
      const editBtn = e.target.closest("button[data-edit-id]");

      if (deleteBtn) {
        state.itinerary = state.itinerary.filter((x) => x.id !== deleteBtn.dataset.deleteId);
        save(KEYS.itinerary, state.itinerary);
        renderItinerary();
        return;
      }

      if (editBtn) {
        const target = state.itinerary.find((x) => x.id === editBtn.dataset.editId);
        if (!target) return;

        editingItineraryId = target.id;

        $("#iDate").value = target.date;
        $("#iTime").value = target.time;
        $("#iTitle").value = target.title;
        $("#iLocation").value = target.location;
        $("#iTransport").value = target.transport;
        $("#iNote").value = target.note;

        const submitBtn = $("#itineraryForm button[type='submit']");
        if (submitBtn) submitBtn.textContent = "更新行程";
      }
    });

    $("#expenseTbody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-id]");
      if (!btn) return;

      state.expenses = state.expenses.filter((x) => x.id !== btn.dataset.deleteId);
      save(KEYS.expenses, state.expenses);
      renderExpenses();
    });
  }

  // ========= 行程 =========
  function addItinerary() {
    const date = $("#iDate").value;
    const time = $("#iTime").value;
    const title = $("#iTitle").value.trim();
    const location = $("#iLocation").value.trim();
    const transport = $("#iTransport").value.trim();
    const note = $("#iNote").value.trim();

    if (!date || !time || !title) return;

    if (editingItineraryId) {
      const target = state.itinerary.find((x) => x.id === editingItineraryId);
      if (target) {
        target.date = date;
        target.time = time;
        target.title = title;
        target.location = location;
        target.transport = transport;
        target.note = note;
      }
      editingItineraryId = null;
      const submitBtn = $("#itineraryForm button[type='submit']");
      if (submitBtn) submitBtn.textContent = "新增行程";
    } else {
      state.itinerary.push({
        id: uid("it"),
        date,
        time,
        title,
        location,
        transport,
        note
      });
    }

    save(KEYS.itinerary, state.itinerary);
    renderItinerary();

    $("#itineraryForm").reset();
    $("#iDate").value = todayStr();
  }

  function getDateGroups(itineraryRows) {
    const allDates = [...new Set(itineraryRows.map((x) => x.date).filter(Boolean))].sort();
    return allDates.map((date) => ({
      date,
      items: itineraryRows.filter((x) => x.date === date)
    }));
  }

  function renderItinerary() {
    const tbody = $("#itineraryTbody");
    const rows = [...state.itinerary];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">目前還沒有行程，先新增第一筆。</td></tr>`;
      return;
    }

    const groups = getDateGroups(rows);
    const html = [];

    groups.forEach((group, idx) => {
      html.push(`
        <tr class="day-group-row">
          <td colspan="8">Day ${idx + 1}｜${escapeHTML(group.date)}</td>
        </tr>
      `);

      group.items.forEach((r) => {
        html.push(`
          <tr data-id="${r.id}" data-date="${r.date}" draggable="true">
            <td class="drag-cell" title="拖曳排序"><span class="drag-handle">☰</span></td>
            <td>${escapeHTML(r.date)}</td>
            <td>${escapeHTML(r.time)}</td>
            <td>${escapeHTML(r.title)}</td>
            <td>${escapeHTML(r.location || "-")}</td>
            <td>${escapeHTML(r.transport || "-")}</td>
            <td>${escapeHTML(r.note || "-")}</td>
            <td>
              <button class="secondary-btn" data-edit-id="${r.id}">編輯</button>
              <button class="action-btn" data-delete-id="${r.id}">刪除</button>
            </td>
          </tr>
        `);
      });
    });

    tbody.innerHTML = html.join("");
  }

  function initItineraryDragSort() {
    const tbody = $("#itineraryTbody");
    if (!tbody) return;

    let draggingRow = null;
    let draggingDate = null;

    tbody.addEventListener("dragstart", (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;

      if (!e.target.closest(".drag-handle")) {
        e.preventDefault();
        return;
      }

      draggingRow = row;
      draggingDate = row.dataset.date || "";
      row.classList.add("dragging");

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.id || "");
      }
    });

    tbody.addEventListener("dragover", (e) => {
      if (!draggingRow) return;
      e.preventDefault();

      const target = e.target.closest("tr[data-id]");
      if (!target || target === draggingRow) return;

      // 只允許同一天內拖曳排序，避免 Day 分組被打亂
      if ((target.dataset.date || "") !== draggingDate) return;

      const rect = target.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > rect.height / 2;

      tbody.insertBefore(draggingRow, isAfter ? target.nextSibling : target);
    });

    const finalize = () => {
      if (!draggingRow) return;
      draggingRow.classList.remove("dragging");
      draggingRow = null;
      draggingDate = null;
      persistItineraryOrderFromDOM();
    };

    tbody.addEventListener("drop", (e) => {
      e.preventDefault();
      finalize();
    });

    tbody.addEventListener("dragend", finalize);
  }

  function persistItineraryOrderFromDOM() {
    const rows = [...$("#itineraryTbody").querySelectorAll("tr[data-id]")];
    if (!rows.length) return;

    const orderIds = rows.map((tr) => tr.dataset.id);
    const map = new Map(state.itinerary.map((item) => [item.id, item]));

    state.itinerary = orderIds.map((id) => map.get(id)).filter(Boolean);
    save(KEYS.itinerary, state.itinerary);
    renderItinerary();
  }

  // ========= 記帳 =========
  function addExpense() {
    const amount = Number($("#eAmount").value);
    if (!Number.isFinite(amount) || amount < 0) return;

    const item = {
      id: uid("ex"),
      date: $("#eDate").value,
      name: $("#eItem").value.trim(),
      category: $("#eCategory").value,
      amount
    };

    if (!item.date || !item.name) return;

    state.expenses.push(item);
    save(KEYS.expenses, state.expenses);
    renderExpenses();

    $("#expenseForm").reset();
    $("#eDate").value = todayStr();
  }

  function renderExpenses() {
    const tbody = $("#expenseTbody");
    const rows = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">目前還沒有花費資料。</td></tr>`;
    } else {
      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td>${escapeHTML(r.date)}</td>
          <td>${escapeHTML(r.name)}</td>
          <td>${escapeHTML(r.category)}</td>
          <td>${formatTWD(r.amount)}</td>
          <td><button class="action-btn" data-delete-id="${r.id}">刪除</button></td>
        </tr>
      `).join("");
    }

    const total = state.expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const t = todayStr();
    const today = state.expenses
      .filter((x) => x.date === t)
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const dayMap = {};
    state.expenses.forEach((x) => {
      dayMap[x.date] = (dayMap[x.date] || 0) + Number(x.amount || 0);
    });

    const days = Object.keys(dayMap).length || 1;
    const avg = total / days;

    $("#mTotal").textContent = formatTWD(total);
    $("#mToday").textContent = formatTWD(today);
    $("#mAvg").textContent = formatTWD(avg);

    renderExpenseCharts();
  }

  function renderExpenseCharts() {
    const catMap = {};
    const dayMap = {};

    state.expenses.forEach((x) => {
      const amt = Number(x.amount || 0);
      catMap[x.category] = (catMap[x.category] || 0) + amt;
      dayMap[x.date] = (dayMap[x.date] || 0) + amt;
    });

    const catLabels = Object.keys(catMap);
    const catData = Object.values(catMap);
    const dayLabels = Object.keys(dayMap).sort();
    const dayData = dayLabels.map((d) => dayMap[d]);

    if (charts.category) charts.category.destroy();
    if (charts.daily) charts.daily.destroy();

    charts.category = new Chart($("#categoryChart"), {
      type: "doughnut",
      data: {
        labels: catLabels.length ? catLabels : ["無資料"],
        datasets: [{ data: catData.length ? catData : [1] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });

    charts.daily = new Chart($("#dailyChart"), {
      type: "line",
      data: {
        labels: dayLabels.length ? dayLabels : ["無資料"],
        datasets: [{
          label: "每日花費 (TWD)",
          data: dayData.length ? dayData : [0],
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // ========= 匯率 =========
  function orderCurrenciesWithPriority(symbols) {
    const clean = [...new Set(
      (symbols || [])
        .map((s) => String(s || "").toUpperCase().trim())
        .filter((v) => /^[A-Z]{3}$/.test(v))
    )];

    if (!clean.includes("TWD")) clean.push("TWD");

    const top = PRIORITY_CURRENCIES.filter((c) => clean.includes(c));
    const rest = clean.filter((c) => !PRIORITY_CURRENCIES.includes(c)).sort();

    return [...top, ...rest];
  }

  function getCurrencyZhName(code) {
    const upper = String(code || "").toUpperCase();
    if (CURRENCY_ZH_MAP[upper]) return CURRENCY_ZH_MAP[upper];

    try {
      if (Intl.DisplayNames) {
        const zh = new Intl.DisplayNames(["zh-Hant"], { type: "currency" });
        const name = zh.of(upper);
        if (name && name !== upper) return name;
      }
    } catch {}

    return upper;
  }

  function currencyLabel(code) {
    const upper = String(code || "").toUpperCase();
    return `${getCurrencyZhName(upper)}(${upper})`;
  }

  function parseCurrencyCode(inputText) {
    const raw = String(inputText || "").trim().toUpperCase();

    // 直接輸入代碼，例如 TWD
    if (/^[A-Z]{3}$/.test(raw)) return raw;

    // 輸入形式 中文(CODE)
    const m = raw.match(/\(([A-Z]{3})\)/);
    if (m) return m[1];

    return "";
  }

  function normalizeCurrencyInput(inputEl) {
    if (!inputEl) return "";
    const code = parseCurrencyCode(inputEl.value);
    if (code && state.currencies.includes(code)) {
      inputEl.value = currencyLabel(code);
      return code;
    }
    return "";
  }

  async function initCurrencies() {
    try {
      const res = await fetch(`${FX_API.latest}/currencies.json`);
      if (!res.ok) throw new Error("currency fetch failed");

      const data = await res.json();
      const symbols = Object.keys(data).map((x) => x.toUpperCase());

      state.currencies = orderCurrenciesWithPriority(symbols);
    } catch {
      state.currencies = orderCurrenciesWithPriority([
        "TWD", "USD", "EUR", "JPY", "GBP", "CNY", "KRW",
        "AUD", "CAD", "CHF", "HKD", "SGD", "NZD", "THB",
        "MYR", "PHP", "IDR", "INR", "SEK", "NOK", "DKK"
      ]);
    }

    const list = $("#currencyList");
    if (list) {
      list.innerHTML = state.currencies.map((code) => {
        return `<option value="${escapeHTML(currencyLabel(code))}"></option>`;
      }).join("");
    }

    const fromInput = $("#fxFromInput");
    const toInput = $("#fxToInput");

    if (fromInput && !parseCurrencyCode(fromInput.value)) fromInput.value = currencyLabel("TWD");
    if (toInput && !parseCurrencyCode(toInput.value)) toInput.value = currencyLabel("EUR");
  }

  async function convertCurrency(opts = {}) {
    const { silent = false, auto = false } = opts;

    const amount = Number($("#fxAmount")?.value);
    const from = parseCurrencyCode($("#fxFromInput")?.value);
    const to = parseCurrencyCode($("#fxToInput")?.value);

    if (!Number.isFinite(amount) || amount < 0) {
      if (!silent) {
        $("#fxResult").textContent = "請輸入正確金額";
        $("#fxMeta").textContent = "";
      }
      return;
    }

    if (!from || !to) {
      if (!silent) {
        $("#fxResult").textContent = "請選擇正確幣別";
        $("#fxMeta").textContent = "";
      }
      return;
    }

    // 正規化顯示
    $("#fxFromInput").value = currencyLabel(from);
    $("#fxToInput").value = currencyLabel(to);

    if (from === to) {
      $("#fxResult").textContent = `${formatCurrency(amount, from)} = ${formatCurrency(amount, to)}`;
      $("#fxMeta").textContent =
        `1 ${from} = 1 ${to}｜自動更新：每 60 秒｜上次同步：${nowTimeStr()}`;
      return;
    }

    try {
      const url = `${FX_API.latest}/${from.toLowerCase()}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fx fetch failed");

      const data = await res.json();
      const rate = data?.[from.toLowerCase()]?.[to.toLowerCase()];
      if (!rate) throw new Error("rate missing");

      const converted = amount * Number(rate);

      $("#fxResult").textContent =
        `${formatCurrency(amount, from)} = ${formatCurrency(converted, to)}`;

      const dateText = data.date || todayStr();
      const autoText = auto ? "（自動更新）" : "（手動更新）";

      $("#fxMeta").textContent =
        `更新日期：${dateText}｜1 ${from} = ${Number(rate).toFixed(6)} ${to}｜自動更新：每 60 秒｜上次同步：${nowTimeStr()} ${autoText}`;
    } catch {
      if (!silent) {
        $("#fxResult").textContent = "匯率取得失敗，請稍後再試";
        $("#fxMeta").textContent = "";
      }
    }
  }

  async function loadFxTrend(opts = {}) {
    const { silent = false } = opts;

    const from = parseCurrencyCode($("#fxFromInput")?.value);
    const to = parseCurrencyCode($("#fxToInput")?.value);
    const start = $("#fxStart")?.value;
    const end = $("#fxEnd")?.value;

    if (!from || !to || !start || !end) return;
    if (start > end) return;

    const labels = [];
    const values = [];

    try {
      if (from === to) {
        labels.push(start, end);
        values.push(1, 1);
      } else {
        // 每 2 天抓 1 筆，兼顧速度和可讀性
        const startDate = new Date(start);
        const endDate = new Date(end);
        const stepDays = 2;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + stepDays)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;

          const url = `${FX_API.date(dateStr)}/${from.toLowerCase()}.json`;
          const res = await fetch(url);
          if (!res.ok) continue;

          const data = await res.json();
          const rate = data?.[from.toLowerCase()]?.[to.toLowerCase()];
          if (!rate) continue;

          labels.push(dateStr);
          values.push(Number(rate));
        }
      }

      if (!labels.length) throw new Error("no trend data");

      if (charts.fx) charts.fx.destroy();
      charts.fx = new Chart($("#fxChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: `${getCurrencyZhName(from)}(${from}) → ${getCurrencyZhName(to)}(${to})`,
            data: values,
            tension: 0.25
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } }
        }
      });
    } catch {
      if (silent) return;

      if (charts.fx) charts.fx.destroy();
      charts.fx = new Chart($("#fxChart"), {
        type: "line",
        data: {
          labels: ["無資料"],
          datasets: [{ label: "匯率趨勢", data: [0] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }

  // ========= 行李 =========
  function normalizePackingState() {
    state.packing = (state.packing || []).map((x) => ({
      id: x.id || uid("pk"),
      text: x.text || "",
      checked: Boolean(x.checked),
      kind: x.kind || "item",
      qty: Math.max(1, Number(x.qty || 1))
    }));
    save(KEYS.packing, state.packing);
  }

  function generatePacking() {
    const type = $("#pType").value;
    const climate = $("#pClimate").value;
    const days = Math.max(1, Number($("#pDays").value || 1));
    const otherText = ($("#pOtherType")?.value || "").trim();

    const list = [];

    if (type === "domestic") {
      list.push({ id: uid("pk"), kind: "section", text: "國內旅遊行李清單" });

      [
        "錢包", "手機", "充電器", "行動電源", "耳機",
        "牙刷牙膏", "洗髮精", "沐浴乳", "毛巾", "衛生紙",
        "濕紙巾", "雨傘", "防曬乳", "防蚊液", "拖鞋", "睡衣"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));

      list.push({ id: uid("pk"), kind: "section", text: "衣物建議" });
      const outfit = Math.max(2, Math.ceil(days / 2));

      [
        `外出衣物 x ${outfit} 套`,
        `內衣褲 x ${days} 套`,
        `襪子 x ${days} 雙`,
        "薄外套"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));
    }

    if (type === "international") {
      list.push({ id: uid("pk"), kind: "section", text: "託運行李" });

      [
        "外出衣物", "內衣褲", "襪子", "薄外套", "鞋子", "拖鞋",
        "帽子", "墨鏡", "雨傘", "衛生紙", "濕紙巾", "衛生棉",
        "化妝品", "防曬乳", "防蚊液", "牙膏", "牙刷", "沐浴乳",
        "洗髮精", "卸妝用品", "梳子", "乳液", "毛巾", "浴巾"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));

      list.push({ id: uid("pk"), kind: "section", text: "手提行李" });

      [
        "護照正本", "護照影本", "身分證正本", "身分證影本", "簽證文件",
        "機票", "登機證", "SIM卡", "SIM卡針", "信用卡", "當地貨幣",
        "原子筆", "手機", "充電線", "行動電源", "耳機", "平板", "相機",
        "隨身藥品", "眼罩", "頸枕", "耳塞"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));

      list.push({ id: uid("pk"), kind: "section", text: "出發前提醒" });

      [
        "行動電源與備用鋰電池不可拖運，必須放手提或隨身行李。",
        "手提液體每瓶需 ≤ 100ml，且須放入 1 公升可重複密封透明袋。",
        "刀具與帶刃物品需托運。",
        "打火機通常以一支為限，仍請以航空公司與目的地規定為準。"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "note", text: x, checked: false, qty: 1 }));
    }

    if (type === "business") {
      list.push({ id: uid("pk"), kind: "section", text: "商務出差行李清單" });

      [
        "筆電", "筆電充電器", "手機", "行動電源", "轉接頭",
        "耳機", "名片", "文件資料", "正式服裝", "皮鞋", "盥洗用品", "藥品"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));
    }

    if (type === "other") {
      list.push({
        id: uid("pk"),
        kind: "section",
        text: `其他旅遊清單${otherText ? "：" + otherText : ""}`
      });

      [
        "手機", "錢包", "充電器", "行動電源",
        "牙刷牙膏", "毛巾", "衛生紙", "雨傘"
      ].forEach((x) => list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 }));
    }

    if (climate === "cold") {
      list.push({ id: uid("pk"), kind: "section", text: "寒冷氣候補充" });
      ["羽絨外套", "手套", "毛帽", "發熱衣"].forEach((x) =>
        list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 })
      );
    }

    if (climate === "hot") {
      list.push({ id: uid("pk"), kind: "section", text: "炎熱氣候補充" });
      ["防曬乳", "透氣衣物", "太陽眼鏡"].forEach((x) =>
        list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 })
      );
    }

    if (climate === "rainy") {
      list.push({ id: uid("pk"), kind: "section", text: "多雨氣候補充" });
      ["雨傘", "防水外套", "防水鞋套"].forEach((x) =>
        list.push({ id: uid("pk"), kind: "item", text: x, checked: false, qty: 1 })
      );
    }

    state.packing = list;
    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function addCustomPacking() {
    const input = $("#customPackingInput");
    const text = input.value.trim();
    if (!text) return;

    state.packing.push({
      id: uid("pk"),
      kind: "item",
      text,
      checked: false,
      qty: 1
    });

    save(KEYS.packing, state.packing);
    renderPacking();
    input.value = "";
  }

  function clearPackingChecks() {
    state.packing = state.packing.map((x) => ({
      ...x,
      checked: x.kind === "item" ? false : x.checked
    }));
    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function bindPackingActions() {
    $("#packingList")?.addEventListener("change", (e) => {
      if (e.target.matches("input[type='checkbox'][data-check-id]")) {
        const id = e.target.dataset.checkId;
        const item = state.packing.find((x) => x.id === id);

        if (item && item.kind === "item") {
          item.checked = e.target.checked;
          save(KEYS.packing, state.packing);
          renderPacking();
        }
      }
    });

    $("#packingList")?.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("button[data-remove-id]");
      if (removeBtn) {
        state.packing = state.packing.filter((x) => x.id !== removeBtn.dataset.removeId);
        save(KEYS.packing, state.packing);
        renderPacking();
        return;
      }

      const minusBtn = e.target.closest("button[data-qty-minus]");
      if (minusBtn) {
        const id = minusBtn.dataset.qtyMinus;
        const item = state.packing.find((x) => x.id === id);
        if (!item || item.kind !== "item") return;

        item.qty = Math.max(1, Number(item.qty || 1) - 1);
        save(KEYS.packing, state.packing);
        renderPacking();
        return;
      }

      const plusBtn = e.target.closest("button[data-qty-plus]");
      if (plusBtn) {
        const id = plusBtn.dataset.qtyPlus;
        const item = state.packing.find((x) => x.id === id);
        if (!item || item.kind !== "item") return;

        item.qty = Math.min(99, Number(item.qty || 1) + 1);
        save(KEYS.packing, state.packing);
        renderPacking();
      }
    });
  }

  function renderPacking() {
    const ul = $("#packingList");

    if (!state.packing.length) {
      ul.innerHTML = `<li><span class="muted">尚未生成清單，先選條件後按「生成清單」。</span></li>`;
      return;
    }

    ul.innerHTML = state.packing.map((item) => {
      if (item.kind === "section") {
        return `<li><strong>${escapeHTML(item.text)}</strong></li>`;
      }

      if (item.kind === "note") {
        return `<li><span class="muted">⚠ ${escapeHTML(item.text)}</span></li>`;
      }

      const qty = Math.max(1, Number(item.qty || 1));

      return `
        <li>
          <input type="checkbox" data-check-id="${item.id}" ${item.checked ? "checked" : ""} />
          <span class="${item.checked ? "done" : ""}">${escapeHTML(item.text)}</span>

          <div class="qty-box">
            <button class="qty-btn" data-qty-minus="${item.id}">-</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" data-qty-plus="${item.id}">+</button>
          </div>

          <button class="action-btn" data-remove-id="${item.id}">刪除</button>
        </li>
      `;
    }).join("");
  }

  function escapeHTML(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
