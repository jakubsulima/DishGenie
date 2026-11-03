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

- A Meal Plan belongs to one user and contains versioned meal snapshots. Editing a snapshot never changes the library recipe.
- Budget is an optional soft preference, separate from known shopping cost. Unknown prices are not zero.
- Shopping uses one store by default. Selecting two chains compares single-store alternatives; splitting requires an explicit choice.
- A loyalty card and confirmation of a specific coupon are separate permissions.
- The plan checklist is separate from the manual shopping list. Revisions preserve checks for unchanged requirements; changed quantities need checking again.
- Store promotion validity is not a food expiration date. Current automatic source acceptance and API details are recorded in docs/WDROZENIE_TYGODNIA_Z_OKAZJI.md.
