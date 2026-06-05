import type { ComponentPropsWithoutRef } from "react";

type FieldLabelProps = ComponentPropsWithoutRef<"label"> & { htmlFor: string };

const FieldLabel = ({ htmlFor, ...rest }: FieldLabelProps) => (
  <label
    htmlFor={htmlFor}
    className="text-sm font-medium text-base-content/70"
    {...rest}
  />
);

export { FieldLabel };
