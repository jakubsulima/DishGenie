import { useEffect, useMemo, useRef, useState } from "react";
import {
  createShoppingListItemId,
  fetchShoppingList,
  getShoppingListFingerprint,
  readShoppingList,
  ShoppingListItem,
  syncShoppingList,
  writeShoppingList,
} from "../lib/shoppingList";
import ErrorAlert from "../components/ErrorAlert";
import { useLanguage } from "../context/languageContext";
import ShoppingToFridgeReview from "../components/ShoppingToFridgeReview";
import type { FridgeOperationReviewChange } from "../components/FridgeOperationReview";
import { applyFridgeOperation, createFridgeOperationId } from "../lib/fridgeOperations";
import FridgeOperationSuccess from "../components/FridgeOperationSuccess";
import { toShoppingToFridgeChange } from "../lib/shoppingToFridge";
import { captureEvent } from "../lib/posthog";

const areItemsEqual = (a: ShoppingListItem[], b: ShoppingListItem[]) =>
  getShoppingListFingerprint(a) === getShoppingListFingerprint(b);

const hasUnsyncedLocalChanges = (
  localItems: ShoppingListItem[],
  remoteItems: ShoppingListItem[],
) => {
  if (localItems.length !== remoteItems.length) {
    return true;
  }

  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));

  return localItems.some((localItem) => {
    const remoteItem = remoteById.get(localItem.id);
    if (!remoteItem) {
      return true;
    }

    return (
      remoteItem.name !== localItem.name ||
      String(remoteItem.amount ?? "") !== String(localItem.amount ?? "") ||
      (remoteItem.unit ?? null) !== (localItem.unit ?? null) ||
      remoteItem.checked !== localItem.checked
    );
  });
};

const TrashIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ShoppingList = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<ShoppingListItem[]>(() =>
    readShoppingList(),
  );
  const [newItem, setNewItem] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncReadyRef = useRef(false);
  const syncRequestVersionRef = useRef(0);
  const lastSyncedFingerprintRef = useRef("");
  const operationIdRef = useRef<string | null>(null);
  const sourceReferenceRef = useRef<string | null>(null);
  const [reviewChanges, setReviewChanges] = useState<FridgeOperationReviewChange[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const reviewOpenedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let localItemsSnapshot = readShoppingList();

    setItems(localItemsSnapshot);
    writeShoppingList(localItemsSnapshot);

    const hydrateFromServer = async () => {
      try {
        setIsSyncing(true);
        setSyncError("");
        const localItems = localItemsSnapshot;
        const remoteItems = await fetchShoppingList();
        if (disposed) {
          return;
        }

        let resolvedItems = remoteItems;

        if (remoteItems.length > 0) {
          if (
            localItems.length > 0 &&
            hasUnsyncedLocalChanges(localItems, remoteItems)
          ) {
            resolvedItems = await syncShoppingList(localItems);
            if (disposed) {
              return;
            }
          }

          setItems(resolvedItems);
          writeShoppingList(resolvedItems);
          lastSyncedFingerprintRef.current =
            getShoppingListFingerprint(resolvedItems);
          return;
        }

        if (localItems.length > 0) {
          resolvedItems = await syncShoppingList(localItems);
          if (disposed) {
            return;
          }

          setItems(resolvedItems);
          writeShoppingList(resolvedItems);
          lastSyncedFingerprintRef.current =
            getShoppingListFingerprint(resolvedItems);
          return;
        }

        setItems([]);
        writeShoppingList([]);
        lastSyncedFingerprintRef.current = getShoppingListFingerprint([]);
      } catch {
        if (!disposed) {
          setSyncError(
            "Could not sync list with server. Using local data for now.",
          );
          localItemsSnapshot = readShoppingList();
          setItems(localItemsSnapshot);
          writeShoppingList(localItemsSnapshot);
        }
      } finally {
        if (!disposed) {
          isSyncReadyRef.current = true;
          setIsSyncing(false);
        }
      }
    };

    hydrateFromServer();

    return () => {
      disposed = true;
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    writeShoppingList(items);

    if (!isSyncReadyRef.current) {
      return;
    }

    const currentFingerprint = getShoppingListFingerprint(items);
    if (currentFingerprint === lastSyncedFingerprintRef.current) {
      return;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    const requestVersion = ++syncRequestVersionRef.current;
    const syncSnapshot = items;

    syncTimeoutRef.current = window.setTimeout(async () => {
      try {
        setIsSyncing(true);
        setSyncError("");
        const syncedItems = await syncShoppingList(syncSnapshot);
        if (requestVersion !== syncRequestVersionRef.current) {
          return;
        }

        lastSyncedFingerprintRef.current =
          getShoppingListFingerprint(syncedItems);
        setItems((previous) =>
          areItemsEqual(previous, syncedItems) ? previous : syncedItems,
        );
        writeShoppingList(syncedItems);
      } catch {
        if (requestVersion !== syncRequestVersionRef.current) {
          return;
        }
        setSyncError(
          "Could not sync latest changes. They are still saved locally.",
        );
      } finally {
        if (requestVersion === syncRequestVersionRef.current) {
          setIsSyncing(false);
        }
      }
    }, 600);

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [items]);

  const remainingCount = useMemo(
    () => items.filter((item) => !item.checked).length,
    [items],
  );

  const addManualItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) {
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: createShoppingListItemId(),
        name: trimmed,
        amount: null,
        unit: null,
        checked: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewItem("");
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearChecked = () => {
    setItems((prev) => prev.filter((item) => !item.checked));
  };

  const checkAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, checked: true })));
  };

  const openShoppingToFridgeReview = async () => {
    try {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      ++syncRequestVersionRef.current;
      setIsSyncing(true);
      setSyncError("");
      const syncedItems = await syncShoppingList(items);
      lastSyncedFingerprintRef.current = getShoppingListFingerprint(syncedItems);
      setItems(syncedItems);
      writeShoppingList(syncedItems);
      const checkedItems = syncedItems.filter((item) => item.checked);
      setReviewChanges(checkedItems.map(toShoppingToFridgeChange));
      operationIdRef.current = createFridgeOperationId();
      sourceReferenceRef.current = createFridgeOperationId();
      reviewOpenedAtRef.current = Date.now();
      captureEvent("shopping_to_fridge_review_opened", {
        itemCount: checkedItems.length,
      });
      setImportError("");
      setImportSuccess(false);
      setIsReviewOpen(true);
    } catch {
      setImportError("Could not prepare the fridge import. Try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateReviewChange = (updated: FridgeOperationReviewChange) => {
    setReviewChanges((previous) =>
      previous.map((change) => {
        if (change.key !== updated.key) {
          return change;
        }
        if (updated.amount !== change.amount && updated.quantityAccuracy === change.quantityAccuracy) {
          return { ...updated, quantityAccuracy: updated.amount ? "EXACT" : "UNKNOWN" };
        }
        return updated;
      }),
    );
  };

  const confirmShoppingToFridgeImport = async () => {
    const selectedChanges = reviewChanges.filter((change) => change.selected);
    if (selectedChanges.length === 0 || isImporting) {
      return;
    }

    const operationId = operationIdRef.current ?? createFridgeOperationId();
    operationIdRef.current = operationId;
    try {
      setIsImporting(true);
      setImportError("");
      const response = await applyFridgeOperation({
        operationId,
        source: "SHOPPING_LIST",
        sourceReference: sourceReferenceRef.current ?? operationId,
        changes: selectedChanges.map((change) => ({
          type: "ADD",
          clientChangeId: change.clientChangeId ?? change.key,
          name: change.name,
          amount: change.amount ? Number(change.amount) : undefined,
          unit: change.unit || undefined,
          quantityAccuracy: change.quantityAccuracy,
        })),
      });

      captureEvent("shopping_to_fridge_confirmed", {
        itemCount: selectedChanges.length,
        correctionCount: selectedChanges.filter(
          (change) =>
            change.quantityAccuracy !== "ESTIMATED" ||
            change.amount !== change.originalAmount,
        ).length,
        durationMs: reviewOpenedAtRef.current
          ? Date.now() - reviewOpenedAtRef.current
          : undefined,
      });

      const importedIds = new Set(
        response.appliedChanges
          .map((change) => change.clientChangeId)
          .filter((id): id is string => Boolean(id)),
      );
      const remainingItems = items.filter((item) => !importedIds.has(item.id));
      operationIdRef.current = null;
      sourceReferenceRef.current = null;
      setItems(remainingItems);
      writeShoppingList(remainingItems);
      setReviewChanges(remainingItems.filter((item) => item.checked).map(toShoppingToFridgeChange));
      setImportSuccess(importedIds.size > 0);
      if (remainingItems.length === 0 || remainingItems.every((item) => !item.checked)) {
        setIsReviewOpen(false);
      }
      try {
        const syncedItems = await syncShoppingList(remainingItems);
        lastSyncedFingerprintRef.current = getShoppingListFingerprint(syncedItems);
        setItems(syncedItems);
        writeShoppingList(syncedItems);
      } catch {
        setSyncError("Could not sync the remaining list. It is still saved locally.");
      }
    } catch {
      captureEvent("shopping_to_fridge_failed", {
        itemCount: selectedChanges.length,
      });
      setImportError("Could not update the fridge. No list items were removed.");
    } finally {
      setIsImporting(false);
    }
  };

  const completedCount = items.length - remainingCount;
  const allChecked = items.length > 0 && items.every((item) => item.checked);

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl bg-background px-4 py-6 sm:px-6">
      <div className="mb-6 overflow-hidden rounded-3xl border border-accent/35 bg-secondary p-6">
        <h1 className="text-3xl font-bold text-text sm:text-4xl">
          {t("Shopping List")}
        </h1>
        <p className="mt-2 text-sm text-text/60 sm:text-base">
          {t("Keep your next recipe run organized and check items as you shop.")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-text">
            {t("{count} left", { count: remainingCount })}
          </span>
          <span className="rounded-full border border-accent/35 bg-background px-3 py-1.5 text-sm text-text/75">
            {t("{count} completed", { count: completedCount })}
          </span>
          <span className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-sm text-text/75">
            {t(isSyncing ? "Syncing..." : "Synced")}
          </span>
        </div>
      </div>

      <ErrorAlert
        message={syncError ? t(syncError) : ""}
        compact
        className="mb-4"
        onAutoHide={() => setSyncError("")}
      />

      {importError && (
        <ErrorAlert
          message={t(importError)}
          compact
          className="mb-4"
          onAutoHide={() => setImportError("")}
        />
      )}

      {importSuccess && <FridgeOperationSuccess />}

      {completedCount > 0 && (
        <button
          type="button"
          onClick={openShoppingToFridgeReview}
          disabled={isSyncing}
          className="mb-5 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-text shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Finish shopping")}
        </button>
      )}

      {isReviewOpen && (
        <section className="mb-5 rounded-2xl border border-accent/30 bg-secondary p-4 sm:p-5" aria-label={t("What to add to the fridge?")}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-text">{t("What to add to the fridge?")}</h2>
              <p className="mt-1 text-sm text-text/60">{t("Review the items before updating your fridge.")}</p>
            </div>
            <button type="button" onClick={() => setIsReviewOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-text/70 hover:bg-background">
              {t("Cancel")}
            </button>
          </div>
          <ShoppingToFridgeReview items={reviewChanges} onChange={updateReviewChange} />
          <button
            type="button"
            onClick={confirmShoppingToFridgeImport}
            disabled={isImporting || reviewChanges.every((change) => !change.selected)}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(isImporting ? "Updating fridge..." : "Add selected to fridge")}
          </button>
        </section>
      )}

      <div className="mb-5 rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
        <label className="mb-2 block text-sm font-medium text-text">
          {t("Add item manually")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addManualItem();
              }
            }}
            placeholder={t("e.g. Tomatoes")}
            className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2.5 text-text placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={addManualItem}
            className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-text shadow-[0_10px_22px_rgba(255,212,60,0.28)] transition-colors hover:bg-accent/90"
          >
            {t("Add")}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-secondary p-4 sm:p-5">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-accent/35 bg-background px-4 py-8 text-center">
            <p className="font-medium text-text/80">
              {t("Your shopping list is empty.")}
            </p>
            <p className="mt-1 text-sm text-text/60">
              {t("Add items above or generate a list from a recipe.")}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-text/80">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => checkAll()}
                  disabled={allChecked}
                  aria-label={t("Check all items")}
                  className="h-4 w-4 rounded border-primary/30 accent-accent focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45"
                />
                <span>{t("Check all")}</span>
              </label>

              <button
                onClick={clearChecked}
                disabled={completedCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("Clear Checked")}
                <TrashIcon />
              </button>
            </div>

            <ul className="space-y-2.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-background px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      aria-label={t("Mark {name} as bought", { name: item.name })}
                      className="h-4 w-4 rounded border-primary/30 accent-accent focus:ring-2 focus:ring-accent/50"
                    />
                    <span
                      className={`truncate ${
                        item.checked ? "text-text/40 line-through" : "text-text"
                      }`}
                    >
                      {item.name}
                      {item.amount ? ` - ${item.amount}` : ""}
                      {item.unit ? ` ${item.unit}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label={t("Remove {name}", { name: item.name })}
                    title={t("Remove item")}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-text/60 transition-colors hover:bg-accent/15 hover:text-accent"
                  >
                    {t("Remove")}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default ShoppingList;
