# Recipe AI

Recipe AI helps a person track the food they have available and use it to plan or generate recipes.

## Language

**Fridge Item**:
A food item the user has available at home, whether it is a raw ingredient, packaged product, or receipt-scanned grocery item.
_Avoid_: Product, fridge product

**Fridge Ingredient**:
The existing implementation term for a **Fridge Item**.
_Avoid_: Using this as user-facing product language

## Relationships

- A **Fridge Item** belongs to exactly one user.
- A **Fridge Item** may have an amount, unit, and expiration date.
- Two **Fridge Items** with the same name, unit, and expiration date are treated as the same item and should be merged.
- Changing a **Fridge Item** unit does not convert its amount.
- A **Fridge Item** name is required; its amount, unit, and expiration date are optional.
- A **Fridge Item** amount cannot be negative.
- Setting a **Fridge Item** amount to zero removes the item.
- Editing a **Fridge Item** is a lightweight correction workflow that should work well for repeated mobile use.

## Example dialogue

> **Dev:** "When editing a **Fridge Item**, should the user be able to change only the amount?"
> **Domain expert:** "No - a **Fridge Item** can represent a broader grocery item, so the user should be able to correct its name, amount, unit, and expiration date."
> **Dev:** "If editing a **Fridge Item** makes it match another item, should both stay separate?"
> **Domain expert:** "No - matching **Fridge Items** should merge into one item."
> **Dev:** "If the user changes milk from liters to milliliters, do we convert the amount?"
> **Domain expert:** "No - unit changes are literal corrections and should not change the amount."
> **Dev:** "Can the user remove an expiration date after adding it?"
> **Domain expert:** "Yes - only the **Fridge Item** name is required."
> **Dev:** "Can a **Fridge Item** be saved with a negative amount?"
> **Domain expert:** "No - invalid edits should be corrected before saving."
> **Dev:** "Does zero mean the user has none left?"
> **Domain expert:** "Yes - setting a **Fridge Item** amount to zero removes it."
> **Dev:** "Should correcting several receipt-scanned **Fridge Items** require opening a separate screen?"
> **Domain expert:** "No - editing should stay lightweight and easy to repeat on mobile."

## Flagged ambiguities

- "product" was used to mean **Fridge Item**; resolved: use **Fridge Item** for the broader user-facing concept.

## Weekly meal planning

- The planner has only two primary views: Week and Shopping. Meal actions live in the card menu or recipe details. Prices, history, weekly exceptions and purchase corrections are collapsed by default; do not restore a separate Today view or expose all advanced actions on the cards.
- A Meal Plan belongs to one user and contains versioned meal snapshots. Editing a snapshot never changes the library recipe.
- Budget is an optional soft preference, separate from known shopping cost. Unknown prices are not zero.
- Shopping uses one store by default. Selecting two chains compares single-store alternatives; splitting requires an explicit choice.
- A loyalty card and confirmation of a specific coupon are separate permissions.
- One Shopping Trip is the shared shopping view for a visit. Plan requirements and selected manual extras retain their source IDs; changing meals never deletes manual extras or purchase history. Legacy plan checklists remain readable.
- A Cooking Batch is one cooking with a recipe snapshot and prepared portions. Meal slots allocate portions. Raw ingredients are counted and consumed once per batch; eating portions does not consume them again.
- Current Fridge Items determine availability. Imported purchases are historical evidence, never an additional stock balance. Unknown quantities require review.
- The v4 week starts with one durable intent. PRACTICAL planning works without prices; promotion-first planning is an explicit mode. Dated exceptions and coupon confirmations do not carry to the next week.
- A completed Shopping Trip and a cooked batch preserve their facts. Revisions verify plan, inventory and dependent versions before applying. Free prepared portions may move to another week with a server-side allocation ledger.
- The current implementation and its fresh verification are documented in docs/WDROZENIE_CYKLU_JADLOSPISU_I_ZAKUPOW.md.
- Store promotion validity is not a food expiration date. Current automatic source acceptance and API details are recorded in docs/WDROZENIE_TYGODNIA_Z_OKAZJI.md.
- Automatic promotion collection targets ingredients for preparing meals: produce, dairy, protein foods, dry staples and cooking fats/seasonings. Ready-made sweet pastries, sweets and snack products are excluded, including previously cached imports. User recipes and private prices remain editable independently.

- In schema 4, catalog prices guide meal choices but missing prices do not block generation. Legacy schema 2/3 strict promotion coverage remains unchanged. Profile preference DTOs must be mapped inside a read transaction so the background worker can read disliked ingredients without an HTTP persistence session.
