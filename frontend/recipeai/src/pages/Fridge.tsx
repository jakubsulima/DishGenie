import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddFridgeIngredientInput,
  FridgeIngredient,
  UpdateFridgeIngredientInput,
  unitType,
  useFridge,
} from "../context/fridgeContext";
import { useUser } from "../context/context";
import { formatDateForBackend, lookupProductByBarcode } from "../lib/hooks";
import { captureEvent } from "../lib/posthog";
import AddFridgeItemForm from "../components/AddFridgeItemForm";
import FridgeDisplay from "../components/FridgeDisplay";
import BarcodeScanner from "../components/BarcodeScanner";
import ReceiptScanner from "../components/ReceiptScanner";
import ErrorAlert from "../components/ErrorAlert";
import { useLanguage } from "../context/languageContext";
import FridgeOperationReview, {
  type FridgeOperationReviewChange,
} from "../components/FridgeOperationReview";
import FridgeOperationSuccess from "../components/FridgeOperationSuccess";
import {
  applyFridgeOperation,
  createFridgeOperationId,
  undoFridgeOperation,
} from "../lib/fridgeOperations";

const parseBackendDate = (dateString: string) => {
  const [day, month, year] = dateString.split("-");
  return new Date(`${year}-${month}-${day}`);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
};

const createBarcodeReviewChange = (
  barcode: string,
  name: string,
  error?: string,
): FridgeOperationReviewChange => ({
  key: barcode,
  clientChangeId: barcode,
  name,
  amount: "1",
  unit: "pcs",
  quantityAccuracy: "EXACT",
  selected: true,
  barcode,
  ...(error ? { error } : {}),
});

const EXPIRED_BANNER_STORAGE_PREFIX = "recipeai.expiredBannerDismissed";

