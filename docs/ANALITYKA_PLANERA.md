# Kontrakt analityki planera

Ten dokument jest jedynym słownikiem zdarzeń planera. Zdarzenia mogą być
wysyłane dopiero po uzyskaniu zgody analitycznej.

## Zdarzenia

| Zdarzenie | Moment | Wymagane właściwości |
|---|---|---|
| `planner_opened` | Otwarcie planera | `entryPoint`, `isReturningUser` |
| `meal_plan_generation_requested` | Rozpoczęcie generowania | `planId`, `generationId`, `dayCount`, `slotCount`, `servings` |
| `meal_plan_generation_completed` | Zakończenie generowania | `planId`, `generationId`, `successfulSlotCount`, `failedSlotCount`, `durationMs`, `result` |
| `meal_plan_slot_swapped` | Wymiana propozycji | `planId`, `slotId`, `generationId`, `swapNumber`, opcjonalnie `reasonCode` |
| `meal_plan_slot_locked` | Zablokowanie lub odblokowanie | `planId`, `slotId`, `locked` |
| `meal_plan_accepted` | Akceptacja planu | `planId`, `fullSlotCount`, `emptySlotCount`, `durationMs` |
| `meal_plan_shopping_list_created` | Utworzenie listy | `planId`, `planVersion`, `itemCount` |
| `meal_plan_slot_cooked` | Oznaczenie ugotowania | `planId`, `slotId`, `servings` |
| `meal_plan_slot_skipped` | Pominięcie slotu | `planId`, `slotId`, opcjonalnie `reasonCode` |

## Dane zabronione

Nie wysyłać promptów, tekstu użytkownika, nazw składników, produktów z
lodówki, diet, nielubianych składników, treści przepisów ani adresów e-mail.
Identyfikatory techniczne muszą być nieprzewidywalnymi identyfikatorami, a nie
nazwami lub datami planu.

## Główny miernik

Odsetek unikalnych użytkowników, którzy w ciągu siedmiu dni od poprawnego
`meal_plan_generation_completed` zaakceptowali plan i utworzyli listę zakupów
dla tego samego `planId` i numeru wersji. Zdarzenia bez zgody nie są sztucznie
uzupełniane.
