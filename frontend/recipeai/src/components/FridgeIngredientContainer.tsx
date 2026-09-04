import { useEffect, useState } from "react";
import {
  UNIT_OPTIONS,
  UpdateFridgeIngredientInput,
  unitType,
} from "../context/fridgeContext";
import { formatDateForBackend } from "../lib/hooks";
import { useLanguage } from "../context/languageContext";

interface Props {
  id: number;
  name: string;
  expirationDate: string | null;
  remove: () => void;
  unit: unitType;
  amount?: string | number;
  stockState?: "IN_STOCK" | "LOW";
  onQuickAction?: (action: "DECREMENT" | "MARK_LOW") => void;
  quickActionLoading?: boolean;
  onUpdateItem: (id: number, item: UpdateFridgeIngredientInput) => Promise<void>;
}

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) {
    return "";
  }
  const parts = dateString.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    const shortYear = parts[2].slice(-2);
    return `${parts[0]}-${parts[1]}-${shortYear}`;
  }
  return dateString;
};

const backendDateToInputDate = (dateString: string): string => {
  const parts = dateString.split("-");
  if (parts.length !== 3) {
    return "";
  }

  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) {
    return "";
  }

  return `${year}-${month}-${day}`;
};

const hasEditableAmountError = (amount: string): boolean => {
  const trimmedAmount = amount.trim();
  if (!trimmedAmount) {
    return false;
  }

  if (!/^[0-9]*\.?[0-9]+$/.test(trimmedAmount)) {
    return true;
  }

  return Number.parseFloat(trimmedAmount) < 0;
};

