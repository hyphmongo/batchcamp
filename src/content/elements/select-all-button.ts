const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getCheckboxes = () =>
  document.querySelectorAll("#collection-items .bc-checkbox");

export const createSelectAllButton = () => {
  const button = document.createElement("button");
  button.className = "btn btn-primary fixed bottom-4 right-4 z-[1000] w-32";
  button.setAttribute("id", "select-all");
  const loadingSpan = document.createElement("span");
  button.textContent = "Select All";

  button.onclick = async () => {
    const loadingClasses = ["loading", "loading-spinner"];

    button.textContent = "";
    button.appendChild(loadingSpan);
    loadingSpan.classList.add(...loadingClasses);

    const target = parseInt(
      document.querySelector("#grid-tabs>.active .count")?.textContent || "0"
    );

    if (!target) {
      return;
    }

    const showMore = document.querySelector(
      ".expand-container.show-button > button"
    ) as HTMLElement;

    if (showMore) {
      showMore.click();
    }

    let current = getCheckboxes().length;
    let failed = 0;

    while (current !== target && failed < 5) {
      document.getElementById("collection-grid")?.scrollIntoView(false);

      await wait(2500);

      const amount = getCheckboxes().length;

      if (amount === current) {
        failed++;
      } else {
        failed = 0;
        current = amount;
      }
    }

    if (failed < 5) {
      for (const checkbox of getCheckboxes()) {
        (checkbox as HTMLInputElement).click();
      }
    }

    loadingSpan.classList.remove(...loadingClasses);
    button.textContent = "Select All";
  };

  return button;
};
