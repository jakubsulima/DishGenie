import React, { useState } from "react";
import { UNIT_OPTIONS, type unitType } from "../context/fridgeContext";
import { useLanguage } from "../context/languageContext";
import type { FridgeOperationReviewChange } from "./FridgeOperationReview";

interface ShoppingToFridgeReviewProps {
  items: FridgeOperationReviewChange[];
  onChange: (change: FridgeOperationReviewChange) => void;
}

const PencilIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.23 5.23 18.77 8.77 6.5 21.04H3v-3.57L16.73 3.73a2.5 2.5 0 0 1-1.5 1.5z"
    />
  </svg>
);

const ShoppingToFridgeReview: React.FC<ShoppingToFridgeReviewProps> = ({
  items,
  onChange,
}) => {
  const { t } = useLanguage();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2" aria-label={t("Checked items")}>
      {items.map((item) => {
        const isEditing = editingKey === item.key;
        const details = [item.amount, item.unit].filter(Boolean).join(" ");

        return (
          <article
            key={item.key}
            className="rounded-xl border border-primary/10 bg-background p-3 shadow-sm"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-text">{item.name}</h3>
                {details && (
                  <p className="mt-0.5 text-xs text-text/55">{details}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingKey(isEditing ? null : item.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  isEditing
                    ? "border-primary/15 bg-primary text-background"
                    : "border-accent/50 bg-accent/15 text-text hover:bg-accent/25"
                }`}
                aria-label={t("Edit {name}", { name: item.name })}
                aria-expanded={isEditing}
              >
                <PencilIcon />
                {t(isEditing ? "Done" : "Edit")}
              </button>
            </div>

            {isEditing && (
              <div className="mt-3 grid gap-2 border-t border-primary/10 pt-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-text/65">
                  {t("Item name")}
                  <input
                    type="text"
                    value={item.name}
                    onChange={(event) =>
                      onChange({ ...item, name: event.target.value })
                    }
                    className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-sm text-text"
                    aria-label={t("Item name")}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-text/65">
                  {t("Amount")}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.amount}
                    onChange={(event) =>
                      onChange({ ...item, amount: event.target.value })
                    }
                    className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-sm text-text"
                    aria-label={t("Amount")}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-text/65">
                  {t("Unit")}
                  <select
                    value={item.unit}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        unit: event.target.value as unitType,
                      })
                    }
                    className="w-full rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-sm text-text"
                    aria-label={t("Unit")}
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit || "unknown"} value={unit}>
                        {unit || t("Unknown")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {item.error && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {item.error}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default ShoppingToFridgeReview;
