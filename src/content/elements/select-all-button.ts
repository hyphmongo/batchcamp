const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getCheckboxes = () => document.querySelectorAll(".bc-checkbox");

const loadTargetCount = async (
  target: number,
  element: HTMLElement,
  itemClass: string
) => {
  let current = document.getElementsByClassName(itemClass).length;
  let failed = 0;

  while (current < target && failed < 5) {
    element.scrollIntoView(false);

    await wait(2500);

    const amount = document.getElementsByClassName(itemClass).length;

    if (amount === current) {
      failed++;
    } else {
      failed = 0;
      current = amount;
    }
  }

  return failed < 5;
};

export const createSelectAllButton = (
  target: number,
  showMore: HTMLElement,
  container: HTMLElement,
  itemClass: string
) => {
  const button = document.createElement("button");
  button.className = "btn btn-primary fixed bottom-4 right-4 z-[1000] w-32";
  button.setAttribute("id", "select-all");
  const loadingSpan = document.createElement("span");
  button.textContent = "Select All";

  const loadingClasses = ["loading", "loading-spinner"];

  const startLoading = () => {
    button.textContent = "";
    button.appendChild(loadingSpan);
    loadingSpan.classList.add(...loadingClasses);
  };

  const stopLoading = () => {
    loadingSpan.classList.remove(...loadingClasses);
    button.textContent = "Select All";
  };

  button.onclick = async () => {
    startLoading();

    if (!target) {
      return;
    }

    if (showMore) {
      showMore.click();
    }

    const loadedAll = await loadTargetCount(target, container, itemClass);

    if (loadedAll) {
      for (const checkbox of getCheckboxes()) {
        (checkbox as HTMLInputElement).click();
      }
    }

    stopLoading();
  };

  return button;
};
