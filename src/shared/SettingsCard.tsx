import type { ReactNode } from "react";

export const SettingsCard = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-base-300/60 bg-base-200/45 px-4 py-2">
    {children}
  </div>
);

export const SettingsRow = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-12 flex-col justify-center py-1.5">{children}</div>
);