const FridgeIngredientContainer = ({
  id,
  name,
  expirationDate,
  unit,
  amount,
  stockState = "IN_STOCK",
  onQuickAction = () => undefined,
  quickActionLoading = false,
  remove,
  onUpdateItem,
}: Props) => {
  const { t } = useLanguage();
  const normalizedAmount = amount == null ? "" : String(amount);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editAmount, setEditAmount] = useState(normalizedAmount);
  const [editUnit, setEditUnit] = useState<unitType>(unit || "");
  const [editExpirationDate, setEditExpirationDate] = useState(
    backendDateToInputDate(expirationDate || ""),
  );
  const [validationError, setValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setEditName(name);
    setEditAmount(normalizedAmount);
    setEditUnit(unit || "");
    setEditExpirationDate(backendDateToInputDate(expirationDate || ""));
  }, [expirationDate, isEditing, name, normalizedAmount, unit]);

  const handleSave = async () => {
    const trimmedName = editName.trim();

    if (!trimmedName) {
      setValidationError("Name is required.");
      return;
    }

    if (hasEditableAmountError(editAmount)) {
      setValidationError("Enter a valid positive amount.");
      return;
    }

    setValidationError("");

    setIsSaving(true);
    try {
      await onUpdateItem(id, {
        name: trimmedName,
        expirationDate: editExpirationDate
          ? formatDateForBackend(editExpirationDate)
          : null,
        amount: editAmount.trim(),
        unit: editUnit,
      });
      setIsEditing(false);
    } catch (error) {
      setValidationError("Could not save changes. Try again.");
      console.error("Failed to update fridge item:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(name);
    setEditAmount(normalizedAmount);
    setEditUnit(unit || "");
    setEditExpirationDate(backendDateToInputDate(expirationDate || ""));
    setValidationError("");
    setIsEditing(false);
  };

  const amountLabel = normalizedAmount.trim()
    ? `${normalizedAmount} ${unit || ""}`.trim()
    : t("No amount");
  const shortExpirationDate = formatShortDate(expirationDate || null);
  const amountWillDelete = editAmount.trim() === "0";
  const inputClassName =
    "w-full min-w-0 rounded-lg border bg-background px-2 py-2.5 text-base text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent";
  const invalidInputClassName = "border-error/70 ring-1 ring-error/25";

  return (
    <div className="group w-full">
      {!isEditing ? (
        <div
          className="flex min-h-14 w-full items-center gap-2.5 rounded-xl border border-primary/10 bg-background px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
          role="group"
          aria-label={name}
        >
            <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
              <h2 className="truncate font-semibold leading-tight text-text">
                {name}
              </h2>
              {(normalizedAmount.trim() || shortExpirationDate) && (
                <div className="flex min-w-0 shrink items-center gap-1.5 truncate text-[11px] font-medium text-text/55">
                  {normalizedAmount.trim() && (
                    <span className="shrink-0">{amountLabel}</span>
                  )}
                  {normalizedAmount.trim() && shortExpirationDate && (
                    <span aria-hidden="true">·</span>
                  )}
                  {shortExpirationDate && (
                    <span className="truncate">
                      {t("Exp:")} {shortExpirationDate}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex shrink-0 items-center gap-0.5"
              aria-label={t("Quick actions")}
            >
              <button
                type="button"
                onClick={() => onQuickAction("MARK_LOW")}
                disabled={quickActionLoading}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  stockState === "LOW"
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
                aria-label={t(stockState === "LOW" ? "Mark as enough" : "Mark as low")}
                title={t(stockState === "LOW" ? "Mark as enough" : "Mark as low")}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    stockState === "LOW" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                {t(stockState === "LOW" ? "Low" : "Plenty")}
              </button>

              {unit === "pcs" && Number(normalizedAmount) >= 1 && (
                <button
                  type="button"
                  onClick={() => onQuickAction("DECREMENT")}
                  disabled={quickActionLoading}
                  className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-bold text-text/55 transition-colors hover:bg-accent/15 hover:text-text disabled:opacity-50"
                  aria-label={t("Use 1 {name}", { name })}
                  title={t("Use 1")}
                >
                  −1
                </button>
              )}

              <button
                type="button"
                onClick={remove}
                disabled={quickActionLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text/35 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                aria-label={t("Remove {name}", { name })}
                title={t("Remove item")}
              >
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.87 12.14A2 2 0 0 1 16.14 21H7.86a2 2 0 0 1-1.99-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
              </button>

              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text/35 transition-colors hover:bg-accent/10 hover:text-accent"
                onClick={() => setIsEditing(true)}
                aria-label={t("Edit {name}", { name })}
                title={t("Edit item")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4.5 w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/10 bg-background p-3 shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="sr-only" htmlFor={`fridge-name-${id}`}>
              {t("Name")}
            </label>
            <input
              id={`fridge-name-${id}`}
              type="text"
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);
                if (validationError) {
                  setValidationError("");
                }
              }}
              className={`${inputClassName} ${
                validationError === "Name is required."
                  ? invalidInputClassName
                  : "border-primary/20"
              }`}
              placeholder={t("Name")}
              autoFocus
            />
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex h-10 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-text transition-colors hover:bg-accent/90 disabled:opacity-50"
                aria-label={t("Save")}
                title={t("Save")}
              >
                {t(isSaving ? "Saving" : "Save")}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-text/50 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                aria-label={t("Cancel")}
                title={t("Cancel")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[4.5rem_4rem_minmax(0,1fr)] gap-2">
              <label className="sr-only" htmlFor={`fridge-amount-${id}`}>
                {t("Amount")}
              </label>
              <input
                id={`fridge-amount-${id}`}
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(event) => {
                  setEditAmount(event.target.value);
                  if (validationError) {
                    setValidationError("");
                  }
                }}
                className={`${inputClassName} ${
                  hasEditableAmountError(editAmount)
                    ? invalidInputClassName
                    : "border-primary/20"
                }`}
                placeholder={t("Amount")}
              />
              <label className="sr-only" htmlFor={`fridge-unit-${id}`}>
                {t("Unit")}
              </label>
              <select
                id={`fridge-unit-${id}`}
                value={editUnit}
                onChange={(event) => setEditUnit(event.target.value as unitType)}
                className={`${inputClassName} border-primary/20 px-1.5`}
                aria-label={`Unit ${editUnit || "none"}`}
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option || "none"} value={option}>
                    {option || "-"}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`fridge-expiration-${id}`}>
                {t("Expiration")}
              </label>
              <input
                id={`fridge-expiration-${id}`}
                type="date"
                value={editExpirationDate}
                onChange={(event) => setEditExpirationDate(event.target.value)}
                className={`${inputClassName} border-primary/20`}
                aria-label={t("Expiration")}
              />
          </div>

          {amountWillDelete && (
            <p className="rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-xs font-medium text-error">
              {t("Saving 0 will remove this item.")}
            </p>
          )}

          {validationError && (
            <p className="rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-xs font-medium text-error">
              {t(validationError)}
            </p>
          )}

        </div>
      )}
    </div>
  );
};

export default FridgeIngredientContainer;
