document.addEventListener("click", e => {
  if (e.target.classList.contains("copy-email")) {
    navigator.clipboard.writeText(e.target.dataset.email);
  }
});
