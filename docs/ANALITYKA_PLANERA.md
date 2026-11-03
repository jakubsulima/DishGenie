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
| `meal_plan_accepted` | Akceptacja planu; `durationMs` od utworzenia planu, razem z oczekiwaniem i powrotami | `planId`, `fullSlotCount`, `emptySlotCount`, `durationMs` |
| `meal_plan_shopping_list_created` | Utworzenie listy | `planId`, `planVersion`, `itemCount` |
| `meal_plan_slot_cooked` | Oznaczenie ugotowania | `planId`, `slotId`, `servings` |
| `meal_plan_slot_skipped` | Pominięcie slotu | `planId`, `slotId`, opcjonalnie `reasonCode` |

## Zdarzenia wdrożone 3 listopada 2026

`meal_plan_generation_requested` jest wysyłane po przyjęciu trwałego zadania przez backend. `meal_plan_quote_created` zawiera wyłącznie `planId`, `planVersion`, `basketCount`. `meal_plan_revision_applied` zawiera `planId`, `slotId`, `revisionId`, `intentCode`. Nie zawierają kwot, diet, produktów, treści komentarzy ani przepisów. Obowiązuje dotychczasowa zgoda analityczna.

Zdarzenie ukończenia zadania pozostaje kontraktem do dalszego wdrożenia; bieżący worker nie wysyła go bezpośrednio i nie omija zgody. Główny miernik opisany poniżej wymaga tego uzupełnienia i deduplikacji po `generationId`. Czas akceptacji liczony od utworzenia planu jest przybliżeniem całej ścieżki: nie obejmuje czasu spędzonego w formularzu przed utworzeniem i obejmuje ewentualną długą przerwę użytkownika.

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
