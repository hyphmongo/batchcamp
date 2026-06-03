import { createChevron } from "@/content/shared/dropdown";
import {
  createLoadingToggle,
  createRunGuard,
  type LoadingToggle,
} from "@/content/shared/loading";
import { store } from "@/content/store";
import { applyMovablePosition, createMovableButton } from "./movable-button";

const SCROLL_WAIT_MS = 2500;
const MAX_SCROLL_RETRIES = 5;

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getCheckboxes = () => document.querySelectorAll(".bc-checkbox");

const loadTargetCount = async (
  target: number,
  element: HTMLElement,
  itemClass: string,
) => {
  let current = document.getElementsByClassName(itemClass).length;
  let failed = 0;

  while (current < target && failed < MAX_SCROLL_RETRIES) {
    element.scrollIntoView(false);

    await wait(SCROLL_WAIT_MS);

    const amount = document.getElementsByClassName(itemClass).length;

    if (amount === current) {
      failed++;
    } else {
      failed = 0;
      current = amount;
    }
  }
};

const clickCheckboxes = (
  predicate: (input: HTMLInputElement) => boolean = () => true,
) => {
  store.getState().toggleShiftKey(false);
  for (const checkbox of getCheckboxes()) {
    const input = checkbox as HTMLInputElement;
    if (!input.checked && predicate(input)) {
      input.click();
    }
  }
};

type SelectAllElement = HTMLElement & {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
};

const createDropdownLink = (label: string, onSelect: () => void) => {
  const option = document.createElement("li");
  const link = document.createElement("a");
  link.textContent = label;
  link.role = "menuitem";
  link.tabIndex = 0;
  link.onclick = () => {
    (document.activeElement as HTMLElement)?.blur();
    onSelect();
  };
  link.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      link.click();
    }
  };
  option.appendChild(link);
  return option;
};

const createSimpleSelectAll = (
  loadAllItems: () => Promise<void>,
): SelectAllElement => {
  let selectAll: () => Promise<void> = async () => {};
  const button = createMovableButton(
    "select-all",
    "bc-btn bc-select-all-btn",
    () => selectAll(),
  ) as SelectAllElement;

  button.textContent = "Select All";
  const guard = createRunGuard(createLoadingToggle(button));
  selectAll = guard(async () => {
    await loadAllItems();
    clickCheckboxes();
  });

  return button;
};

const createSplitSelectAll = (
  loadAllItems: () => Promise<void>,
): SelectAllElement => {
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "bc-select-all-wrapper";

  const mainButton = document.createElement("button");
  mainButton.type = "button";
  mainButton.className = "bc-btn bc-split-btn-main";
  mainButton.textContent = "Select All";

  const dropdownTrigger = document.createElement("div");
  dropdownTrigger.tabIndex = 0;
  dropdownTrigger.role = "button";
  dropdownTrigger.setAttribute("aria-label", "Select all options");
  dropdownTrigger.setAttribute("aria-haspopup", "true");
  dropdownTrigger.className = "bc-btn bc-split-btn-trigger";
  dropdownTrigger.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  };
  dropdownTrigger.appendChild(createChevron());

  const menu = document.createElement("ul");
  menu.tabIndex = -1;
  menu.role = "menu";
  menu.className = "bc-dropdown-content";

  const dropdown = document.createElement("div");
  dropdown.className = "bc-dropdown";

  const baseLoading = createLoadingToggle(mainButton);
  const loading: LoadingToggle = {
    start: () => {
      baseLoading.start();
      mainButton.disabled = true;
      dropdownTrigger.remove();
    },
    stop: () => {
      baseLoading.stop();
      mainButton.disabled = false;
      dropdown.insertBefore(dropdownTrigger, menu);
    },
  };

  const guard = createRunGuard(loading);
  const selectAll = guard(async () => {
    await loadAllItems();
    clickCheckboxes();
  });
  const selectUndownloaded = guard(async () => {
    await loadAllItems();
    clickCheckboxes(
      (input) => !input.classList.contains("bc-checkbox-downloaded"),
    );
  });

  mainButton.onclick = selectAll;
  menu.appendChild(createDropdownLink("All", () => void selectAll()));
  menu.appendChild(
    createDropdownLink("Undownloaded", () => void selectUndownloaded()),
  );

  dropdown.appendChild(dropdownTrigger);
  dropdown.appendChild(menu);

  wrapperDiv.appendChild(mainButton);
  wrapperDiv.appendChild(dropdown);

  const unregister = applyMovablePosition(wrapperDiv);

  return Object.assign(wrapperDiv, {
    hide: () => wrapperDiv.classList.add("bc-hidden"),
    show: () => wrapperDiv.classList.remove("bc-hidden"),
    cleanup: () => unregister(),
  });
};

export const createSelectAllButton = (
  target: number,
  showMore: HTMLElement | null,
  container: HTMLElement,
  itemClass: string,
  hasHistory: boolean,
): SelectAllElement => {
  const loadAllItems = async () => {
    if (!target) {
      return;
    }

    if (showMore) {
      showMore.click();
    }

    await loadTargetCount(target, container, itemClass);
  };

  return hasHistory
    ? createSplitSelectAll(loadAllItems)
    : createSimpleSelectAll(loadAllItems);
};
