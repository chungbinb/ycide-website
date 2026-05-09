const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const yearEl = document.getElementById("year");

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const revealNodes = document.querySelectorAll(".reveal-up");
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-show");
        observer.unobserve(entry.target);
      }
    }
  },
  {
    threshold: 0.16
  }
);

for (const node of revealNodes) {
  observer.observe(node);
}

const themeCompare = document.getElementById("themeCompare");

if (themeCompare) {
  const setSplit = (clientX) => {
    const rect = themeCompare.getBoundingClientRect();
    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const split = (offsetX / rect.width) * 100;
    themeCompare.style.setProperty("--split", `${split}%`);
  };

  themeCompare.addEventListener("mousemove", (event) => {
    setSplit(event.clientX);
  });

  themeCompare.addEventListener("touchmove", (event) => {
    if (!event.touches[0]) {
      return;
    }
    setSplit(event.touches[0].clientX);
  }, { passive: true });
}
