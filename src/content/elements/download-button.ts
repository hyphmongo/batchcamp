import browser from "webextension-polyfill";
import type { StoreApi } from "zustand/vanilla";
import { createChevron } from "@/content/shared/dropdown";
import {
  createLoadingToggle,
  createRunGuard,
  type LoadingToggle,
} from "@/content/shared/loading";
import type { ContentState } from "@/content/store";
import { captureError } from "@/shared/error-handler";
import { configurationStore } from "@/storage";
import { FORMAT_LABELS, type Format } from "@/types";
import { applyMovablePosition } from "./movable-button";

type DownloadButtonElement = HTMLElement & {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
  setLabel: (text: string) => void;
};

const sendItems = async (
  store: StoreApi<ContentState>,
  overrideFormat?: Format,
) => {
  const { selected, resetSelected } = store.getState();
  const config = await configurationStore.get();
  const format = overrideFormat ?? config.format;
  const items = Object.values(selected)
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((item) => ({ ...item, format }));
  try {
    await browser.runtime.sendMessage({
      type: "send-items-to-background",
      items,
    });
    resetSelected();
  } catch (error) {
    captureError(
      error,
      { items: { count: items.length } },
      { operation: "send_items_to_background" },
    );
  }
};

export const createDownloadButton = (
  store: StoreApi<ContentState>,
): DownloadButtonElement => {
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "bc-download-wrapper bc-hidden";

  const mainButton = document.createElement("button");
  mainButton.type = "button";
  mainButton.className = "bc-btn bc-split-btn-main";

  const dropdown = document.createElement("div");
  dropdown.className = "bc-dropdown";

  const trigger = document.createElement("div");
  trigger.tabIndex = 0;
  trigger.role = "button";
  trigger.setAttribute("aria-label", "Choose download format");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.className = "bc-btn bc-split-btn-trigger";
  trigger.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  };
  trigger.onmousedown = (e) => {
    if (document.activeElement === trigger) {
      e.preventDefault();
      trigger.blur();
    }
  };

  trigger.appendChild(createChevron());

  const menu = document.createElement("ul");
  menu.tabIndex = -1;
  menu.role = "menu";
  menu.setAttribute("aria-label", "Download format");
  menu.className = "bc-dropdown-content";

  const baseLoading = createLoadingToggle(mainButton);
  const loading: LoadingToggle = {
    start: () => {
      baseLoading.start();
      mainButton.disabled = true;
      trigger.remove();
    },
    stop: () => {
      baseLoading.stop();
      mainButton.disabled = false;
      dropdown.insertBefore(trigger, menu);
    },
  };
  const guard = createRunGuard(loading);

  mainButton.onclick = guard(() => sendItems(store));

  for (const [key, label] of Object.entries(FORMAT_LABELS)) {
    const li = document.createElement("li");
    li.role = "presentation";
    const a = document.createElement("a");
    a.role = "menuitem";
    a.tabIndex = 0;
    a.textContent = label;
    a.onclick = guard(async () => {
      (document.activeElement as HTMLElement)?.blur();
      await sendItems(store, key as Format);
    });
    a.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        a.click();
      }
    };
    li.appendChild(a);
    menu.appendChild(li);
  }

  dropdown.appendChild(trigger);
  dropdown.appendChild(menu);
  wrapperDiv.appendChild(mainButton);
  wrapperDiv.appendChild(dropdown);

  const unregister = applyMovablePosition(wrapperDiv);

  return Object.assign(wrapperDiv, {
    hide: () => wrapperDiv.classList.add("bc-hidden"),
    show: () => wrapperDiv.classList.remove("bc-hidden"),
    cleanup: () => unregister(),
    setLabel: (text: string) => {
      mainButton.textContent = text;
    },
  });
};
