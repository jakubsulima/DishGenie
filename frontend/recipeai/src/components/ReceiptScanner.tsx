import { useEffect, useState } from "react";
import axios from "axios";
import {
  AddFridgeIngredientInput,
  UNIT_OPTIONS,
  unitType,
} from "../context/fridgeContext";
import { API_URL } from "../lib/constants";
import ErrorAlert from "./ErrorAlert";
import { useLanguage } from "../context/languageContext";

interface ReceiptScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: AddFridgeIngredientInput[]) => Promise<void>;
}

interface DetectedReceiptItem {
  name?: string;
  amount?: number | string | null;
  unit?: string | null;
}

interface EditableReceiptItem {
  id: string;
  selected: boolean;
  name: string;
  amount: string;
  unit: unitType;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const toUnitType = (value?: string | null): unitType => {
  if (!value) {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (UNIT_OPTIONS.includes(normalized as unitType)) {
    return normalized as unitType;
  }

  const enumToAbbreviation: Record<string, unitType> = {
    grams: "g",
    kilograms: "kg",
    milliliters: "ml",
    liters: "l",
    pieces: "pcs",
  };

  return enumToAbbreviation[normalized] ?? "";
};

const ReceiptScanner = ({
  isOpen,
  onClose,
  onConfirm,
}: ReceiptScannerProps) => {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<EditableReceiptItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const scanReceipt = async () => {
    setError("");
    if (!file) {
      setError(t("Select a receipt image first."));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        `${API_URL}scanFridgeReceipt`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const detectedItems = Array.isArray(response.data)
        ? (response.data as DetectedReceiptItem[])
        : [];

      const editableItems: EditableReceiptItem[] = detectedItems
        .filter((item) => item?.name && item.name.trim() !== "")
        .map((item, index) => ({
          id: `${Date.now()}-${index}`,
          selected: true,
          name: item.name!.trim(),
          amount:
            item.amount === null || item.amount === undefined
              ? ""
              : String(item.amount),
          unit: toUnitType(item.unit),
        }));

      if (editableItems.length === 0) {
        setError(
          t("No food ingredients were detected on this receipt. Try another photo with better lighting."),
        );
      }

      setItems(editableItems);
    } catch (err: unknown) {
      if (
        axios.isAxiosError(err) &&
        typeof err.response?.data?.message === "string"
      ) {
        setError(t(err.response.data.message));
      } else {
        setError(getErrorMessage(err, t("Failed to scan receipt image.")));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const updateItem = (
    id: string,
    updates: Partial<Omit<EditableReceiptItem, "id">>,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const addSelectedItems = async () => {
    setError("");

    const invalidAmountItem = items.find((item) => {
      if (!item.selected) {
        return false;
      }
      const normalizedAmount = item.amount.trim();
      if (!normalizedAmount) {
        return false;
      }
      const parsed = Number(normalizedAmount);
      return Number.isNaN(parsed) || parsed <= 0;
    });

    if (invalidAmountItem) {
      setError(
        t('Invalid amount for "{name}". Use a positive number.', {
          name: invalidAmountItem.name,
        }),
      );
      return;
    }

    const selected = items
      .filter((item) => item.selected && item.name.trim() !== "")
      .map((item) => {
        const normalizedAmount = item.amount.trim();
        return {
          name: item.name.trim(),
          expirationDate: null,
          amount: normalizedAmount ? normalizedAmount : undefined,
          unit: item.unit,
        } satisfies AddFridgeIngredientInput;
      });

    if (selected.length === 0) {
      setError(t("Select at least one valid item to add."));
      return;
    }

    try {
      await onConfirm(selected);
      setFile(null);
      setItems([]);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("Could not add scanned items.")));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="mobile-card-enter max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-primary/20 bg-secondary shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-scanner-title"
      >
        <div className="border-b border-primary/10 bg-primary px-4 py-3 text-background sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="receipt-scanner-title" className="text-lg font-bold">
                {t("Scan Receipt")}
              </h3>
              <p className="text-sm text-background/75">
                {t("Upload a photo and review detected ingredients before adding.")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mobile-soft-press rounded-md border border-background/20 px-2.5 py-1.5 text-sm font-medium text-background/80 transition-colors hover:bg-background/10 hover:text-background"
            >
              {t("Close")}
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-xl border border-primary/15 bg-background p-4">
            <label className="mb-2 block text-sm font-medium text-text">
              {t("Upload receipt image")}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2.5 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-primary/90"
              />
              <button
                onClick={scanReceipt}
                disabled={isUploading}
                className="mobile-soft-press rounded-lg bg-accent px-4 py-2.5 font-semibold text-text transition-colors hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60"
              >
                {t(isUploading ? "Scanning..." : "Scan Receipt")}
              </button>
            </div>
            {file && (
              <p className="mt-2 text-xs text-text/60">
                {t("Selected file: {name}", { name: file.name })}
              </p>
            )}
          </div>

          <ErrorAlert message={error} compact onAutoHide={() => setError("")} />

          {items.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
              <div className="border-b border-primary/10 px-4 py-3">
                <h4 className="text-sm font-semibold text-text">
                  {t("Detected ingredients ({count})", { count: items.length })}
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-secondary text-left text-text/80">
                    <tr>
                      <th className="p-3">{t("Add")}</th>
                      <th className="p-3">{t("Name")}</th>
                      <th className="p-3">{t("Amount")}</th>
                      <th className="p-3">{t("Unit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-primary/10">
                        <td className="p-3 align-middle">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) =>
                              updateItem(item.id, {
                                selected: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-primary/30 text-accent focus:ring-accent"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            value={item.name}
                            onChange={(e) =>
                              updateItem(item.id, { name: e.target.value })
                            }
                            className="w-full rounded-md border border-primary/20 bg-background px-2.5 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            value={item.amount}
                            onChange={(e) =>
                              updateItem(item.id, { amount: e.target.value })
                            }
                            placeholder={t("optional")}
                            className="w-full rounded-md border border-primary/20 bg-background px-2.5 py-1.5 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(item.id, {
                                unit: e.target.value as unitType,
                              })
                            }
                            className="w-full rounded-md border border-primary/20 bg-background px-2.5 py-1.5 text-text focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="">{t("none")}</option>
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="l">l</option>
                            <option value="pcs">{t("pcs")}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-primary/10 bg-secondary px-4 py-3">
                <button
                  onClick={addSelectedItems}
                  className="mobile-soft-press rounded-lg bg-primary px-4 py-2.5 font-semibold text-background transition-colors hover:bg-primary/90"
                >
                  {t("Add Selected To Inventory")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
