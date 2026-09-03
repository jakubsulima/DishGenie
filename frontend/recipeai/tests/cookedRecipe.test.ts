import { describe, expect, test } from "vitest";
import { buildCookedRecipeFridgeChanges } from "../src/lib/cookedRecipe";

describe("buildCookedRecipeFridgeChanges", () => {
  test("matches names and converts compatible units", () => {
    expect(
      buildCookedRecipeFridgeChanges(
        [{ name: "Tomatoes", amount: 750, unit: "g" }],
        [
          { id: 1, name: "Tomato", expirationDate: null, amount: 0.5, unit: "kg" },
          { id: 2, name: "tomato", expirationDate: null, amount: 400, unit: "g" },
        ],
      ),
    ).toEqual([
      expect.objectContaining({ fridgeItemId: 1, amount: 0.5 }),
      expect.objectContaining({ fridgeItemId: 2, amount: 250 }),
    ]);
  });

  test("matches a more specific recipe name to the same base ingredient", () => {
    expect(
      buildCookedRecipeFridgeChanges(
        [{ name: "Cherry tomatoes", amount: 200, unit: "g" }],
        [{ id: 7, name: "Tomato", expirationDate: null, amount: "", unit: "" }],
      ),
    ).toEqual([
      expect.objectContaining({ fridgeItemId: 7, type: "FINISH" }),
    ]);
  });

  test("uses available amounts and finishes matching items without an amount", () => {
    expect(
      buildCookedRecipeFridgeChanges(
        [
          { name: "Milk", amount: 1, unit: "l" },
          { name: "Egg", amount: 2, unit: "pcs" },
          { name: "Salt", amount: null, unit: "g" },
        ],
        [
          { id: 3, name: "Milk", expirationDate: null, amount: 300, unit: "ml" },
          { id: 4, name: "Eggs", expirationDate: null, amount: "", unit: "pcs" },
          { id: 5, name: "Salt", expirationDate: null, amount: 20, unit: "g" },
          { id: 6, name: "Milk chocolate", expirationDate: null, amount: 100, unit: "g" },
        ],
      ),
    ).toEqual([
      expect.objectContaining({ fridgeItemId: 3, amount: 300 }),
      expect.objectContaining({ fridgeItemId: 4, type: "FINISH" }),
    ]);
  });
});
