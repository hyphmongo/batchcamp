import React from "react";

type Props = {
  children?: React.ReactNode;
};

export const Cell = ({ children }: Props) => (
  <td className="truncate flex items-center p-2.5">{children}</td>
);

export const Header = ({ children }: Props) => (
  <th className="truncate flex items-center p-2.5">{children}</th>
);
