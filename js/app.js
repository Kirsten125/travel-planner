(() => {
  // ====== 匯率 API ======
  // 主 API：fawazahmed0 currency-api（含 TWD + 支援歷史日期）
  const FX_API = {
    base: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api",
    latest: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1"
  };

  // 備援 API：open.er-api（含 TWD，只有最新匯率）
  const FX_FALLBACK = "https://open.er-api.com/v6/latest";

  let fxProvider = "fawaz"; // fawaz | erapi | local

  const KEYS = {
    itinerary: "travel_itinerary_v2",
    expenses: "travel_expenses_v2",
    packing: "travel_packing_v3"
  };

  const PACKING_TEMPLATE = {
    domestic: {
      base: [
        "身分證",
        "健保卡",
        "現金/信用卡",
        "手機",
        "充電器",
        "行動電源",
        "耳機",
        "雨傘",
        "衛生紙",
        "濕紙巾",
        "牙刷牙膏",
        "洗面乳",
        "個人藥品"
      ],
      clothing: [
        "外出衣物",
        "內衣褲",
        "襪子",
        "薄外套",
        "鞋子",
        "拖鞋"
      ]
    },

    international: {
      checked: [
        "外出衣物",
        "內衣褲",
        "襪子",
        "薄外套",
        "鞋子",
        "拖鞋",
        "雨傘",
        "衛生紙",
        "濕紙巾",
        "牙刷牙膏",
        "洗面乳",
        "個人藥品",
        "化妝品",
        "防曬乳",
        "防蚊液"
      ],
      carry: [
        "護照",
        "簽證/居留文件",
        "機票/登機證",
        "信用卡",
        "當地貨幣",
        "SIM卡",
        "SIM卡針",
        "手機",
        "充電器",
        "轉接頭",
        "行動電源",
        "耳機",
        "保險文件",
        "原子筆"
      ],
      notices: [
        "行動電源與備用鋰電池不可托運，必須放手提或隨身行李。",
        "手提液體每瓶需 ≤ 100ml，且須放入 1 公升可重複密封透明袋。",
        "刀具與帶刃物品需托運。",
        "打火機通常以一支為限，仍請以航空公司與目的地規定為準。"
      ]
    },

    business: {
      base: [
        "筆電",
        "筆電充電器",
        "公司文件/合約",
        "名片",
        "正式服裝",
        "皮鞋",
        "手機",
        "充電器",
        "行動電源",
        "耳機",
        "錢包/信用卡",
        "原子筆"
      ],
      clothing: [
        "正式服裝",
        "襯衫",
        "內衣褲",
        "襪子",
        "薄外套",
        "皮鞋"
      ]
    }
  };

  const state = {
    itinerary: load(KEYS.itinerary, []),
    expenses: load(KEYS.expenses, []),
    packing: load(KEYS.packing, []),
    currencies: ["TWD", "USD", "EUR", "JPY", "GBP", "KRW", "CNY"]
  };

  const charts = {
    category: null,
    daily: null,
    fx: null
  };

  let editingItineraryId = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
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

    initCurrencies().then(async () => {
      await convertCurrency();
      await loadFxTrend();
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
      const from = $("#fxFrom").value;
      const to = $("#fxTo").value;
      $("#fxFrom").value = to;
      $("#fxTo").value = from;
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

  function updateOtherTypeVisibility() {
    const typeEl = $("#pType");
    const field = $("#otherTypeField");
    if (!typeEl || !field) return;

    const type = typeEl.value;
    if (type === "other") {
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

  // ============ 行程 ============
  function addItinerary() {
    const date = $("#iDate")?.value || "";
    const time = $("#iTime")?.value || "";
    const title = ($("#iTitle")?.value || "").trim();
    const location = ($("#iLocation")?.value || "").trim();
    const transport = ($("#iTransport")?.value || "").trim();
    const note = ($("#iNote")?.value || "").trim();

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

    $("#itineraryForm")?.reset();
    if ($("#iDate")) $("#iDate").value = todayStr();
  }

  function renderItinerary() {
    const tbody = $("#itineraryTbody");
    if (!tbody) return;

    const rows = [...state.itinerary];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">目前還沒有行程，先新增第一筆。</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, idx) => `
      <tr data-id="${r.id}" draggable="true">
        <td class="drag-cell" title="拖曳排序">
          <strong>${idx + 1}</strong>
          <span class="drag-handle">☰</span>
        </td>
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
    `).join("");
  }

  function initItineraryDragSort() {
    const tbody = $("#itineraryTbody");
    if (!tbody) return;

    let draggingRow = null;

    tbody.addEventListener("dragstart", (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;

      if (!e.target.closest(".drag-handle")) {
        e.preventDefault();
        return;
      }

      draggingRow = row;
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

      const rect = target.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > rect.height / 2;

      tbody.insertBefore(draggingRow, isAfter ? target.nextSibling : target);
    });

    const finalize = () => {
      if (!draggingRow) return;
      draggingRow.classList.remove("dragging");
      draggingRow = null;
      persistItineraryOrderFromDOM();
    };

    tbody.addEventListener("drop", (e) => {
      e.preventDefault();
      finalize();
    });

    tbody.addEventListener("dragend", finalize);
  }

  function persistItineraryOrderFromDOM() {
    const tbody = $("#itineraryTbody");
    if (!tbody) return;

    const rows = [...tbody.querySelectorAll("tr[data-id]")];
    if (!rows.length) return;

    const orderIds = rows.map((tr) => tr.dataset.id);
    const map = new Map(state.itinerary.map((item) => [item.id, item]));

    state.itinerary = orderIds.map((id) => map.get(id)).filter(Boolean);
    save(KEYS.itinerary, state.itinerary);
    renderItinerary();
  }

  // ============ 記帳 ============
  function addExpense() {
    const amount = Number($("#eAmount")?.value);
    if (!Number.isFinite(amount) || amount < 0) return;

    const item = {
      id: uid("ex"),
      date: $("#eDate")?.value || "",
      name: ($("#eItem")?.value || "").trim(),
      category: $("#eCategory")?.value || "其他",
      amount
    };

    if (!item.date || !item.name) return;

    state.expenses.push(item);
    save(KEYS.expenses, state.expenses);
    renderExpenses();

    $("#expenseForm")?.reset();
    if ($("#eDate")) $("#eDate").value = todayStr();
  }

  function renderExpenses() {
    const tbody = $("#expenseTbody");
    if (!tbody) return;

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

    if ($("#mTotal")) $("#mTotal").textContent = formatTWD(total);
    if ($("#mToday")) $("#mToday").textContent = formatTWD(today);
    if ($("#mAvg")) $("#mAvg").textContent = formatTWD(avg);

    renderExpenseCharts();
  }

  function renderExpenseCharts() {
    const c1 = $("#categoryChart");
    const c2 = $("#dailyChart");
    if (!c1 || !c2 || typeof Chart === "undefined") return;

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

    charts.category = new Chart(c1, {
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

    charts.daily = new Chart(c2, {
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

  // ============ 匯率 ============
  async function initCurrencies() {
    let symbols = [];

    // 先嘗試主 API（要求：要有 TWD）
    try {
      const res = await fetch(`${FX_API.latest}/currencies.json`);
      if (!res.ok) throw new Error("fawaz currencies failed");

      const data = await res.json();
      symbols = Object.keys(data).map((s) => s.toUpperCase());

      if (!symbols.includes("TWD")) {
        throw new Error("fawaz no TWD");
      }

      fxProvider = "fawaz";
    } catch {
      // 主 API 失敗時改用備援 API
      try {
        const res = await fetch(`${FX_FALLBACK}/USD`);
        if (!res.ok) throw new Error("erapi currencies failed");

        const data = await res.json();
        symbols = Object.keys(data.rates || {}).map((s) => s.toUpperCase());
        if (!symbols.includes("USD")) symbols.push("USD");
        if (!symbols.includes("TWD")) throw new Error("erapi no TWD");

        fxProvider = "erapi";
      } catch {
        // 最後本地備援
        fxProvider = "local";
        symbols = [
          "TWD", "USD", "EUR", "JPY", "GBP", "KRW", "CNY",
          "AUD", "CAD", "CHF", "HKD", "SGD", "NZD", "SEK",
          "NOK", "DKK", "THB", "MYR", "PHP", "IDR", "INR",
          "MXN", "BRL", "TRY", "PLN", "CZK", "HUF", "RON",
          "ZAR", "ILS", "ISK"
        ];
      }
    }

    if (!symbols.includes("TWD")) symbols.push("TWD");

    state.currencies = [...new Set(symbols)].sort((a, b) => a.localeCompare(b));
    fillCurrencySelect($("#fxFrom"), state.currencies);
    fillCurrencySelect($("#fxTo"), state.currencies);

    if (state.currencies.includes("TWD")) $("#fxFrom").value = "TWD";
    if (state.currencies.includes("EUR")) $("#fxTo").value = "EUR";
    else if (state.currencies.includes("USD")) $("#fxTo").value = "USD";
  }

  function fillCurrencySelect(selectEl, symbols) {
    if (!selectEl) return;
    selectEl.innerHTML = symbols
      .map((code) => `<option value="${code}">${escapeHTML(currencyLabel(code))}</option>`)
      .join("");
  }

  function currencyLabel(code) {
    const upper = String(code || "").toUpperCase();

    // 明確使用「新臺幣」
    if (upper === "TWD") return "新臺幣 New Taiwan Dollar (TWD)";

    let zhName = "";
    let enName = "";

    try {
      if (Intl.DisplayNames) {
        const zh = new Intl.DisplayNames(["zh-Hant"], { type: "currency" });
        const en = new Intl.DisplayNames(["en"], { type: "currency" });
        zhName = zh.of(upper) || "";
        enName = en.of(upper) || "";
      }
    } catch {
      // ignore
    }

    // fallback（少數環境或未知代碼）
    if (!zhName && !enName) return `${upper}`;

    if (!zhName) return `${enName} (${upper})`;
    if (!enName) return `${zhName} (${upper})`;

    return `${zhName} ${enName} (${upper})`;
  }

  async function getLatestRate(from, to) {
    const f = String(from || "").toUpperCase();
    const t = String(to || "").toUpperCase();

    if (f === t) return { rate: 1, date: todayStr() };

    if (fxProvider === "fawaz") {
      const base = f.toLowerCase();
      const quote = t.toLowerCase();
      const res = await fetch(`${FX_API.latest}/currencies/${base}.json`);
      if (!res.ok) throw new Error("fawaz latest failed");
      const data = await res.json();
      const rate = data?.[base]?.[quote];
      if (!Number.isFinite(rate)) throw new Error("fawaz rate missing");
      return { rate, date: data.date || "" };
    }

    if (fxProvider === "erapi") {
      const res = await fetch(`${FX_FALLBACK}/${f}`);
      if (!res.ok) throw new Error("erapi latest failed");
      const data = await res.json();
      const rate = data?.rates?.[t];
      if (!Number.isFinite(rate)) throw new Error("erapi rate missing");
      return { rate, date: data.time_last_update_utc || "" };
    }

    throw new Error("no provider");
  }

  async function convertCurrency() {
    const amount = Number($("#fxAmount")?.value);
    const from = $("#fxFrom")?.value;
    const to = $("#fxTo")?.value;

    if (!Number.isFinite(amount) || amount < 0) {
      if ($("#fxResult")) $("#fxResult").textContent = "請輸入正確金額";
      if ($("#fxMeta")) $("#fxMeta").textContent = "";
      return;
    }

    if (!from || !to) {
      if ($("#fxResult")) $("#fxResult").textContent = "請先選擇幣別";
      if ($("#fxMeta")) $("#fxMeta").textContent = "";
      return;
    }

    try {
      const { rate, date } = await getLatestRate(from, to);
      const converted = amount * rate;

      if ($("#fxResult")) {
        $("#fxResult").textContent =
          `${formatCurrency(amount, from)} = ${formatCurrency(converted, to)}`;
      }

      const sourceText =
        fxProvider === "fawaz"
          ? "資料來源：currency-api（jsDelivr）"
          : fxProvider === "erapi"
            ? "資料來源：open.er-api"
            : "資料來源：本地備援";

      if ($("#fxMeta")) {
        $("#fxMeta").textContent =
          `1 ${from} = ${rate.toFixed(6)} ${to}｜${date ? `日期：${date}｜` : ""}${sourceText}`;
      }
    } catch {
      if ($("#fxResult")) $("#fxResult").textContent = "匯率取得失敗，請稍後再試";
      if ($("#fxMeta")) $("#fxMeta").textContent = "";
    }
  }

  function enumerateDates(start, end, maxPoints = 120) {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];

    const all = [];
    const d = new Date(s);
    while (d <= e) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      all.push(`${y}-${m}-${day}`);
      d.setDate(d.getDate() + 1);
    }

    if (all.length <= maxPoints) return all;

    const step = Math.ceil(all.length / maxPoints);
    const sampled = [];
    for (let i = 0; i < all.length; i += step) sampled.push(all[i]);
    if (sampled[sampled.length - 1] !== all[all.length - 1]) sampled.push(all[all.length - 1]);
    return sampled;
  }

  async function loadFxTrend() {
    const from = $("#fxFrom")?.value;
    const to = $("#fxTo")?.value;
    const start = $("#fxStart")?.value;
    const end = $("#fxEnd")?.value;

    if (!from || !to || !start || !end || start > end) return;
    if (!$("#fxChart") || typeof Chart === "undefined") return;

    if (charts.fx) charts.fx.destroy();

    try {
      let labels = [];
      let values = [];

      if (from === to) {
        labels = [start, end];
        values = [1, 1];
      } else if (fxProvider === "fawaz") {
        const dates = enumerateDates(start, end, 120);
        const base = from.toLowerCase();
        const quote = to.toLowerCase();

        for (const dt of dates) {
          try {
            const url = `${FX_API.base}@${dt}/v1/currencies/${base}.json`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const rate = data?.[base]?.[quote];
            if (Number.isFinite(rate)) {
              labels.push(dt);
              values.push(rate);
            }
          } catch {
            // 略過單日錯誤
          }
        }

        // 如果歷史抓不到，至少給最新一筆，避免空圖
        if (!labels.length) {
          const { rate } = await getLatestRate(from, to);
          labels = [start, end];
          values = [rate, rate];
        }
      } else {
        // 備援 API 沒有區間歷史，使用最新值畫水平線
        const { rate } = await getLatestRate(from, to);
        labels = [start, end];
        values = [rate, rate];

        if ($("#fxMeta")) {
          const old = $("#fxMeta").textContent || "";
          const append = "（目前 API 不提供區間歷史，趨勢圖以最新匯率顯示）";
          if (!old.includes("不提供區間歷史")) {
            $("#fxMeta").textContent = `${old} ${append}`.trim();
          }
        }
      }

      if (!labels.length) {
        labels = ["無資料"];
        values = [0];
      }

      charts.fx = new Chart($("#fxChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: `${from} → ${to} 匯率`,
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

  // ============ 行李 ============
  function normalizePackingState() {
    state.packing = (state.packing || []).map((x) => {
      const kind = x.kind || "item";
      return {
        id: x.id || uid("pk"),
        text: x.text || "",
        checked: Boolean(x.checked),
        kind,
        qty: kind === "item" ? Math.max(1, Number(x.qty || 1)) : 1
      };
    });
    save(KEYS.packing, state.packing);
  }

  function dedupeList(arr) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      if (!seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
    return out;
  }

  function getDefaultQty(text, days, laundry) {
    const autoClothes = Math.max(2, Math.ceil(days / laundry));
    const autoUnderwear = Math.max(days, autoClothes);

    if (text === "外出衣物") return autoClothes;
    if (text === "內衣褲") return autoUnderwear;
    if (text === "襪子") return autoUnderwear;

    if (text === "薄外套") return 1;
    if (text === "鞋子") return 1;
    if (text === "拖鞋") return 1;

    return 1;
  }

  function generatePacking() {
    const type = $("#pType")?.value || "domestic";
    const otherType = ($("#pOtherType")?.value || "").trim();
    const climate = $("#pClimate")?.value || "mild";
    const days = Math.max(1, Number($("#pDays")?.value || 1));
    const laundry = Math.max(1, Number($("#pLaundry")?.value || 3));

    const climateExtras = [];
    if (climate === "cold") climateExtras.push("羽絨外套", "毛帽", "手套", "發熱衣");
    if (climate === "hot") climateExtras.push("防曬乳", "太陽眼鏡", "透氣衣物");
    if (climate === "rainy") climateExtras.push("雨傘", "防水外套", "防水鞋套");

    const list = [];

    // 國外旅遊：分託運/手提 + 出發前提醒（只有此型態顯示）
    if (type === "international") {
      const checkedItems = dedupeList([...PACKING_TEMPLATE.international.checked, ...climateExtras]);
      const carryItems = dedupeList([...PACKING_TEMPLATE.international.carry]);

      if (otherType) {
        list.push({ id: uid("pk"), kind: "section", text: `【旅遊類型】${otherType}` });
      }

      list.push({ id: uid("pk"), kind: "section", text: "【託運行李】" });

      checkedItems.forEach((text) => {
        list.push({
          id: uid("pk"),
          kind: "item",
          text,
          checked: false,
          qty: getDefaultQty(text, days, laundry)
        });
      });

      list.push({ id: uid("pk"), kind: "section", text: "【手提行李】" });

      carryItems.forEach((text) => {
        list.push({
          id: uid("pk"),
          kind: "item",
          text,
          checked: false,
          qty: 1
        });
      });

      list.push({ id: uid("pk"), kind: "section", text: "【出發前提醒】" });

      PACKING_TEMPLATE.international.notices.forEach((text) => {
        list.push({
          id: uid("pk"),
          kind: "note",
          text: `⚠ ${text}`,
          checked: false
        });
      });

      state.packing = list;
      save(KEYS.packing, state.packing);
      renderPacking();
      return;
    }

    // 商務出差
    if (type === "business") {
      const items = dedupeList([
        ...(otherType ? [`旅遊類型：${otherType}`] : []),
        ...PACKING_TEMPLATE.business.base,
        ...PACKING_TEMPLATE.business.clothing,
        ...climateExtras
      ]);

      list.push({ id: uid("pk"), kind: "section", text: "【行李清單】" });

      items.forEach((text) => {
        list.push({
          id: uid("pk"),
          kind: "item",
          text,
          checked: false,
          qty: getDefaultQty(text, days, laundry)
        });
      });

      state.packing = list;
      save(KEYS.packing, state.packing);
      renderPacking();
      return;
    }

    // 國內旅遊 / 其他
    const base = PACKING_TEMPLATE.domestic.base;
    const clothing = PACKING_TEMPLATE.domestic.clothing;

    const items = dedupeList([
      ...(otherType ? [`旅遊類型：${otherType}`] : []),
      ...base,
      ...clothing,
      ...climateExtras
    ]);

    list.push({ id: uid("pk"), kind: "section", text: "【行李清單】" });

    items.forEach((text) => {
      list.push({
        id: uid("pk"),
        kind: "item",
        text,
        checked: false,
        qty: getDefaultQty(text, days, laundry)
      });
    });

    state.packing = list;
    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function addCustomPacking() {
    const input = $("#customPackingInput");
    if (!input) return;

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
      checked: x.kind === "item" ? false : Boolean(x.checked)
    }));

    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function renderPacking() {
    const ul = $("#packingList");
    if (!ul) return;

    if (!state.packing.length) {
      ul.innerHTML = `<li><span class="muted">尚未生成清單，先選條件後按「生成清單」。</span></li>`;
      return;
    }

    ul.innerHTML = state.packing.map((item) => {
      if (item.kind === "section") {
        return `
          <li class="section-row">
            <strong>${escapeHTML(item.text)}</strong>
          </li>
        `;
      }

      if (item.kind === "note") {
        return `
          <li class="note-row">
            <span>${escapeHTML(item.text)}</span>
          </li>
        `;
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

          <button class="remove-item" data-remove-id="${item.id}">刪除</button>
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
