const hint = document.getElementById("hint");
const hintOpen = document.getElementById("hint-open");
const hintClose = document.getElementById("hint-close");

if (hint && hintOpen && hintClose) {
  const openHint = () => {
    hint.classList.add("show");
    hint.setAttribute("aria-hidden", "false");
    hintOpen.setAttribute("aria-expanded", "true");
    hintClose.focus();
  };

  const closeHint = () => {
    hint.classList.remove("show");
    hint.setAttribute("aria-hidden", "true");
    hintOpen.setAttribute("aria-expanded", "false");
    hintOpen.focus();
  };

  hintOpen.addEventListener("click", openHint);
  hintClose.addEventListener("click", closeHint);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hint.classList.contains("show")) {
      closeHint();
    }
  });

  document.addEventListener("click", (e) => {
    if (hint.classList.contains("show")) {
      const isClickInside =
        hint.contains(e.target) || hintOpen.contains(e.target);
      if (!isClickInside) closeHint();
    }
  });
}
