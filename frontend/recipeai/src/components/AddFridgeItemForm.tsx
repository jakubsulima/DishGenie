import React, { useEffect, useState } from "react";
import { hasAmountError } from "../lib/hooks";
import OptionsForm from "./OptionsForm";
import { unitType } from "../context/fridgeContext";
import { useLanguage } from "../context/languageContext";

interface AddFridgeItemFormProps {
  newItem: string;
  setNewItem: (value: string) => void;
  newItemDate: string;
  handleDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  unit: unitType;
  setUnit: (value: unitType) => void;
  amount: string;
  setAmount: (value: string) => void;
  addItem: () => void;
  showNameError: boolean;
  dateError: string;
  displayLoading: boolean;
}

const AddFridgeItemForm: React.FC<AddFridgeItemFormProps> = ({
  newItem,
  setNewItem,
  newItemDate,
  handleDateChange,
  unit,
  setUnit,
  amount,
  setAmount,
  addItem,
  showNameError,
  dateError,
  displayLoading,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (
      newItem ||
      newItemDate ||
      amount ||
      unit ||
      showNameError ||
      dateError
    ) {
      setIsExpanded(true);
    }
  }, [newItem, newItemDate, amount, unit, showNameError, dateError]);

  return (
    <div className="mobile-card-enter ambient-gradient-card w-full rounded-2xl border border-primary/10 bg-secondary p-5 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-primary/10 bg-background px-4 py-3 text-left transition-colors hover:border-accent/45"
        aria-expanded={isExpanded}
      >
        <div>
          <h2 className="text-xl font-bold text-text sm:text-2xl">
            {t("Add to Fridge")}
          </h2>
          <p className="text-sm text-text/60">
            {t(isExpanded ? "Hide the quick add form" : "Open the quick add form")}
          </p>
        </div>
        <span className="rounded-full bg-accent/25 px-2.5 py-1 text-xs font-semibold text-text">
          {t(isExpanded ? "Hide" : "Open")}
        </span>
      </button>

      <div
        className={`grid overflow-hidden transition-all duration-300 ease-out ${
          isExpanded
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-text">
                {t("Item name")} <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder={t("e.g., Tomatoes")}
                className={`w-full appearance-none rounded-lg border bg-background p-2.5 text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent ${
                  showNameError && !newItem.trim()
                    ? "border-accent"
                    : "border-primary/20"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
                disabled={displayLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="mt-1 block text-sm font-medium text-text">
                {t("Expiration date")}{" "}
                <span className="font-normal text-text/50">{t("(optional)")}</span>
              </label>
              <input
                type="date"
                value={newItemDate}
                onChange={handleDateChange}
                className={`w-full appearance-none rounded-lg border bg-background p-2.5 text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent ${
                  dateError ? "border-accent" : "border-primary/20"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
                disabled={displayLoading}
              />
              {dateError && (
                <p className="mt-1 text-xs font-medium text-text/75">
                  {dateError}
                </p>
              )}
            </div>

            <div className="mt-1">
              <OptionsForm
                label="Unit (optional)"
                name="Unit"
                options={["g", "kg", "ml", "l", "pcs"]}
                currentOptions={unit}
                onChange={(value) => {
                  setUnit(value as unitType);
                  if (!value) {
                    setAmount("");
                  }
                }}
              />
            </div>

            {unit && (
              <div className="amount-slide-in mt-1 flex flex-col gap-1">
                <label className="block text-sm font-medium text-text">
                  {t("Amount")}{" "}
                  <span className="font-normal text-text/50">{t("(optional)")}</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 1.5"
                  className={`w-full appearance-none rounded-lg border bg-background p-2.5 text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent ${
                    hasAmountError(amount)
                      ? "border-accent"
                      : "border-primary/20"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  disabled={displayLoading}
                />
                {hasAmountError(amount) && (
                  <p className="mt-1 text-xs text-text/75">
                    {t("Please enter a valid positive number")}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={addItem}
              disabled={displayLoading || hasAmountError(amount) || !!dateError}
              className="mobile-soft-press mt-4 cursor-pointer rounded-lg bg-accent px-4 py-3 font-semibold text-text shadow-[0_10px_24px_rgba(255,212,60,0.28)] transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(displayLoading ? "Adding..." : "Add Item")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFridgeItemForm;
