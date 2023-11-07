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
  button.textContent = "Select All";

  button.onclick = async () => {
    const loadingClasses = ["loading", "loading-spinner"];

    button.classList.add(...loadingClasses);
    button.textContent = "";

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

      await wait(1000);

      const amount = getCheckboxes().length;

      if (amount === current) {
        failed++;
      }

      current = amount;
    }

    for (const checkbox of getCheckboxes()) {
      (checkbox as HTMLInputElement).click();
    }

    button.classList.remove(...loadingClasses);
    button.textContent = "Select All";
  };

  return button;
};
