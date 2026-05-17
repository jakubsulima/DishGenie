import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddFridgeIngredientInput,
  UpdateFridgeIngredientInput,
  unitType,
  useFridge,
} from "../context/fridgeContext";
import { useUser } from "../context/context";
import { formatDateForBackend, lookupProductByBarcode } from "../lib/hooks";
import AddFridgeItemForm from "../components/AddFridgeItemForm";
import FridgeDisplay from "../components/FridgeDisplay";
import BarcodeScanner from "../components/BarcodeScanner";
import ReceiptScanner from "../components/ReceiptScanner";
import ErrorAlert from "../components/ErrorAlert";

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

const EXPIRED_BANNER_STORAGE_PREFIX = "recipeai.expiredBannerDismissed";

export const Fridge = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const {
    fridgeItems,
    loading: contextLoading,
    error: contextError,
    addFridgeItem,
    addFridgeItemsBatch,
    removeFridgeItem,
    updateFridgeItem,
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
  const isBarcodeAddInFlight = useRef(false);

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

  const handleBarcodeDetected = async (barcode: string) => {
    if (isBarcodeAddInFlight.current) {
      return;
    }

    isBarcodeAddInFlight.current = true;
    setError("");
    setIsLoading(true);
    try {
      const productName = await lookupProductByBarcode(barcode);
      if (!productName) {
        setError("Barcode scanned, but no product name was found.");
        return;
      }

      await addFridgeItem({
        name: productName,
        expirationDate: null,
        unit: "",
        amount: "",
      });
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Could not fetch product details for this barcode.",
        ),
      );
    } finally {
      setIsLoading(false);
      isBarcodeAddInFlight.current = false;
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
          <ErrorAlert message={displayError} onAutoHide={() => setError("")} />

          {showExpiredBanner && expiredItems.length > 0 && (
            <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-4 text-sm text-amber-950 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Expired ingredients detected</p>
                  <p className="mt-1 text-amber-900/80">
                    Review these items before they affect your next recipe:
                    {" "}
                    {expiredItems.map((item) => item.name).join(", ")}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissExpiredBanner}
                  className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200/70"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="ambient-gradient-card rounded-2xl border border-accent/30 bg-accent/10 p-3 sm:p-3.5">
            <div className="mb-2.5 px-1">
              <h2 className="text-sm font-semibold text-text/75">
                Quick Add Options
              </h2>
              <p className="text-xs text-text/55">
                Choose how you want to add products to your fridge.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={() => setIsBarcodeScannerOpen(true)}
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl border border-accent/35 bg-background px-3 py-2 text-center transition-colors hover:bg-accent/20"
              >
                <span className="text-sm font-semibold text-text">
                  Scan Barcode
                </span>
                <span className="mt-0.5 text-[11px] text-text/60">
                  Use your camera
                </span>
              </button>
              <button
                onClick={() => setIsReceiptScannerOpen(true)}
                disabled={true}
                title="Coming soon"
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl border border-accent/20 bg-background/50 px-3 py-2 text-center opacity-60 cursor-not-allowed"
              >
                <span className="text-sm font-semibold text-text">
                  Scan Receipt
                </span>
                <span className="mt-0.5 text-[11px] text-text/60">
                  Coming soon
                </span>
              </button>
              <button
                onClick={generateZeroWasteRecipe}
                className="mobile-soft-press flex min-h-16 flex-col items-center justify-center rounded-xl bg-accent px-3 py-2 text-center shadow-[0_8px_18px_rgba(255,212,60,0.3)] transition-colors hover:bg-accent/90"
              >
                <span className="text-sm font-semibold text-text">
                  Use Expiring Soon
                </span>
                <span className="mt-0.5 text-[11px] text-text/70">
                  Generate zero-waste recipe
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
        />
      </div>

      <BarcodeScanner
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
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
