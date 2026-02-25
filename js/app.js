(() => {

  /* =========================
     工具區
  ========================== */

  const FX_API = {
    latest: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
    date: (d) =>
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies`
  };

  const FX_AUTO_REFRESH_MS = 60 * 1000;

  const CURRENCY_ZH_MAP = {
    TWD:"新臺幣",
    USD:"美元",
    EUR:"歐元",
    JPY:"日圓",
    CNY:"人民幣",
    KRW:"韓元",
    GBP:"英鎊",
    HKD:"港幣",
    AUD:"澳幣",
    CAD:"加幣",
    CHF:"瑞士法郎",
    SGD:"新幣",
    NZD:"紐幣",
    THB:"泰銖",
    MYR:"馬幣",
    PHP:"菲律賓披索",
    IDR:"印尼盾",
    INR:"印度盧比",
    SEK:"瑞典克朗",
    NOK:"挪威克朗",
    DKK:"丹麥克朗",
    PLN:"波蘭茲羅提",
    CZK:"捷克克朗",
    HUF:"匈牙利福林",
    RON:"羅馬尼亞列伊",
    TRY:"土耳其里拉",
    ZAR:"南非蘭特",
    ILS:"以色列謝克爾",
    ISK:"冰島克朗",
    MXN:"墨西哥披索",
    BRL:"巴西里拉",
    AED:"阿聯酋迪拉姆",
    SAR:"沙烏地里亞爾"
  };

  const KEYS = {
    itinerary: "travel_itinerary_v6",
    collapsed: "travel_day_collapsed_v2",
    expenses: "travel_expenses_v6",
    packing: "travel_packing_v6"
  };

  const state = {
    itinerary: load(KEYS.itinerary, []),
    collapsed: load(KEYS.collapsed, {}),
    expenses: load(KEYS.expenses, []),
    packing: load(KEYS.packing, []),
    currencies: []
  };

  let charts = { category:null, daily:null, fx:null };
  let fxTimer = null;

  document.addEventListener("DOMContentLoaded", init);

  function $(s){ return document.querySelector(s); }
  function $$(s){ return document.querySelectorAll(s); }

  function load(k,f){
    try{ return JSON.parse(localStorage.getItem(k)) ?? f }
    catch{ return f }
  }
  function save(k,v){ localStorage.setItem(k,JSON.stringify(v)) }

  function uid(){
    return crypto.randomUUID ? crypto.randomUUID() :
      Date.now()+"_"+Math.random().toString(16).slice(2);
  }

  function today(){
    const d=new Date();
    return d.toISOString().slice(0,10);
  }

  function formatTWD(n){
    return new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD"}).format(n);
  }

  function formatCurrency(n,c){
    return new Intl.NumberFormat("en",{style:"currency",currency:c}).format(n);
  }

  function currencyLabel(code){
    const zh=CURRENCY_ZH_MAP[code]||code;
    return `${zh}(${code})`;
  }

  function parseCode(str){
    const m=str?.match(/\(([A-Z]{3})\)/);
    if(m) return m[1];
    if(/^[A-Z]{3}$/.test(str)) return str;
    return "";
  }

  /* =========================
     初始化
  ========================== */

  async function init(){
    initTabs();
    initForms();
    initDrag();
    renderItinerary();
    renderExpenses();
    renderPacking();
    await initCurrencies();
    await convert();
    startAutoFX();
  }

  function initTabs(){
    $$(".tab-btn").forEach(btn=>{
      btn.onclick=()=>{
        $$(".tab-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        $$(".tab-panel").forEach(p=>p.classList.add("hidden"));
        $("#tab-"+btn.dataset.tabBtn).classList.remove("hidden");
      }
    })
  }

  /* =========================
     行程
  ========================== */

  function initForms(){
    $("#itineraryForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      state.itinerary.push({
        id:uid(),
        date:$("#iDate").value,
        time:$("#iTime").value,
        title:$("#iTitle").value,
        location:$("#iLocation").value,
        transport:$("#iTransport").value,
        note:$("#iNote").value
      });
      save(KEYS.itinerary,state.itinerary);
      renderItinerary();
      e.target.reset();
      $("#iDate").value=today();
    });

    $("#expenseForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      state.expenses.push({
        id:uid(),
        date:$("#eDate").value,
        name:$("#eItem").value,
        category:$("#eCategory").value,
        amount:Number($("#eAmount").value)
      });
      save(KEYS.expenses,state.expenses);
      renderExpenses();
      e.target.reset();
      $("#eDate").value=today();
    });

    $("#fxForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      convert();
    });

    $("#swapBtn")?.addEventListener("click",()=>{
      const a=$("#fxFromInput").value;
      const b=$("#fxToInput").value;
      $("#fxFromInput").value=b;
      $("#fxToInput").value=a;
      convert();
    });

    $("#packingForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      generatePacking();
    });

    $("#addCustomPackingBtn")?.onclick=addPacking;
    $("#clearPackingBtn")?.onclick=()=>{
      state.packing.forEach(x=>x.checked=false);
      save(KEYS.packing,state.packing);
      renderPacking();
    };
  }

  function renderItinerary(){
    const tb=$("#itineraryTbody");
    if(!state.itinerary.length){
      tb.innerHTML="<tr><td colspan='8'>尚無行程</td></tr>";
      return;
    }

    const map={};
    state.itinerary.forEach(x=>{
      if(!map[x.date]) map[x.date]=[];
      map[x.date].push(x);
    });

    let html="";
    let dayIndex=1;

    Object.keys(map).forEach(date=>{
      const collapsed=state.collapsed[date];
      html+=`
        <tr class="day-group-row">
          <td colspan="8">
            <button data-date="${date}" class="toggleBtn">
              ${collapsed?"▸":"▾"}
            </button>
            Day ${dayIndex}｜${date}
          </td>
        </tr>
      `;

      if(!collapsed){
        map[date].forEach(r=>{
          html+=`
          <tr draggable="true" data-id="${r.id}" data-date="${date}">
            <td class="drag-cell"><span class="drag-handle">☰</span></td>
            <td>${r.date}</td>
            <td>${r.time}</td>
            <td>${r.title}</td>
            <td>${r.location||"-"}</td>
            <td>${r.transport||"-"}</td>
            <td>${r.note||"-"}</td>
            <td><button data-del="${r.id}">刪除</button></td>
          </tr>`;
        });
      }

      dayIndex++;
    });

    tb.innerHTML=html;

    $$(".toggleBtn").forEach(btn=>{
      btn.onclick=()=>{
        const d=btn.dataset.date;
        state.collapsed[d]=!state.collapsed[d];
        save(KEYS.collapsed,state.collapsed);
        renderItinerary();
      }
    });

    $$("[data-del]").forEach(btn=>{
      btn.onclick=()=>{
        state.itinerary=state.itinerary.filter(x=>x.id!==btn.dataset.del);
        save(KEYS.itinerary,state.itinerary);
        renderItinerary();
      }
    });
  }

  function initDrag(){
    const tb=$("#itineraryTbody");
    let drag=null;

    tb.addEventListener("dragstart",e=>{
      drag=e.target.closest("tr[data-id]");
      drag.classList.add("dragging");
    });

    tb.addEventListener("dragover",e=>{
      e.preventDefault();
      const target=e.target.closest("tr[data-id]");
      if(!target||!drag) return;
      if(target.dataset.date!==drag.dataset.date) return;
      tb.insertBefore(drag,target);
    });

    tb.addEventListener("dragend",()=>{
      drag?.classList.remove("dragging");
      drag=null;
      saveOrder();
    });
  }

  function saveOrder(){
    const rows=[...$("#itineraryTbody").querySelectorAll("tr[data-id]")];
    const ids=rows.map(r=>r.dataset.id);
    state.itinerary=ids.map(id=>state.itinerary.find(x=>x.id===id));
    save(KEYS.itinerary,state.itinerary);
  }

  /* =========================
     記帳
  ========================== */

  function renderExpenses(){
    const tb=$("#expenseTbody");
    if(!state.expenses.length){
      tb.innerHTML="<tr><td colspan='5'>尚無花費</td></tr>";
      return;
    }

    tb.innerHTML=state.expenses.map(x=>`
      <tr>
        <td>${x.date}</td>
        <td>${x.name}</td>
        <td>${x.category}</td>
        <td>${formatTWD(x.amount)}</td>
        <td><button data-del="${x.id}">刪除</button></td>
      </tr>
    `).join("");

    const total=state.expenses.reduce((a,b)=>a+b.amount,0);
    $("#mTotal").textContent=formatTWD(total);
  }

  /* =========================
     匯率
  ========================== */

  async function initCurrencies(){
    try{
      const res=await fetch(FX_API.latest+"/currencies.json");
      const data=await res.json();
      state.currencies=Object.keys(data).map(x=>x.toUpperCase());
    }catch{
      state.currencies=["TWD","USD","EUR","JPY"];
    }

    const list=$("#currencyList");
    list.innerHTML="";
    state.currencies.forEach(code=>{
      const opt=document.createElement("option");
      opt.value=currencyLabel(code);
      list.appendChild(opt);
    });

    $("#fxFromInput").value=currencyLabel("TWD");
    $("#fxToInput").value=currencyLabel("EUR");
  }

  async function convert(){
    const amount=Number($("#fxAmount").value);
    const from=parseCode($("#fxFromInput").value);
    const to=parseCode($("#fxToInput").value);
    if(!from||!to) return;

    if(from===to){
      $("#fxResult").textContent=formatCurrency(amount,to);
      return;
    }

    const res=await fetch(`${FX_API.latest}/${from.toLowerCase()}.json`);
    const data=await res.json();
    const rate=data[from.toLowerCase()][to.toLowerCase()];
    const result=amount*rate;

    $("#fxResult").textContent=
      `${formatCurrency(amount,from)} = ${formatCurrency(result,to)}`;

    $("#fxMeta").textContent=
      `1 ${from} = ${rate.toFixed(6)} ${to}`;
  }

  function startAutoFX(){
    clearInterval(fxTimer);
    fxTimer=setInterval(convert,FX_AUTO_REFRESH_MS);
  }

  /* =========================
     行李
  ========================== */

  function generatePacking(){
    state.packing=[
      {id:uid(),text:"手機",checked:false},
      {id:uid(),text:"錢包",checked:false},
      {id:uid(),text:"充電器",checked:false}
    ];
    save(KEYS.packing,state.packing);
    renderPacking();
  }

  function addPacking(){
    const text=$("#customPackingInput").value.trim();
    if(!text) return;
    state.packing.push({id:uid(),text,checked:false});
    save(KEYS.packing,state.packing);
    renderPacking();
    $("#customPackingInput").value="";
  }

  function renderPacking(){
    const ul=$("#packingList");
    if(!state.packing.length){
      ul.innerHTML="<li>尚未生成清單</li>";
      return;
    }

    ul.innerHTML=state.packing.map(x=>`
      <li>
        <input type="checkbox" ${x.checked?"checked":""}/>
        <span>${x.text}</span>
      </li>
    `).join("");
  }

})();