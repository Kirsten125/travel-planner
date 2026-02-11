let itineraryData = JSON.parse(localStorage.getItem("itineraryData")) || [];

function saveItinerary() {
  localStorage.setItem("itineraryData", JSON.stringify(itineraryData));
}

function renderItinerary() {
  const list = document.getElementById("itineraryList");
  list.innerHTML = "";

  itineraryData.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `${item.day} | ${item.time} | ${item.place} | ${item.note}
      <button onclick="deleteItinerary(${index})">刪除</button>`;
    list.appendChild(li);
  });
}

function addItinerary() {
  const day = document.getElementById("tripDay").value;
  const time = document.getElementById("tripTime").value;
  const place = document.getElementById("tripPlace").value;
  const note = document.getElementById("tripNote").value;

  itineraryData.push({ day, time, place, note });
  saveItinerary();
  renderItinerary();
}

function deleteItinerary(index) {
  itineraryData.splice(index, 1);
  saveItinerary();
  renderItinerary();
}

renderItinerary();
