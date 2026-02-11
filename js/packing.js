function generatePackingList() {
  const type = document.getElementById("tripType").value;
  const list = document.getElementById("packingList");
  list.innerHTML = "";

  let items = [];

  if (type === "normal") {
    items = ["護照", "錢包", "手機充電器", "衣服", "牙刷牙膏", "雨傘"];
  } 
  else if (type === "winter") {
    items = ["護照", "羽絨外套", "手套", "圍巾", "保暖衣", "暖暖包"];
  } 
  else if (type === "business") {
    items = ["護照", "履歷", "筆電", "轉接頭", "正式服裝", "工作鞋"];
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `<input type="checkbox"> ${item}`;
    list.appendChild(li);
  });
}
