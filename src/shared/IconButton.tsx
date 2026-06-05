import type { Icon } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

const iconButton = cva(
  "relative inline-flex shrink-0 items-center justify-center after:absolute after:-inset-2 after:content-[''] text-base-content/70 hover:text-base-content hover:bg-base-200/70 transition-colors cursor-pointer",
  {
    variants: {
      variant: {
        strip:
          "w-7 h-7 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
        lg: "w-8 h-8 focus-ring focus-visible:outline-offset-1",
      },
    },
    defaultVariants: { variant: "strip" },
  },
);

const GLYPH = {
  strip: { size: 14, weight: "regular" },
  lg: { size: 16, weight: "regular" },
} as const;

type IconButtonProps = {
  icon: Icon;
  label: string;
  title?: string;
} & VariantProps<typeof iconButton> &
  Omit<
    ComponentPropsWithoutRef<"button">,
    "aria-label" | "title" | "className" | "children"
  >;

const IconButton = ({
  icon: Glyph,
  label,
  title = label,
  variant,
  type = "button",
  ...rest
}: IconButtonProps) => {
  const v = variant ?? "strip";
  const glyph = GLYPH[v];
  return (
    <button
      type={type}
      className={iconButton({ variant: v })}
      aria-label={label}
      title={title}
      {...rest}
    >
      <Glyph size={glyph.size} weight={glyph.weight} aria-hidden />
    </button>
  );
};

export { IconButton };
