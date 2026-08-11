import { indexOfCheckbox, SELECTION_SCOPE } from "@/content/elements/checkbox";
import { createChevron, wireDropdown } from "@/content/shared/dropdown";
import {
  createLoadingToggle,
  createRunGuard,
  type LoadingToggle,
} from "@/content/shared/loading";
import { trackFromContent } from "@/content/shared/track";
import { store } from "@/content/store";
import type { Item } from "@/types";
import { applyMovablePosition, createMovableButton } from "./movable-button";

const BATCH_TIMEOUT_MS = 8000;
const BATCH_SETTLE_MS = 250;

const getCheckboxes = () =>
  [...document.querySelectorAll(SELECTION_SCOPE)].flatMap((scope) => [
    ...scope.querySelectorAll<HTMLInputElement>(".bc-checkbox"),
  ]);

const waitForBatch = (
  element: HTMLElement,
  itemClass: string,
  signal: AbortSignal,
) =>
  new Promise<boolean>((resolve) => {
    const finish = (grew: boolean) => {
      clearTimeout(deadline);
      clearTimeout(settle);
      observer.disconnect();
      signal.removeEventListener("abort", onAbort);
      resolve(grew);
    };

    const onAbort = () => finish(false);
    let settle: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver((mutations) => {
      const grew = mutations.some((mutation) =>
        [...mutation.addedNodes].some(
          (node) =>
            node.nodeType === 1 &&
            (node as Element).classList?.contains(itemClass),
        ),
      );

      if (grew) {
        clearTimeout(settle);
        settle = setTimeout(() => finish(true), BATCH_SETTLE_MS);
      }
    });

    observer.observe(element, { childList: true, subtree: true });
    signal.addEventListener("abort", onAbort, { once: true });
    const deadline = setTimeout(() => finish(false), BATCH_TIMEOUT_MS);
  });

const createAnnouncer = () => {
  const region = document.createElement("span");
  region.role = "status";
  region.setAttribute("aria-live", "polite");
  region.className = "bc-visually-hidden";
  document.body.appendChild(region);

  return {
    element: region,
    say: (message: string) => {
      region.textContent = message;
    },
    cleanup: () => region.remove(),
  };
};

const loadTargetCount = async (
  target: number,
  element: HTMLElement,
  itemClass: string,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) => {
  const step = Math.max(1, Math.ceil(target / 10));
  let announced = 0;

  while (
    document.getElementsByClassName(itemClass).length < target &&
    !signal.aborted
  ) {
    element.scrollIntoView(false);

    if (!(await waitForBatch(element, itemClass, signal))) {
      return;
    }

    const loaded = document.getElementsByClassName(itemClass).length;

    if (loaded >= announced + step) {
      announced = loaded;
      onProgress(loaded);
    }
  }
};

const undownloadedOnly = (onlyUndownloaded?: boolean) =>
  onlyUndownloaded
    ? (input: HTMLInputElement) =>
        !input.classList.contains("bc-checkbox-downloaded")
    : () => true;

const tickCheckboxes = (
  collect: CollectItems,
  predicate: (input: HTMLInputElement) => boolean,
): number => {
  const { toggleShiftKey, selectMany, setLastClickedIndex } = store.getState();
  toggleShiftKey(false);

  const inputs = getCheckboxes().filter(
    (input) => !input.checked && predicate(input),
  );

  for (const input of inputs) {
    input.checked = true;
  }

  selectMany(collect(inputs));

  const last = inputs.at(-1);

  if (last) {
    setLastClickedIndex(indexOfCheckbox(last));
  }

  return inputs.length;
};

const selectedMessage = (count: number) =>
  count === 1 ? "Selected 1 release" : `Selected ${count} releases`;

type SelectAllElement = HTMLElement & {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
  abort: () => void;
};

type SelectItems = (onlyUndownloaded?: boolean) => Promise<void>;

export type CollectItems = (inputs: HTMLInputElement[]) => Item[];

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

const createSimpleSelectAll = (selectItems: SelectItems) => {
  let selectAll: () => Promise<void> = async () => {};
  const button = createMovableButton(
    "select-all",
    "bc-btn bc-select-all-btn",
    () => selectAll(),
  );

  button.textContent = "Select All";
  const guard = createRunGuard(createLoadingToggle(button));
  selectAll = guard(() => {
    trackFromContent("bc_select_all_clicked");
    return selectItems();
  });

  return button;
};

const createSplitSelectAll = (selectItems: SelectItems) => {
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
    if (e.key === "Enter" || e.key === " ") {
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
  const selectAll = guard(() => selectItems());
  const selectUndownloaded = guard(() => selectItems(true));

  mainButton.onclick = selectAll;
  menu.appendChild(createDropdownLink("All", () => void selectAll()));
  menu.appendChild(
    createDropdownLink("Undownloaded", () => void selectUndownloaded()),
  );

  dropdown.appendChild(dropdownTrigger);
  dropdown.appendChild(menu);
  wireDropdown({
    dropdown,
    trigger: dropdownTrigger,
    menu,
    returnFocusTo: mainButton,
  });

  wrapperDiv.appendChild(mainButton);
  wrapperDiv.appendChild(dropdown);

  const unregister = applyMovablePosition(wrapperDiv);

  return Object.assign(wrapperDiv, {
    hide: () => wrapperDiv.classList.add("bc-hidden"),
    show: () => wrapperDiv.classList.remove("bc-hidden"),
    cleanup: () => unregister(),
  });
};

const createSelectAllButtonFor = (
  selectItems: SelectItems,
  hasHistory: boolean,
  abort: () => void = () => {},
): SelectAllElement => {
  const button = hasHistory
    ? createSplitSelectAll(selectItems)
    : createSimpleSelectAll(selectItems);

  return Object.assign(button, { abort });
};

export const createSelectAllButton = (
  target: number,
  showMore: HTMLElement | null,
  container: HTMLElement,
  itemClass: string,
  hasHistory: boolean,
  collect: CollectItems,
): SelectAllElement => {
  let controller: AbortController | null = null;
  const announcer = createAnnouncer();

  const selectItems: SelectItems = async (onlyUndownloaded) => {
    controller = new AbortController();
    const { signal } = controller;

    if (target && container.matches(SELECTION_SCOPE)) {
      if (showMore) {
        showMore.click();
      }

      await loadTargetCount(target, container, itemClass, signal, (loaded) =>
        announcer.say(`Loaded ${loaded} of ${target}`),
      );
    }

    if (signal.aborted) {
      announcer.say("Selection stopped");
      return;
    }

    announcer.say(
      selectedMessage(
        tickCheckboxes(collect, undownloadedOnly(onlyUndownloaded)),
      ),
    );
  };

  const button = createSelectAllButtonFor(selectItems, hasHistory, () =>
    controller?.abort(),
  );

  const cleanup = button.cleanup;

  return Object.assign(button, {
    cleanup: () => {
      cleanup();
      announcer.cleanup();
    },
  });
};

export const createStaticSelectAllButton = (
  hasHistory: boolean,
  collect: CollectItems,
): SelectAllElement => {
  const announcer = createAnnouncer();

  const button = createSelectAllButtonFor(async (onlyUndownloaded) => {
    announcer.say(
      selectedMessage(
        tickCheckboxes(collect, undownloadedOnly(onlyUndownloaded)),
      ),
    );
  }, hasHistory);

  const cleanup = button.cleanup;

  return Object.assign(button, {
    cleanup: () => {
      cleanup();
      announcer.cleanup();
    },
  });
};
