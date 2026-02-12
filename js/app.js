(() => {
  // ====== 放在檔案前面常數區（和 FX_API、FX_FALLBACK 同一區）======
  const PRIORITY_CURRENCIES = ["TWD", "USD", "EUR", "JPY", "CNY", "KRW", "GBP", "HKD"];

  // 常用幣別中英名稱保底（確保這些一定是中英）
  const CURRENCY_NAME_MAP = {
    TWD: { zh: "新臺幣", en: "New Taiwan Dollar" },
    USD: { zh: "美元", en: "US Dollar" },
    EUR: { zh: "歐元", en: "Euro" },
    JPY: { zh: "日圓", en: "Japanese Yen" },
    CNY: { zh: "人民幣", en: "Chinese Yuan" },
    KRW: { zh: "韓元", en: "South Korean Won" },
    GBP: { zh: "英鎊", en: "British Pound" },
    HKD: { zh: "港幣", en: "Hong Kong Dollar" },
    AUD: { zh: "澳幣", en: "Australian Dollar" },
    CAD: { zh: "加幣", en: "Canadian Dollar" },
    CHF: { zh: "瑞士法郎", en: "Swiss Franc" },
    SGD: { zh: "新幣", en: "Singapore Dollar" },
    NZD: { zh: "紐幣", en: "New Zealand Dollar" }
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

  // ============ 匯率 ============
  function fillCurrencySelect(selectEl, symbols) {
    if (!selectEl) return;

    const ordered = orderCurrenciesWithPriority(symbols);
    const top = PRIORITY_CURRENCIES.filter((c) => ordered.includes(c));
    const rest = ordered.filter((c) => !PRIORITY_CURRENCIES.includes(c));

    const renderOption = (code) => {
      const label = currencyLabel(code);
      return `<option value="${code}">${escapeHTML(label)}</option>`;
    };

    let html = "";
    if (top.length) {
      html += `<optgroup label="常用幣別">${top.map(renderOption).join("")}</optgroup>`;
    }
    if (rest.length) {
      html += `<optgroup label="其他幣別">${rest.map(renderOption).join("")}</optgroup>`;
    }

    selectEl.innerHTML = html;
  }

  // ====== 取代原本 currencyLabel() ======
  function currencyLabel(code) {
    const upper = String(code || "").toUpperCase();

    // 先走手動保底（常用幣別一定是中英）
    if (CURRENCY_NAME_MAP[upper]) {
      const { zh, en } = CURRENCY_NAME_MAP[upper];
      return `${zh} (${upper})`;
    }

    // 再走 Intl（大多數瀏覽器可提供全部 ISO 幣別中英文）
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

    // 強制中英一起顯示（若其中一個拿不到，先用另一個補上）
    if (!zhName && enName) zhName = enName;
    if (!enName && zhName) enName = zhName;
    if (!zhName && !enName) {
      zhName = upper;
      enName = upper;
    }

    return `${zhName} (${upper})`;
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
})();
