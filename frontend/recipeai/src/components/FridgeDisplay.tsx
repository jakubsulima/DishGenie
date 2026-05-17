import React, { useMemo } from "react";
import {
  FridgeIngredient,
  UpdateFridgeIngredientInput,
} from "../context/fridgeContext";
import FridgeIngredientContainer from "./FridgeIngredientContainer";

interface FridgeDisplayProps {
  fridgeItems: FridgeIngredient[];
  removeItem: (id: number) => void;
  updateItem: (id: number, item: UpdateFridgeIngredientInput) => Promise<void>;
}

const FridgeDisplay: React.FC<FridgeDisplayProps> = ({
  fridgeItems,
  removeItem,
  updateItem,
}) => {
  const sortedItems = useMemo(
    () =>
      [...fridgeItems].sort((a, b) => {
        if (!a.expirationDate && !b.expirationDate) {
          return a.name.localeCompare(b.name);
        }
        if (!a.expirationDate) {
          return 1;
        }
        if (!b.expirationDate) {
          return -1;
        }

        const [aDay, aMonth, aYear] = a.expirationDate.split("-");
        const [bDay, bMonth, bYear] = b.expirationDate.split("-");
        const aDate = new Date(`${aYear}-${aMonth}-${aDay}`).getTime();
        const bDate = new Date(`${bYear}-${bMonth}-${bDay}`).getTime();
        return aDate - bDate;
      }),
    [fridgeItems],
  );

  return (
    <div className="mobile-card-enter mobile-card-delay-1 ambient-gradient-card md:col-span-2 w-full rounded-xl border border-primary/5 bg-secondary p-5 shadow-sm sm:p-6 min-h-[320px] md:min-h-[380px] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-text">My Fridge</h1>
        <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-accent/20 border border-accent/35 text-text">
          {sortedItems.length} item{sortedItems.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mt-1">
        {sortedItems.map((item: FridgeIngredient) => (
          <li key={item.id}>
            <FridgeIngredientContainer
              id={item.id}
              name={item.name}
              expirationDate={item.expirationDate}
              amount={item.amount || ""}
              unit={item.unit}
              remove={() => removeItem(item.id)}
              onUpdateItem={updateItem}
            />
          </li>
        ))}
      </ul>
      {sortedItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-primary/20 rounded-xl py-12 mt-2 mb-2 bg-background/60">
          <svg
            className="w-12 h-12 text-primary/20 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-text/70 font-medium text-lg">
            No ingredients in your inventory
          </p>
          <p className="text-text/50 text-sm mt-2 max-w-[250px] mx-auto">
            Add your first ingredient to start tracking what you have at home
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(FridgeDisplay);
