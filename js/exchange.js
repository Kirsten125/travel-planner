function convert() {
  const twd = Number(document.getElementById("twd").value);
  const rate = Number(document.getElementById("rate").value);

  const result = twd * rate;

  document.getElementById("result").innerText = `結果：${result.toFixed(2)}`;
}
