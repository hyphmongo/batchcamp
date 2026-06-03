import {
  BRAND_MARK_HEIGHT,
  BRAND_MARK_OFFSETS,
  BRAND_MARK_PATH,
  BRAND_MARK_WIDTH,
} from "./brand-mark";

type WordmarkProps = {
  size?: number;
  variant?: "color" | "mono";
  className?: string;
  title?: string;
};

const LAYER_OPACITIES = [0.22, 0.5, 1] as const;
const COLOR_LAYER_FILLS = [
  "var(--bc-accent)",
  "var(--bc-secondary)",
  "var(--bc-accent)",
] as const;

const Wordmark = ({
  size = 24,
  variant = "mono",
  className,
  title,
}: WordmarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${BRAND_MARK_WIDTH} ${BRAND_MARK_HEIGHT}`}
    className={className}
    role={title ? "img" : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    xmlns="http://www.w3.org/2000/svg"
  >
    {BRAND_MARK_OFFSETS.map((offset, i) => {
      const fill = variant === "color" ? COLOR_LAYER_FILLS[i] : "currentColor";
      const key = `${offset.dx}-${offset.dy}`;
      return (
        <path
          key={key}
          d={BRAND_MARK_PATH}
          fill={fill}
          opacity={LAYER_OPACITIES[i]}
          transform={`translate(${offset.dx} ${offset.dy})`}
        />
      );
    })}
  </svg>
);

export { Wordmark };
