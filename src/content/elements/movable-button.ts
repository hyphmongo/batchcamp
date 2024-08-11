type MovableButton = HTMLButtonElement & { hide: () => void };

export const createMovableButton = (
  id: string,
  className: string,
  onClick: () => void
): MovableButton => {
  const button = document.createElement("button") as MovableButton;

  button.id = id;
  button.className = className;
  button.onclick = onClick;

  const updatePosition = () => {
    const player = document.getElementById("carousel-player");
    const playerHeight =
      player && player.querySelector(".now-playing")?.children.length
        ? player.getBoundingClientRect().height
        : 0;
    button.style.bottom = `calc(${playerHeight}px + 1rem)`;
  };

  const observer = new MutationObserver(updatePosition);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  updatePosition();

  button.hide = () => {
    button.classList.add("hidden");
    if (observer) {
      observer.disconnect();
    }
  };

  return button;
};