export const Fridge = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { t } = useLanguage();
  const {
    fridgeItems,
    loading: contextLoading,
    error: contextError,
    addFridgeItem,
    addFridgeItemsBatch,
    removeFridgeItem,
    updateFridgeItem,
    refreshFridgeItems,
    setFridgeItems,
  } = useFridge();

  const [newItem, setNewItem] = useState<string>("");
  const [newItemDate, setNewItemDate] = useState<string>("");
  const [unit, setUnit] = useState<unitType>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showNameError, setShowNameError] = useState(false);
  const [dateError, setDateError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);
  const barcodeOperationIdRef = useRef<string | null>(null);
  const barcodeSessionReferenceRef = useRef<string | null>(null);
  const barcodeQueueRef = useRef<string[]>([]);
  const barcodeChangesRef = useRef<FridgeOperationReviewChange[]>([]);
  const barcodeProcessingRef = useRef(false);
  const barcodeDrainRef = useRef<Promise<void> | null>(null);
  const [barcodeReviewChanges, setBarcodeReviewChanges] = useState<FridgeOperationReviewChange[]>([]);
  const [isBarcodeReviewOpen, setIsBarcodeReviewOpen] = useState(false);
  const [isBarcodeImporting, setIsBarcodeImporting] = useState(false);
  const [barcodeImportSuccess, setBarcodeImportSuccess] = useState(false);
  const [barcodeScannedCount, setBarcodeScannedCount] = useState(0);
  const [quickUndo, setQuickUndo] = useState<{ operationId: string } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const expiredItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return fridgeItems.filter((item) => {
      if (!item.expirationDate) {
        return false;
      }

      const expDate = parseBackendDate(item.expirationDate);
      expDate.setHours(0, 0, 0, 0);
      return expDate < today;
    });
  }, [fridgeItems]);

  const expiredItemsFingerprint = useMemo(
    () =>
      expiredItems
        .map((item) => `${item.id}:${item.name}:${item.expirationDate ?? ""}`)
        .sort()
        .join("|"),
    [expiredItems],
  );

  const expiringSoonNames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 3);

    return fridgeItems
      .filter((item) => {
        if (!item.expirationDate) {
          return false;
        }
        const expDate = parseBackendDate(item.expirationDate);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= today && expDate <= maxDate;
      })
      .map((item) => item.name);
  }, [fridgeItems]);

  const validateDate = (dateString: string) => {
    if (!dateString) {
      setDateError("");
      return true;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateString);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setDateError("Expiration date cannot be in the past");
      return false;
    }

    setDateError("");
    return true;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setNewItemDate(newDate);
    validateDate(newDate);
  };

  const handleNewItemChange = (value: string) => {
    setNewItem(value);
    if (showNameError && value.trim()) {
      setShowNameError(false);
    }
  };

  const addItem = async () => {
    setError("");

    if (!newItem.trim()) {
      setError("Item name is required");
      setShowNameError(true);
      return;
    }

    setShowNameError(false);

    if (!validateDate(newItemDate)) {
      return;
    }

    setIsLoading(true);
    try {
      const formattedDate = newItemDate
        ? formatDateForBackend(newItemDate)
        : null;

      await addFridgeItem({
        name: newItem.trim(),
        expirationDate: formattedDate,
        unit,
        amount,
      });
      captureEvent("fridge_item_added", {
        source: "manual",
        hasAmount: amount.trim() !== "",
        hasUnit: unit !== "",
        hasExpirationDate: Boolean(formattedDate),
      });

      setNewItem("");
      setNewItemDate("");
      setAmount("");
      setUnit("");
      setDateError("");
      setShowNameError(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add item"));
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (id: number) => {
    setIsLoading(true);
    setError("");
    try {
      await removeFridgeItem(id);
      setError("Ingredient deleted.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to remove item"));
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = async (id: number, item: UpdateFridgeIngredientInput) => {
    setError("");
    try {
      await updateFridgeItem(id, item);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update item"));
      throw err;
    }
  };

  const setBarcodeChanges = (
    update:
      | FridgeOperationReviewChange[]
      | ((previous: FridgeOperationReviewChange[]) => FridgeOperationReviewChange[]),
  ) => {
    setBarcodeReviewChanges((previous) => {
      const next = typeof update === "function" ? update(previous) : update;
      barcodeChangesRef.current = next;
      return next;
    });
  };

  const processBarcodeQueue = async (): Promise<void> => {
    if (barcodeProcessingRef.current) {
      return barcodeDrainRef.current ?? Promise.resolve();
    }

    barcodeProcessingRef.current = true;
    const drain = (async () => {
      setIsLoading(true);
      try {
        while (barcodeQueueRef.current.length > 0) {
          const barcode = barcodeQueueRef.current.shift();
          if (!barcode) {
            continue;
          }

          const existing = barcodeChangesRef.current.find(
            (change) => change.barcode === barcode,
          );
          if (existing) {
            setBarcodeChanges((previous) =>
              previous.map((change) =>
                change.barcode === barcode
                  ? { ...change, amount: String(Number(change.amount || "0") + 1) }
                  : change,
              ),
            );
            continue;
          }

          let product: Awaited<ReturnType<typeof lookupProductByBarcode>>;
          try {
            product = await lookupProductByBarcode(barcode);
          } catch (lookupError) {
            captureEvent("barcode_lookup_failed");
            setBarcodeChanges((previous) => [
              ...previous,
              createBarcodeReviewChange(
                barcode,
                "",
                getErrorMessage(
                  lookupError,
                  "Could not look up this product. Enter a name before adding.",
                ),
              ),
            ]);
            continue;
          }
          if (product) {
            setBarcodeChanges((previous) => [
              ...previous,
              createBarcodeReviewChange(product.barcode, product.name),
            ]);
          } else {
            captureEvent("barcode_lookup_failed");
            setBarcodeChanges((previous) => [
              ...previous,
              createBarcodeReviewChange(
                barcode,
                "",
                "Product not found. Enter a name before adding.",
              ),
            ]);
          }
        }
      } finally {
        setIsLoading(false);
        barcodeProcessingRef.current = false;
      }
    })();
    barcodeDrainRef.current = drain;
    return drain;
  };

  const startBarcodeSession = () => {
    barcodeQueueRef.current = [];
    barcodeChangesRef.current = [];
    barcodeOperationIdRef.current = null;
    barcodeSessionReferenceRef.current = createFridgeOperationId();
    setBarcodeScannedCount(0);
    setBarcodeReviewChanges([]);
    setBarcodeImportSuccess(false);
    setError("");
    setIsBarcodeScannerOpen(true);
    captureEvent("barcode_session_started");
  };

  const handleBarcodeDetected = (barcode: string) => {
    barcodeQueueRef.current.push(barcode);
    setBarcodeScannedCount((count) => count + 1);
    captureEvent("barcode_detected");
    void processBarcodeQueue();
  };

  const finishBarcodeSession = async () => {
    await (barcodeDrainRef.current ?? Promise.resolve());
    setIsBarcodeScannerOpen(false);
    if (barcodeChangesRef.current.length === 0) {
      return;
    }
    setBarcodeImportSuccess(false);
    setIsBarcodeReviewOpen(true);
  };

  const cancelBarcodeSession = () => {
    barcodeQueueRef.current = [];
    barcodeChangesRef.current = [];
    setBarcodeReviewChanges([]);
    setIsBarcodeScannerOpen(false);
  };

  const quickAdjustItem = async (
    item: FridgeIngredient,
    action: "DECREMENT" | "MARK_LOW" | "FINISH",
  ) => {
    if (isLoading || isUndoing) {
      return;
    }

    const operationId = createFridgeOperationId();
    const previousItems = fridgeItems;
    const nextItems: FridgeIngredient[] =
      action === "FINISH"
        ? previousItems.filter((current) => current.id !== item.id)
        : previousItems.flatMap((current) => {
            if (current.id !== item.id) {
              return [current];
            }
            if (action === "DECREMENT") {
              const nextAmount = Number(current.amount) - 1;
              return nextAmount <= 0
                ? []
                : [{ ...current, amount: nextAmount }];
            }
            return [
              {
                ...current,
                stockState: (current.stockState === "LOW" ? "IN_STOCK" : "LOW") as FridgeIngredient["stockState"],
              },
            ];
          });
    setFridgeItems(nextItems);
    setIsLoading(true);
    setError("");
    try {
      await applyFridgeOperation({
        operationId,
        source: "QUICK_ADJUSTMENT",
        changes: [
          {
            type: action,
            fridgeItemId: item.id,
            amount: action === "DECREMENT" ? 1 : undefined,
            stockState:
              action === "MARK_LOW"
                ? item.stockState === "LOW"
                  ? "IN_STOCK"
                  : "LOW"
                : undefined,
            quantityAccuracy: "EXACT",
          },
        ],
      });
      await refreshFridgeItems();
      setQuickUndo({ operationId });
      captureEvent("fridge_quick_adjusted", { action });
    } catch (err: unknown) {
      setFridgeItems(previousItems);
      captureEvent("fridge_quick_adjust_failed", { action });
      setError(getErrorMessage(err, "Could not update the fridge."));
    } finally {
      setIsLoading(false);
    }
  };

  const undoLastQuickOperation = async () => {
    if (!quickUndo || isUndoing) {
      return;
    }

    setIsUndoing(true);
    setError("");
    try {
      await undoFridgeOperation(quickUndo.operationId, createFridgeOperationId());
      await refreshFridgeItems();
      setQuickUndo(null);
      captureEvent("fridge_operation_undone");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not undo the fridge update."));
    } finally {
      setIsUndoing(false);
    }
  };

  const confirmBarcodeImport = async () => {
    const selectedChanges = barcodeReviewChanges.filter((item) => item.selected);
    if (selectedChanges.length === 0 || isBarcodeImporting) {
      return;
    }

    const invalidKeys = new Set(
      selectedChanges
        .filter((change) => !change.name.trim())
        .map((change) => change.key),
    );
    if (invalidKeys.size > 0) {
      setBarcodeChanges((previous) =>
        previous.map((change) =>
          invalidKeys.has(change.key)
            ? { ...change, error: "Product name is required." }
            : change,
        ),
      );
      setError("Product name is required for some products.");
    }

    const validChanges = selectedChanges.filter((change) => !invalidKeys.has(change.key));
    if (validChanges.length === 0) {
      return;
    }

    const operationId = barcodeOperationIdRef.current ?? createFridgeOperationId();
    barcodeOperationIdRef.current = operationId;
    setIsBarcodeImporting(true);
    setError("");
    try {
      const response = await applyFridgeOperation({
        operationId,
        source: "BARCODE_SCAN",
        sourceReference: barcodeSessionReferenceRef.current ?? operationId,
        changes: validChanges.map((change) => ({
            type: "ADD",
            clientChangeId: change.clientChangeId ?? change.key,
            name: change.name,
            amount: change.amount ? Number(change.amount) : undefined,
            unit: change.unit || undefined,
            barcode: change.barcode,
            quantityAccuracy: change.quantityAccuracy,
          })),
      });
      await refreshFridgeItems();
      barcodeOperationIdRef.current = null;
      const responseHasNoDetails =
        response.appliedChanges.length === 0 && response.skippedChanges.length === 0;
      const appliedIds = new Set(
        responseHasNoDetails
          ? validChanges.map((change) => change.clientChangeId ?? change.key)
          : response.appliedChanges.map(
              (change) => change.clientChangeId ?? String(change.fridgeItemId ?? ""),
            ),
      );
      const remainingChanges = barcodeReviewChanges
        .filter((change) => !appliedIds.has(change.clientChangeId ?? change.key))
        .map((change) => {
          if (invalidKeys.has(change.key)) {
            return { ...change, error: "Product name is required." };
          }
          const skipped = response.skippedChanges.find(
            (result) =>
              (result.clientChangeId ?? String(result.fridgeItemId ?? "")) ===
              (change.clientChangeId ?? change.key),
          );
          return skipped
            ? { ...change, error: skipped.reason ?? "This product could not be added." }
            : change;
        });

      setBarcodeChanges(remainingChanges);
      if (remainingChanges.some((change) => change.selected)) {
        setBarcodeImportSuccess(false);
        setIsBarcodeReviewOpen(true);
        setError("Some products still need your attention.");
      } else {
        barcodeSessionReferenceRef.current = null;
        setBarcodeImportSuccess(true);
        setIsBarcodeReviewOpen(false);
        captureEvent("barcode_session_confirmed", {
          productCount: validChanges.length,
          quantityAccuracies: validChanges.map((change) => change.quantityAccuracy),
        });
      }
    } catch (err: unknown) {
      captureEvent("barcode_session_confirm_failed");
      setError(getErrorMessage(err, "Could not add barcode product."));
    } finally {
      setIsBarcodeImporting(false);
    }
  };

  const handleScannedReceiptItems = async (
    items: AddFridgeIngredientInput[],
  ) => {
    if (items.length === 0) {
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      await addFridgeItemsBatch(items);
      captureEvent("fridge_items_added_receipt", {
        itemCount: items.length,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not add scanned receipt items."));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateZeroWasteRecipe = () => {
    if (expiringSoonNames.length === 0) {
      setError("No ingredients are expiring in the next 3 days.");
      return;
    }

    const prompt = `Create a zero-waste recipe that uses these ingredients first: ${expiringSoonNames.join(
      ", ",
    )}.`;

    navigate("/Recipe", {
      state: {
        search: prompt,
      },
    });
  };

  const displayError = error || contextError;
  const displayLoading = isLoading || contextLoading;
  const expiredBannerStorageKey = user?.id
    ? `${EXPIRED_BANNER_STORAGE_PREFIX}:${user.id}`
    : null;

  useEffect(() => {
    if (!expiredBannerStorageKey) {
      setShowExpiredBanner(false);
      return;
    }

    if (!expiredItemsFingerprint) {
      localStorage.removeItem(expiredBannerStorageKey);
      setShowExpiredBanner(false);
      return;
    }

    const dismissedFingerprint = localStorage.getItem(expiredBannerStorageKey);
    setShowExpiredBanner(dismissedFingerprint !== expiredItemsFingerprint);
  }, [expiredBannerStorageKey, expiredItemsFingerprint]);

  const dismissExpiredBanner = () => {
    if (expiredBannerStorageKey) {
      localStorage.setItem(expiredBannerStorageKey, expiredItemsFingerprint);
    }
    setShowExpiredBanner(false);
  };

  return (
    <>
      <div className="mobile-page-enter container mx-auto grid grid-cols-1 items-start gap-5 bg-background px-4 py-5 sm:px-6 md:grid-cols-3 md:gap-6">
        <div className="w-full space-y-4">
          <ErrorAlert message={displayError ? t(displayError) : ""} onAutoHide={() => setError("")} />

          {barcodeImportSuccess && <FridgeOperationSuccess />}
          {quickUndo && (
            <FridgeOperationSuccess
              message={isUndoing ? "Undoing fridge update..." : "Fridge updated"}
              onUndo={undoLastQuickOperation}
            />
          )}

          {isBarcodeReviewOpen && (
            <section
              className="rounded-2xl border border-accent/30 bg-secondary p-4 sm:p-5"
              aria-label={t("Review barcode session")}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-text">{t("Review barcode session")}</h2>
                  <p className="mt-1 text-sm text-text/60">
                    {t("Check the product name before adding it to your fridge.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBarcodeReviewOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-text/70 hover:bg-background"
                >
                  {t("Cancel")}
                </button>
              </div>
              <FridgeOperationReview
                changes={barcodeReviewChanges}
                onChange={(change) =>
                  setBarcodeChanges((previous) =>
                    previous.map((current) =>
                      current.key === change.key ? change : current,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={confirmBarcodeImport}
                disabled={
                  isBarcodeImporting ||
                  !barcodeReviewChanges.some((change) => change.selected)
                }
                className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(isBarcodeImporting ? "Adding barcode product..." : "Add product to fridge")}
              </button>
            </section>
          )}

          {showExpiredBanner && expiredItems.length > 0 && (
            <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-4 text-sm text-amber-950 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t("Expired ingredients detected")}</p>
                  <p className="mt-1 text-amber-900/80">
                    {t("Review these items before they affect your next recipe:")}
                    {" "}
                    {expiredItems.map((item) => item.name).join(", ")}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissExpiredBanner}
                  className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200/70"
                >
                  {t("Dismiss")}
                </button>
              </div>
            </div>
          )}

          <div className="ambient-gradient-card rounded-2xl border border-accent/30 bg-accent/10 p-3 sm:p-3.5">
            <div className="mb-2.5 px-1">
              <h2 className="text-sm font-semibold text-text/75">
                {t("Quick Add Options")}
              </h2>
              <p className="text-xs text-text/55">
                {t("Choose how you want to add products to your fridge.")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={startBarcodeSession}
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl border border-accent/35 bg-background px-3 py-2 text-center transition-colors hover:bg-accent/20"
              >
                <span className="text-sm font-semibold text-text">
                  {t("Scan Barcode")}
                </span>
                <span className="mt-0.5 text-[11px] text-text/60">
                  {t("Use your camera")}
                </span>
              </button>
              <button
                onClick={() => setIsReceiptScannerOpen(true)}
                disabled={true}
                title={t("Coming soon")}
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl border border-accent/20 bg-background/50 px-3 py-2 text-center opacity-60 cursor-not-allowed"
              >
                <span className="text-sm font-semibold text-text">
                  {t("Scan Receipt")}
                </span>
                <span className="mt-0.5 text-[11px] text-text/60">
                  {t("Coming soon")}
                </span>
              </button>
              <button
                onClick={generateZeroWasteRecipe}
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl bg-accent px-3 py-2 text-center shadow-[0_8px_18px_rgba(255,212,60,0.3)] transition-colors hover:bg-accent/90"
              >
                <span className="text-sm font-semibold text-text">
                  {t("Use Expiring Soon")}
                </span>
                <span className="mt-0.5 text-[11px] text-text/70">
                  {t("Generate zero-waste recipe")}
                </span>
              </button>
            </div>
          </div>

          <AddFridgeItemForm
            newItem={newItem}
            setNewItem={handleNewItemChange}
            newItemDate={newItemDate}
            handleDateChange={handleDateChange}
            unit={unit}
            setUnit={setUnit}
            amount={amount}
            setAmount={setAmount}
            addItem={addItem}
            showNameError={showNameError}
            dateError={dateError}
            displayLoading={displayLoading}
          />
        </div>

        <FridgeDisplay
          fridgeItems={fridgeItems}
          removeItem={removeItem}
          updateItem={updateItem}
          quickAdjustItem={quickAdjustItem}
          quickActionLoading={isLoading || isUndoing}
        />
      </div>

      <BarcodeScanner
        isOpen={isBarcodeScannerOpen}
        onClose={cancelBarcodeSession}
        onFinishScanning={finishBarcodeSession}
        detectedCount={barcodeScannedCount}
        onBarcodeDetected={handleBarcodeDetected}
      />

      <ReceiptScanner
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        onConfirm={handleScannedReceiptItems}
      />
    </>
  );
};
