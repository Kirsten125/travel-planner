(() => {

const FX_API = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

const state = {
  itinerary: [],
  packing: []
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  initTabs();
  initCurrencies();
  bindForms();
  renderPacking();
}

function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }

/* Tabs */
function initTabs(){
  $$(".tab-btn").forEach(btn=>{
    btn.onclick=()=>{
      $$(".tab-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      $$(".tab-panel").forEach(p=>p.classList.add("hidden"));
      $("#tab-"+btn.dataset.tabBtn).classList.remove("hidden");
    }
  });
}

/* 行程 */
function bindForms(){
  $("#itineraryForm").addEventListener("submit",e=>{
    e.preventDefault();
    addItinerary();
  });

  $("#fxForm").addEventListener("submit",e=>{
    e.preventDefault();
    convertCurrency();
  });

  $("#swapBtn").onclick=()=>{
    let a=$("#fxFrom").value;
    let b=$("#fxTo").value;
    $("#fxFrom").value=b;
    $("#fxTo").value=a;
    convertCurrency();
  };

  $("#generatePacking").onclick=generatePacking;
}

function addItinerary(){
  const item={
    id:Date.now(),
    date:$("#iDate").value,
    time:$("#iTime").value,
    title:$("#iTitle").value,
    location:$("#iLocation").value,
    transport:$("#iTransport").value,
    note:$("#iNote").value
  };
  state.itinerary.push(item);
  renderItinerary();
}

function renderItinerary(){
  const tbody=$("#itineraryTbody");
  tbody.innerHTML="";

  let groups={};
  state.itinerary.forEach(i=>{
    if(!groups[i.date]) groups[i.date]=[];
    groups[i.date].push(i);
  });

  let day=1;

  Object.keys(groups).forEach(date=>{
    let tr=document.createElement("tr");
    tr.className="day-group-row";
    tr.innerHTML=`<td colspan="8">Day ${day} - ${date}</td>`;
    tbody.appendChild(tr);

    groups[date].forEach(i=>{
      let row=document.createElement("tr");
      row.draggable=true;
      row.innerHTML=`
        <td class="drag-handle">☰</td>
        <td>${i.date}</td>
        <td>${i.time}</td>
        <td>${i.title}</td>
        <td>${i.location}</td>
        <td>${i.transport}</td>
        <td>${i.note}</td>
        <td>刪除</td>
      `;
      tbody.appendChild(row);
    });

    day++;
  });

  enableDragSort();
}

function enableDragSort(){
  let dragging=null;

  document.querySelectorAll("#itineraryTbody tr[draggable=true]").forEach(row=>{
    row.addEventListener("dragstart",()=>dragging=row);
    row.addEventListener("dragover",e=>{
      e.preventDefault();
      if(row!==dragging){
        row.parentNode.insertBefore(dragging,row);
      }
    });
  });
}

/* 匯率 */
async function initCurrencies(){
  const res=await fetch(FX_API+"/currencies.json");
  const data=await res.json();
  const symbols=Object.keys(data);

  const from=$("#fxFrom");
  const to=$("#fxTo");

  symbols.forEach(s=>{
    let opt=document.createElement("option");
    opt.value=s.toUpperCase();
    opt.textContent=s.toUpperCase();
    from.appendChild(opt.cloneNode(true));
    to.appendChild(opt);
  });

  from.value="EUR";
  to.value="TWD";
}

async function convertCurrency(){
  const amount=Number($("#fxAmount").value);
  const from=$("#fxFrom").value.toLowerCase();
  const to=$("#fxTo").value.toLowerCase();

  const res=await fetch(`${FX_API}/${from}.json`);
  const data=await res.json();
  const rate=data[from][to];

  const result=amount*rate;

  $("#fxResult").textContent=`${amount} = ${result.toFixed(2)} ${to.toUpperCase()}`;
  $("#fxMeta").textContent=`1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}`;
}

/* 行李 */
function generatePacking(){
  state.packing=["錢包","手機","充電器","牙刷"];
  renderPacking();
}

function renderPacking(){
  const ul=$("#packingList");
  ul.innerHTML="";
  state.packing.forEach(item=>{
    let li=document.createElement("li");
    li.textContent=item;
    ul.appendChild(li);
  });
}

})();
