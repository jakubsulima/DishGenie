import { useEffect, useState } from "react";
import {
  UNIT_OPTIONS,
  UpdateFridgeIngredientInput,
  unitType,
} from "../context/fridgeContext";
import { formatDateForBackend } from "../lib/hooks";

interface Props {
  id: number;
  name: string;
  expirationDate: string | null;
  remove: () => void;
  unit: unitType;
  amount?: string | number;
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
  remove,
  onUpdateItem,
}: Props) => {
  const normalizedAmount = amount == null ? "" : String(amount);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editAmount, setEditAmount] = useState(normalizedAmount);
  const [editUnit, setEditUnit] = useState<unitType>(unit || "");
  const [editExpirationDate, setEditExpirationDate] = useState(
    backendDateToInputDate(expirationDate || ""),
  );
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);
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
    setIsUnitPickerOpen(false);
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
      setIsUnitPickerOpen(false);
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
    setIsUnitPickerOpen(false);
    setValidationError("");
    setIsEditing(false);
  };

  const amountLabel = normalizedAmount.trim()
    ? `${normalizedAmount} ${unit || ""}`.trim()
    : "No amount";
  const shortExpirationDate = formatShortDate(expirationDate || null);
  const amountWillDelete = editAmount.trim() === "0";
  const inputClassName =
    "w-full min-w-0 rounded-lg border bg-background px-2 py-2.5 text-sm text-text shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-accent";
  const invalidInputClassName = "border-error/70 ring-1 ring-error/25";

  return (
    <div className="group w-full rounded-xl border border-primary/10 bg-background p-3.5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-center min-h-[4rem]">
      {!isEditing ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="font-semibold text-text truncate leading-tight">
              {name}
            </h1>
            <div className="flex flex-wrap text-[11px] text-text/70 items-center gap-1.5 mt-1">
              <button
                onClick={() => setIsEditing(true)}
                className="hover:text-accent transition-colors flex items-center gap-1"
                aria-label={`Edit ${name}`}
                title="Edit item"
              >
                <span className="px-2 py-0.5 rounded-full bg-secondary border border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all font-medium flex items-center cursor-pointer">
                  {amountLabel}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 ml-1 opacity-70"
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
                </span>
              </button>
              {shortExpirationDate && (
                <span className="px-2 py-0.5 rounded-full bg-secondary border border-primary/10">
                  Exp: {shortExpirationDate}
                </span>
              )}
            </div>
          </div>

          <button
            className="text-text/30 hover:text-error text-lg leading-none transition-colors p-1.5 rounded-md hover:bg-error/10 flex-shrink-0"
            onClick={remove}
            aria-label={`Remove ${name}`}
            title="Remove item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-text/70">
              Name
              <input
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
                autoFocus
              />
            </label>

            <div className="grid grid-cols-[minmax(0,0.95fr)_4.25rem_minmax(0,1.2fr)] items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-text/70">
                Amount
                <input
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
                  placeholder="Optional"
                />
              </label>

              <div className="relative flex flex-col gap-1 text-xs font-semibold text-text/70">
                <span>Unit</span>
                <button
                  type="button"
                  onClick={() => setIsUnitPickerOpen((isOpen) => !isOpen)}
                  className="flex min-h-10 w-full items-center justify-center rounded-lg border border-primary/20 bg-background px-2 text-sm font-semibold text-text shadow-sm transition-colors hover:border-accent/45 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label={`Unit ${editUnit || "none"}`}
                  aria-expanded={isUnitPickerOpen}
                >
                  {editUnit || "-"}
                </button>
                {isUnitPickerOpen && (
                  <div className="absolute left-1/2 top-full z-20 mt-1 grid w-28 -translate-x-1/2 grid-cols-2 gap-1 rounded-lg border border-primary/15 bg-background p-1.5 shadow-lg">
                    {UNIT_OPTIONS.map((option) => (
                      <button
                        key={option || "none"}
                        type="button"
                        onClick={() => {
                          setEditUnit(option);
                          setIsUnitPickerOpen(false);
                        }}
                        className={`min-h-8 rounded-md px-2 text-xs font-semibold transition-colors ${
                          editUnit === option
                            ? "bg-accent text-text"
                            : "bg-secondary text-text/70 hover:bg-accent/20 hover:text-text"
                        }`}
                      >
                        {option || "-"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-text/70">
                Expiration
                <input
                  type="date"
                  value={editExpirationDate}
                  onChange={(event) =>
                    setEditExpirationDate(event.target.value)
                  }
                  className={`${inputClassName} border-primary/20`}
                />
              </label>
            </div>
          </div>

          {amountWillDelete && (
            <p className="rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-xs font-medium text-error">
              Saving 0 will remove this item.
            </p>
          )}

          {validationError && (
            <p className="rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-xs font-medium text-error">
              {validationError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex min-h-11 items-center justify-center rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90 disabled:opacity-50"
              aria-label="Save"
              title="Save"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="ml-1.5">{isSaving ? "Saving" : "Save"}</span>
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex min-h-11 items-center justify-center rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-text/70 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
              aria-label="Cancel"
              title="Cancel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span className="ml-1.5">Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FridgeIngredientContainer;
