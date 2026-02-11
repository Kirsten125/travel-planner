(() => {
  const FX_API = "https://api.frankfurter.dev/v1";

  const KEYS = {
    itinerary: "travel_itinerary_v2",
    expenses: "travel_expenses_v2",
    packing: "travel_packing_v2"
  };

  const state = {
    itinerary: load(KEYS.itinerary, []),
    expenses: load(KEYS.expenses, []),
    packing: load(KEYS.packing, []),
    currencies: ["TWD", "EUR", "USD", "JPY", "GBP", "KRW", "CNY"]
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

    renderItinerary();
    renderExpenses();
    renderPacking();

    initCurrencies().then(() => {
      convertCurrency();
      loadFxTrend();
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
    $("#iDate").value = t;
    $("#eDate").value = t;
    $("#fxEnd").value = t;
    $("#fxStart").value = daysAgoStr(30);
  }

  function initTabs() {
    $$(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tabBtn;
        $$(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        $$(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
        $(`#tab-${tab}`).classList.remove("hidden");
      });
    });
  }

  function bindForms() {
    $("#itineraryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      addItinerary();
    });

    $("#expenseForm").addEventListener("submit", (e) => {
      e.preventDefault();
      addExpense();
    });

    $("#fxForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await convertCurrency();
    });

    $("#swapBtn").addEventListener("click", async () => {
      const from = $("#fxFrom").value;
      const to = $("#fxTo").value;
      $("#fxFrom").value = to;
      $("#fxTo").value = from;
      await convertCurrency();
      await loadFxTrend();
    });

    $("#fxTrendForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await loadFxTrend();
    });

    $("#packingForm").addEventListener("submit", (e) => {
      e.preventDefault();
      generatePacking();
    });

    $("#addCustomPackingBtn").addEventListener("click", addCustomPacking);
    $("#clearPackingBtn").addEventListener("click", clearPackingChecks);
  }

  function bindTableActions() {
    $("#itineraryTbody").addEventListener("click", (e) => {
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

        $("#itineraryForm button[type='submit']").textContent = "更新行程";
      }
    });

    $("#expenseTbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-id]");
      if (!btn) return;

      state.expenses = state.expenses.filter((x) => x.id !== btn.dataset.deleteId);
      save(KEYS.expenses, state.expenses);
      renderExpenses();
    });
  }

  function bindPackingActions() {
    $("#packingList").addEventListener("change", (e) => {
      if (e.target.matches("input[type='checkbox'][data-check-id]")) {
        const id = e.target.dataset.checkId;
        const item = state.packing.find((x) => x.id === id);
        if (item) {
          item.checked = e.target.checked;
          save(KEYS.packing, state.packing);
          renderPacking();
        }
      }
    });

    $("#packingList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-remove-id]");
      if (!btn) return;

      state.packing = state.packing.filter((x) => x.id !== btn.dataset.removeId);
      save(KEYS.packing, state.packing);
      renderPacking();
    });
  }

  // ============ 行程 ============
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
      $("#itineraryForm button[type='submit']").textContent = "新增行程";
    } else {
      const item = {
        id: uid("it"),
        date,
        time,
        title,
        location,
        transport,
        note
      };

      state.itinerary.push(item);
    }

    save(KEYS.itinerary, state.itinerary);
    renderItinerary();

    $("#itineraryForm").reset();
    $("#iDate").value = todayStr();
  }

  function renderItinerary() {
    const tbody = $("#itineraryTbody");
    const rows = [...state.itinerary];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">目前還沒有行程，先新增第一筆。</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr data-id="${r.id}" draggable="true">
        <td class="drag-cell" title="拖曳排序">
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

  // ============ 行程拖曳排序 ============
  function initItineraryDragSort() {
    const tbody = $("#itineraryTbody");
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
    const rows = [...$("#itineraryTbody").querySelectorAll("tr[data-id]")];
    if (!rows.length) return;

    const orderIds = rows.map((tr) => tr.dataset.id);
    const map = new Map(state.itinerary.map((item) => [item.id, item]));

    state.itinerary = orderIds.map((id) => map.get(id)).filter(Boolean);
    save(KEYS.itinerary, state.itinerary);
    renderItinerary();
  }

  // ============ 記帳 ============
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

    const c1 = $("#categoryChart");
    const c2 = $("#dailyChart");

    charts.category = new Chart(c1, {
      type: "doughnut",
      data: {
        labels: catLabels.length ? catLabels : ["無資料"],
        datasets: [{
          data: catData.length ? catData : [1]
        }]
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
    try {
      const res = await fetch(`${FX_API}/currencies`);
      if (!res.ok) throw new Error("currency fetch failed");
      const data = await res.json();
      state.currencies = Object.keys(data).sort();
    } catch {
      // fallback
    }

    fillCurrencySelect($("#fxFrom"), state.currencies);
    fillCurrencySelect($("#fxTo"), state.currencies);

    if (state.currencies.includes("TWD")) $("#fxFrom").value = "TWD";
    if (state.currencies.includes("EUR")) $("#fxTo").value = "EUR";
  }

  function fillCurrencySelect(selectEl, symbols) {
    selectEl.innerHTML = symbols
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");
  }

  async function convertCurrency() {
    const amount = Number($("#fxAmount").value);
    const from = $("#fxFrom").value;
    const to = $("#fxTo").value;

    if (!Number.isFinite(amount) || amount < 0) {
      $("#fxResult").textContent = "請輸入正確金額";
      return;
    }

    if (from === to) {
      $("#fxResult").textContent = `${formatCurrency(amount, from)} = ${formatCurrency(amount, to)}`;
      $("#fxMeta").textContent = `1 ${from} = 1 ${to}`;
      return;
    }

    try {
      const url = `${FX_API}/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fx latest failed");
      const data = await res.json();

      const rate = data?.rates?.[to];
      if (!rate) throw new Error("rate missing");

      const converted = amount * rate;
      $("#fxResult").textContent = `${formatCurrency(amount, from)} = ${formatCurrency(converted, to)}`;
      $("#fxMeta").textContent = `匯率日期：${data.date}｜1 ${from} = ${rate.toFixed(6)} ${to}`;
    } catch {
      $("#fxResult").textContent = "匯率取得失敗，請稍後再試";
      $("#fxMeta").textContent = "";
    }
  }

  async function loadFxTrend() {
    const from = $("#fxFrom").value;
    const to = $("#fxTo").value;
    const start = $("#fxStart").value;
    const end = $("#fxEnd").value;

    if (!start || !end || start > end) return;

    try {
      let labels = [];
      let values = [];

      if (from === to) {
        labels = [start, end];
        values = [1, 1];
      } else {
        const url = `${FX_API}/${start}..${end}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("fx trend failed");
        const data = await res.json();

        const rates = data?.rates || {};
        labels = Object.keys(rates).sort();
        values = labels.map((d) => rates[d][to]).filter((v) => Number.isFinite(v));
      }

      if (!labels.length) {
        labels = ["無資料"];
        values = [0];
      }

      if (charts.fx) charts.fx.destroy();

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
          scales: { y: { beginAtZero: false } },
          plugins: { legend: { position: "bottom" } }
        }
      });
    } catch {
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

  // ============ 行李 ============
  function generatePacking() {
    const type = $("#pType").value;
    const climate = $("#pClimate").value;
    const days = Math.max(1, Number($("#pDays").value || 1));
    const laundry = Math.max(1, Number($("#pLaundry").value || 3));

    const tops = Math.max(3, Math.ceil(days / laundry));
    const pants = Math.max(2, Math.ceil(tops / 2));

    let items = [
      "護照",
      "簽證/居留文件",
      "錢包與信用卡",
      "手機",
      "充電器",
      "轉接頭",
      "牙刷牙膏",
      "個人藥品"
    ];

    if (type === "city") {
      items.push("舒適步行鞋", "小型側背包", "行程票券截圖");
    } else if (type === "nature") {
      items.push("防滑鞋", "保溫水壺", "輕量雨衣", "行動電源");
    } else if (type === "business") {
      items.push("正式服裝", "筆電", "履歷/文件", "名片");
    }

    if (climate === "cold") {
      items.push("羽絨外套", "毛帽", "手套", "發熱衣");
    } else if (climate === "hot") {
      items.push("防曬乳", "太陽眼鏡", "透氣衣物");
    } else if (climate === "rainy") {
      items.push("雨傘", "防水外套", "防水鞋套");
    }

    items.push(`上衣 x ${tops}`, `褲子 x ${pants}`, `襪子 x ${tops}`);

    if (days >= 7) {
      items.push("洗衣袋", "旅行洗衣精");
    }

    items = [...new Set(items)];

    state.packing = items.map((text, i) => ({
      id: uid(`pk${i}`),
      text,
      checked: false
    }));

    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function addCustomPacking() {
    const input = $("#customPackingInput");
    const text = input.value.trim();
    if (!text) return;

    state.packing.push({
      id: uid("pk"),
      text,
      checked: false
    });

    save(KEYS.packing, state.packing);
    renderPacking();
    input.value = "";
  }

  function clearPackingChecks() {
    state.packing = state.packing.map((x) => ({ ...x, checked: false }));
    save(KEYS.packing, state.packing);
    renderPacking();
  }

  function renderPacking() {
    const ul = $("#packingList");

    if (!state.packing.length) {
      ul.innerHTML = `<li><span class="muted">尚未生成清單，先選條件後按「生成清單」。</span></li>`;
      return;
    }

    ul.innerHTML = state.packing.map((item) => `
      <li>
        <input type="checkbox" data-check-id="${item.id}" ${item.checked ? "checked" : ""} />
        <span class="${item.checked ? "done" : ""}">${escapeHTML(item.text)}</span>
        <button class="remove-item" data-remove-id="${item.id}">刪除</button>
      </li>
    `).join("");
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
