const movableElements = new Set<HTMLElement>();
let sharedObserver: MutationObserver | null = null;

const updateAllPositions = () => {
  const player = document.getElementById("carousel-player");
  const playerHeight = player?.querySelector(".now-playing")?.children.length
    ? player.getBoundingClientRect().height
    : 0;
  const bottom = `calc(${playerHeight}px + 1rem)`;

  for (const element of movableElements) {
    element.style.bottom = bottom;
  }
};

const observePlayer = () => {
  const player = document.getElementById("carousel-player");
  if (player) {
    sharedObserver = new MutationObserver(updateAllPositions);
    sharedObserver.observe(player, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return;
  }

  const bodyObserver = new MutationObserver(() => {
    const player = document.getElementById("carousel-player");
    if (player) {
      bodyObserver.disconnect();
      sharedObserver = new MutationObserver(updateAllPositions);
      sharedObserver.observe(player, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  sharedObserver = bodyObserver;
};

const ensureObserver = () => {
  if (sharedObserver) {
    return;
  }

  observePlayer();
};

export const applyMovablePosition = (element: HTMLElement): (() => void) => {
  movableElements.add(element);
  ensureObserver();
  updateAllPositions();

  return () => {
    movableElements.delete(element);
    if (movableElements.size === 0 && sharedObserver) {
      sharedObserver.disconnect();
      sharedObserver = null;
    }
  };
};

type MovableButton = HTMLButtonElement & {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
};

export const createMovableButton = (
  id: string,
  className: string,
  onClick: () => void,
): MovableButton => {
  const el = document.createElement("button");
  el.type = "button";
  el.id = id;
  el.className = className;
  el.onclick = onClick;

  const unregister = applyMovablePosition(el);

  return Object.assign(el, {
    hide: () => el.classList.add("bc-hidden"),
    show: () => el.classList.remove("bc-hidden"),
    cleanup: () => unregister(),
  });
};
