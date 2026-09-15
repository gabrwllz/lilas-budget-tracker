import { $ } from "./utils.js";

export function showModal(content, { dismissOnBackdrop = true } = {}) {
  $("#modal").innerHTML = content;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  $("#modal .close-button")?.addEventListener("click", closeModal);
  $("#modalBackdrop").onclick = (event) => {
    if (dismissOnBackdrop && event.target === $("#modalBackdrop")) closeModal();
  };
}

export function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

export function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => element.classList.remove("show"), 2400);
}
