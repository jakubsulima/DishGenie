import React from "react";
import { useLanguage } from "../context/languageContext";
import { UNIT_OPTIONS, type unitType } from "../context/fridgeContext";
import FridgeOperationSuccess from "./FridgeOperationSuccess";

type FridgeOperationQuantityAccuracy = "EXACT" | "ESTIMATED" | "UNKNOWN";

export interface FridgeOperationReviewChange {
  key: string;
  clientChangeId?: string;
  barcode?: string | null;
  originalAmount?: string;
  name: string;
  amount: string;
  unit: unitType;
  quantityAccuracy: FridgeOperationQuantityAccuracy;
  selected: boolean;
  error?: string;
  warning?: string;
}

interface FridgeOperationReviewProps {
  changes: FridgeOperationReviewChange[];
  onChange: (change: FridgeOperationReviewChange) => void;
  successMessage?: string;
  onUndo?: () => void;
}

const FridgeOperationReview: React.FC<FridgeOperationReviewProps> = ({
  changes,
  onChange,
  successMessage,
  onUndo,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3" aria-label={t("Review fridge changes")}>
      {successMessage && (
        <FridgeOperationSuccess message={successMessage} onUndo={onUndo} />
      )}
      {changes.map((change) => (
        <article
          key={change.key}
          className="rounded-2xl border border-primary/15 bg-background p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={change.selected}
              onChange={() => onChange({ ...change, selected: !change.selected })}
              aria-label={t("Include {name}", { name: change.name })}
              className="mt-1 h-5 w-5 shrink-0 accent-accent"
            />
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
              <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text">
                {t("Item name")}
                <input
                  type="text"
                  value={change.name}
                  onChange={(event) => onChange({ ...change, name: event.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-text"
                  aria-label={t("Item name")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                {t("Amount")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={change.amount}
                  onChange={(event) => onChange({ ...change, amount: event.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-text"
                  aria-label={t("Amount")}
                />
                {change.quantityAccuracy === "ESTIMATED" && change.amount && (
                  <span className="text-xs text-text/60" aria-label={t("Estimated amount", { amount: change.amount })}>
                    ~{change.amount} · {t("estimated")}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                {t("Unit")}
                <select
                  value={change.unit}
                  onChange={(event) => onChange({ ...change, unit: event.target.value as unitType })}
                  className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-text"
                  aria-label={t("Unit")}
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit || t("Unknown")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <label className="mt-3 flex flex-col gap-1 pl-8 text-sm font-medium text-text">
            {t("Quantity accuracy")}
            <select
              value={change.quantityAccuracy}
              onChange={(event) =>
                onChange({
                  ...change,
                  quantityAccuracy: event.target.value as FridgeOperationQuantityAccuracy,
                })
              }
              className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-text"
              aria-label={t("Quantity accuracy")}
            >
              <option value="EXACT">{t("Exact")}</option>
              <option value="ESTIMATED">{t("Estimated")}</option>
              <option value="UNKNOWN">{t("Unknown")}</option>
            </select>
          </label>
          {change.warning && (
            <p className="mt-3 pl-8 text-sm text-accent" role="status">
              {change.warning}
            </p>
          )}
          {change.error && (
            <p className="mt-3 pl-8 text-sm text-red-700" role="alert">
              {change.error}
            </p>
          )}
        </article>
      ))}
    </div>
  );
};

export default FridgeOperationReview;
