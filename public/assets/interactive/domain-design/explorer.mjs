const scenario = document.querySelector("#scenario");
const step = document.querySelector("#step");
const status = document.querySelector("#label");
try {
  const response = await fetch("./scenarios.json");
  if (!response.ok) throw new Error("trace unavailable");
  const data = await response.json();
  function render() {
    const selected = data.scenarios.find((item) => item.id === scenario.value);
    const frame = selected.frames[Number(step.value)];
    status.textContent = `${Number(step.value) + 1} de ${selected.frames.length}: ${frame.label}`;
    document.querySelector("#revision").textContent = frame.revision;
    document.querySelector("#reserved").textContent = new Intl.NumberFormat(
      "es-ES",
      {
        style: "currency",
        currency: data.currency,
      },
    ).format(frame.reservedMinor / 100);
    document.querySelector("#events").textContent = frame.events;
  }
  step.addEventListener("input", render);
  scenario.addEventListener("change", () => {
    step.value = "0";
    render();
  });
  render();
} catch {
  status.textContent =
    "No se pudo cargar la traza. Recarga la página para volver a intentarlo.";
  step.disabled = true;
  scenario.disabled = true;
}
