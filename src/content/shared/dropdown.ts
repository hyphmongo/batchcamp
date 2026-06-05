const SVG_NS = "http://www.w3.org/2000/svg";

export const createChevron = (): SVGSVGElement => {
  const chevron = document.createElementNS(SVG_NS, "svg");
  chevron.setAttribute("width", "12");
  chevron.setAttribute("height", "12");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "3");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");

  const chevronPath = document.createElementNS(SVG_NS, "path");
  chevronPath.setAttribute("d", "M6 9l6 6 6-6");
  chevron.appendChild(chevronPath);

  return chevron;
};
