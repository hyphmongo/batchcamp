import "../styles.css";

import { setupCollectionPage } from "./pages/collection";
import { setupPurchasesPage } from "./pages/purchases";
import { addShiftKeyListener } from "./shiftKeyListener";
import { store } from "./store";

document.addEventListener("DOMContentLoaded", () => {
  addShiftKeyListener(store);
  setupCollectionPage();
  setupPurchasesPage();
});
