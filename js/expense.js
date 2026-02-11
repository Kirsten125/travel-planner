let expenseData = JSON.parse(localStorage.getItem("expenseData")) || [];

function saveExpense() {
  localStorage.setItem("expenseData", JSON.stringify(expenseData));
}

function renderExpense() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  let total = 0;

  expenseData.forEach((item, index) => {
    total += Number(item.amount);

    const li = document.createElement("li");
    li.innerHTML = `${item.name} (${item.category}) - ${item.amount}
      <button onclick="deleteExpense(${index})">刪除</button>`;
    list.appendChild(li);
  });

  document.getElementById("totalExpense").innerText = `總花費：${total}`;
}

function addExpense() {
  const name = document.getElementById("expenseName").value;
  const category = document.getElementById("expenseCategory").value;
  const amount = document.getElementById("expenseAmount").value;

  expenseData.push({ name, category, amount });
  saveExpense();
  renderExpense();
}

function deleteExpense(index) {
  expenseData.splice(index, 1);
  saveExpense();
  renderExpense();
}

renderExpense();
