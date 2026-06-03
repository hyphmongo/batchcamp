import {
  createCheckbox,
  invalidateCheckboxCache,
} from "@/content/elements/checkbox";
import { store } from "@/content/store";

interface CheckboxInjectionConfig {
  idAttribute: string;
  requiredChildSelector: string;
  artContainerSelector: string;
}

export const COLLECTION_CHECKBOX: CheckboxInjectionConfig = {
  idAttribute: "data-tralbumid",
  requiredChildSelector: ".redownload-item",
  artContainerSelector: ".collection-item-art-container",
};

export const PURCHASE_CHECKBOX: CheckboxInjectionConfig = {
  idAttribute: "sale_item_id",
  requiredChildSelector: '[data-tid="links"]:not(.deleted-badge)',
  artContainerSelector: ".purchases-item-art-container",
};

export const injectCheckbox = (
  element: Element,
  config: CheckboxInjectionConfig,
  onChecked: (target: HTMLInputElement) => void,
): boolean => {
  if (!element.querySelector(config.requiredChildSelector)) {
    return false;
  }

  if (element.querySelector(".bc-checkbox")) {
    return false;
  }

  const id = element.getAttribute(config.idAttribute);
  if (!id) {
    return false;
  }

  const artContainer = element.querySelector(config.artContainerSelector);
  if (!artContainer) {
    return false;
  }

  (artContainer as HTMLElement).style.position = "relative";
  artContainer.appendChild(createCheckbox(id, store, onChecked));
  invalidateCheckboxCache();
  return true;
};
