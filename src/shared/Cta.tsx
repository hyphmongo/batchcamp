import type { ComponentPropsWithoutRef } from "react";

const CTA_BASE =
  "bg-accent text-accent-content font-medium hover:brightness-95 transition-[filter] cursor-pointer focus-ring";

const Cta = ({
  className,
  type = "button",
  ...rest
}: ComponentPropsWithoutRef<"button">) => (
  <button
    type={type}
    className={className ? `${CTA_BASE} ${className}` : CTA_BASE}
    {...rest}
  />
);

export { Cta };
