import { IdleDither } from "./IdleDither";

export const EmptyState = () => (
  <div className="flex flex-col items-center text-center gap-6">
    <IdleDither size={130} />
    <div className="flex flex-col items-center gap-2.5">
      <h2 className="text-display font-semibold tracking-tight leading-[1.05] text-base-content lowercase">
        awaiting downloads
      </h2>
      <p className="text-body text-base-content/70">
        select releases on your collection or purchases page
      </p>
    </div>
  </div>
);
