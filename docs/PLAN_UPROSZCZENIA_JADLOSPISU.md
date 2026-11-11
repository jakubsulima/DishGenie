# Plan uproszczenia zakładki Jadłospis

Data: 6 listopada 2026 r.
Status: wszystkie cztery etapy wdrożone lokalnie; bez publikacji produkcyjnej. Wyniki weryfikacji zapisano na końcu dokumentu.

## Cel

Maksymalnie uprościć wygląd i obsługę jadłospisu, szczególnie na telefonie. Użytkownik ma od razu zobaczyć dania i łatwo uzupełnić tydzień, wymienić posiłek oraz przejść do zakupów.

Zakładka ma dwa widoki: **Posiłki** i **Zakupy**. Domyślnie pokazuje cały tydzień jako listę dni. Ustawienia, promocje, porównania sklepów oraz edycja przepisu pozostają dostępne na żądanie.

Dokument określa docelowe UX. Reguły domenowe z `CONTEXT.md` i aktualne kontrakty API nadal obowiązują. Historyczne roadmapy nie są dowodem aktualnego działania funkcji.

## Punkt wyjścia i dowody

Sprawdzono kod komponentów oraz działający widok mobilny `/MealPlanner`, formularz nowego planu i istniejący częściowy plan.

- Przed pierwszym daniem znajdują się nagłówek, wybór planu, panel akcji, oferty oraz porównanie cen. Na telefonie wymagają przewinięcia kilku ekranów.
- Wypełniona karta posiłku pokazuje sześć przycisków, w tym osobne przyciski zmiany porcji.
- Puste miejsca zajmują duże karty z kilkoma akcjami.
- Formularz od razu pokazuje parametry posiłków, budżet, sklepy, datę zakupów, karty lojalnościowe i dodatkowe preferencje.
- Wejście bez parametru `plan` otwiera formularz nawet wtedy, gdy istnieje zapisany plan.
- Kod zawiera generowanie w tle, blokady dań, wersjonowanie, edycję przepisu, wyceny i niezależną checklistę planu.

Podczas audytu nie uruchamiano generowania, akceptacji ani zmian zakupów. Nie wykonano testów automatycznych; obecności kodu i istniejących testów nie należy traktować jako świeżej weryfikacji całego przepływu.

Główne pliki:

- `frontend/recipeai/src/pages/MealPlanner.tsx`
- `frontend/recipeai/src/components/MealPlanSlotCard.tsx`
- `frontend/recipeai/src/components/MealPlanForm.tsx`
- `frontend/recipeai/src/components/MealPlanRevision.tsx`
- `frontend/recipeai/src/components/MealPlanOffers.tsx`
- `frontend/recipeai/src/components/MealPlanPricing.tsx`
- `frontend/recipeai/src/components/PlanShoppingGroups.tsx`
- `frontend/recipeai/src/lib/mealPlans.ts`

## Docelowy układ

```text
Jadłospis                 6–12 lis ▾    ⋯
2 osoby · 1 z 14 posiłków

[ Posiłki ]       [ Zakupy ]

[ Uzupełnij tydzień ]

Piątek, 6 listopada
Lunch
Sałatka z pieczonym jabłkiem
30 min · 2 porcje           Zamień   ⋯

Obiad
+ Dodaj danie

Sobota, 7 listopada
…
```

- Kliknięcie nazwy dania otwiera szczegóły przepisu.
- Na telefonie szczegóły otwierają się w panelu dostosowanym do małego ekranu; na desktopie mogą być panelem bocznym lub dialogiem.
- Karta ma maksymalnie dwie widoczne akcje: „Zamień” i menu `⋯`.
- Menu zawiera zmianę porcji, „Zachowaj przy zmianie planu”, pominięcie oraz „Edytuj przepis”. Stan zachowania dania ma być widoczny także po zamknięciu menu.
- Edytor i podgląd zmian wykorzystują istniejące operacje rewizji; nie rozpychają listy dni.
- Długie nazwy mogą się zawijać. Nie stosować sztywnej wysokości karty kosztem czytelności.
- Funkcje muszą działać bez najechania kursorem. Menu i panele wymagają obsługi klawiatury, widocznego fokusu, zamknięcia i powrotu fokusu do wywołującego elementu.

## Najważniejsze zmiany

| Kolejność | Zmiana | Zakres i zależności | Efekt | Ryzyko / ograniczenie |
|---|---|---|---|---|
| 1 | Posiłki na początku strony | Krótki nagłówek, przełącznik Posiłki/Zakupy, zachowanie stanu widoków; oferty i porównanie sklepów w Zakupach | Dania widoczne od razu | Promocje mniej eksponowane |
| 2 | Kompaktowe karty posiłków | Typ, nazwa, czas, porcje, Zamień i menu; wspólny panel przepisu i edycji | Mniej przycisków i krótsza strona | Rzadsze akcje wymagają dodatkowego kliknięcia |
| 3 | Małe puste miejsca | Jeden wiersz „+ Dodaj danie”, generujący propozycję przez istniejącą operację; pominięcie i porcje w menu | Pusty tydzień łatwy do przejrzenia | Trzeba zachować możliwość przywrócenia pominiętego posiłku |
| 4 | Krótki formularz startowy | Od kiedy, ile dni, dla ilu osób, jakie posiłki; pozostałe pola pod Dostosuj; zapisane preferencje i walidacja zachowane | Szybsze rozpoczęcie | Sklep i data zakupów muszą pozostać widoczne w krótkim podsumowaniu |
| 5 | Jedna główna akcja zależna od stanu | Pusty: Zaplanuj tydzień; częściowy: Uzupełnij tydzień; gotowy: Przejdź do zakupów; istniejące generowanie i akceptacja | Mniej konkurujących decyzji | Częściowy plan także musi pozwalać przejść do zakupów przez akcję drugorzędną |
| 6 | Otwarcie właściwego zapisanego planu | Jawny parametr plan ma pierwszeństwo; bez niego plan obejmujący dzisiaj, następnie najbliższy przyszły, następnie ostatni | Szybki powrót do swoich dań | Nowy plan musi być jednoznacznie dostępny i nie może zostać zastąpiony automatycznym przekierowaniem |

### Szczegóły nawigacji i głównej akcji

- Wybrany zakres dat zastępuje stale widoczny formularz wyboru zapisanych jadłospisów. Historia i Nowy plan są dostępne z nagłówka/menu.
- Wejście w Nowy plan musi mieć jawny stan lub parametr odróżniający je od zwykłego wejścia na `/MealPlanner`.
- Przy wielu planach obejmujących dzisiaj wybrać ostatnio utworzony; przy tej samej dacie przyszłych planów także użyć jednoznacznego porządku. Sprawdzić dostępne pola podsumowań przed implementacją; rozszerzać API tylko jeśli jest to konieczne.
- Uzupełnianie tygodnia nie zastępuje istniejących dań. Ponowne ułożenie planu z ofert jest odrębną akcją drugorzędną z jasną informacją, że zastępuje niezablokowane posiłki.
- Samo otwarcie widoku Zakupy nie akceptuje planu. Utworzenie checklisty wymaga świadomego kliknięcia. Można wykorzystać istniejący endpoint akceptacji, a po powodzeniu pokazać checklistę.
- Gotowa checklista powinna otwierać się bez ponownej akceptacji.

## Średni priorytet

| Zmiana | Zakres i zależności | Efekt / ograniczenie |
|---|---|---|
| Zakupy zaczynają się od checklisty | Lista planu na początku; krótka wycena obok; porównanie sklepów i oferty rozwijane poniżej | Mniej czytania. Niepełna cena musi być opisana bez otwierania szczegółów, np. „Wycenione pozycje: 42 zł · 3 bez ceny” |
| Jeden komunikat postępu | „Układamy posiłki: 4/14” i możliwość zatrzymania; odczyt stanu po powrocie, ponawianie bez duplikatów | Usuwa powtórzenia. Nie ukrywać błędu ani informacji o wykorzystaniu limitu AI w miejscu uruchamiania generowania |
| Lżejszy wygląd | Mniej zagnieżdżonych kart i obramowań, delikatne separatory, małe zaokrąglenia, czytelna typografia, wygodne pola dotykowe | Jeden mocny przycisk na widok; czytelność i kontrast zachowane |
| Prostszy język | „Zablokuj danie” → „Zachowaj przy zmianie planu”; „Popraw przepis” → „Edytuj przepis”; krótkie wyjaśnienia przy czynności | Aktualizacja PL i EN; bez technicznych opisów architektury w głównej ścieżce |

## Reguły, które wdrożenie musi zachować

- Budżet to opcjonalna miękka preferencja; nie blokuje akceptacji.
- Brak ceny nie oznacza zera. Niepełnej wyceny nie przedstawiać jako pełnego kosztu ani dowodu oszczędności.
- Dwie wybrane sieci domyślnie oznaczają porównanie zakupów w jednym sklepie. Podział zakupów wymaga osobnego wyboru.
- Posiadanie karty lojalnościowej nie oznacza potwierdzenia konkretnego kuponu.
- Checklista planu pozostaje niezależna od ręcznej listy zakupów.
- Rewizje zachowują odhaczenia niezmienionych wymagań; zmienione ilości wymagają ponownego sprawdzenia zgodnie z istniejącymi regułami.
- Zmiana przepisu w planie nie zmienia przepisu w bibliotece.
- Zachowane i pominięte dania respektują istniejące reguły blokowania, generowania i przywracania.
- Zachować wersjonowanie, obsługę konfliktów, idempotencję żądań, zadania w tle i bezpieczne ponawianie.
- Przełączanie paneli i kart nie może gubić szkicu edycji bez ostrzeżenia ani odtwarzać nieaktualnej wersji planu.

## Etapy wdrożenia

1. **Hierarchia strony:** krótki nagłówek, dwa widoki, posiłki na początku i główna akcja zależna od stanu.
2. **Karty i szczegóły:** kompaktowe karty, małe puste miejsca, menu, panel przepisu i edycji.
3. **Wejście i konfiguracja:** krótki formularz, dodatkowe ustawienia, wybór bieżącego planu i jawna ścieżka Nowy plan.
4. **Zakupy i dopracowanie:** checklista przed wycenami, rozwijane porównania/oferty, jeden postęp, krótsze teksty i spójne style.

Domyślne decyzje: cały tydzień jako lista, szczegóły przepisu po kliknięciu, promocje w Zakupach. Widok jednego dnia, dodatkowe tryby kalendarza i nowe funkcje biznesowe pozostają poza tym zakresem.

## Kryteria odbioru i weryfikacja

- Przy typowej mobilnej wysokości około 844 px i szerokości 390 px pierwsze danie lub pierwszy pusty slot jest widoczny bez przewijania paneli ustawień, ofert i cen. Sprawdzić również szerokość około 360 px oraz desktop.
- Wypełniona karta ma najwyżej dwie widoczne akcje; porcje i czas są w jednym krótkim wierszu, jeśli szerokość na to pozwala.
- Puste miejsce nie pokazuje całego zestawu przycisków.
- Nowy plan można utworzyć bez otwierania ustawień dodatkowych, korzystając z poprawnych preferencji domyślnych/zapisanych.
- Można otworzyć istniejący plan, jawnie utworzyć nowy oraz wrócić z odnośnika do konkretnego planu.
- Można uzupełnić częściowy plan, zatrzymać generowanie, opuścić ekran i wrócić do aktualnego postępu bez utraty dań.
- Zachowane danie jest rozpoznawalne i chronione; pominięte można przywrócić.
- Można zmienić porcje, edytować przepis, obejrzeć podgląd i zastosować rewizję.
- Częściowy plan można zaakceptować; checklista działa i zachowuje poprawne odhaczenia po zmianach i przeładowaniu.
- Niepełna wycena pozostaje jednoznaczna; kupony i podział na sklepy wymagają istniejących jawnych wyborów.
- Brak poziomego przewijania; menu i panele działają dotykiem i klawiaturą, z poprawną obsługą fokusu.
- Dostosować istniejące testy zachowań do nowego UI; wykonać typecheck, lint, adekwatne testy oraz weryfikację mobilną i desktopową. Scenariusze z mockami nie zastępują sprawdzenia dostępnego lokalnego przepływu; oddzielnie raportować sprawdzone zachowania i ograniczenia środowiska.

## Prompt wdrożeniowy

Gotowy prompt do przekazania modelowi znajduje się w [PROMPT_WDROZENIA_UPROSZCZENIA_JADLOSPISU.md](PROMPT_WDROZENIA_UPROSZCZENIA_JADLOSPISU.md).


## Wdrożenie lokalne — 6 listopada 2026

Wdrożono cztery etapy na istniejącym stanie roboczym repozytorium, zachowując wcześniejsze zmiany wycen, ofert i generowania. Historyczny opis punktu wyjścia powyżej pozostaje zapisem audytu sprzed implementacji.

1. **Hierarchia:** krótki nagłówek, historia i Nowy plan w menu, widoki Posiłki/Zakupy oraz główna akcja zależna od wypełnienia tygodnia. Zakupy częściowego planu mają osobną, świadomą akceptację. Istniejąca checklista otwiera się bez ponownej akceptacji.
2. **Karty:** nazwa otwiera natywny panel dialogowy, a Zamień i menu pozostają przy metadanych. Puste miejsce zajmuje wiersz Dodaj danie. Menu zachowuje porcje, blokadę, pomijanie, przywracanie i wejście do istniejących rewizji. Stan zachowania dania widać po zamknięciu menu. Panele obsługują Escape i przywracają fokus.
3. **Wejście i konfiguracja:** podstawowe pola formularza są widoczne, pozostałe pod Dostosuj, z podsumowaniem sklepów i daty zakupów. `?new=1` jest niezależną ścieżką; jawny `plan` ma pierwszeństwo. Bez niego wybierany jest najnowszy plan obejmujący dziś, najbliższy przyszły, potem najnowszy zapisany.
4. **Zakupy i dopracowanie:** checklista przed wyceną, krótki subtotal i liczba brakujących cen poza rozwijanym porównaniem, oferty rozwijane osobno. Jeden komunikat postępu tygodnia, zachowana możliwość zatrzymania, ponawiania i powrotu do zadania. Skrócono teksty PL/EN i ograniczono obramowania.

Zmiana kontraktu jest zgodna wstecz: lista planów przyjmuje opcjonalny `page`, nadal zwracając po 20 podsumowań. Klient pobiera kolejne strony, aby aktualny plan nie znikał z automatycznego wyboru po utworzeniu ponad 20 nowszych planów. Porządek to `createdAt DESC, id DESC`; frontend zachowuje go przy remisach. Operacje generowania, akceptacji, rewizji, cen i checklisty zachowują obecne API i wersjonowanie.

Edytory przepisów pozostają zamontowane po zamknięciu panelu i zmianie widoku, dzięki czemu szkice i podglądy nie giną. Zmiana planu lub opuszczenie strony ostrzega o niezapisanych zmianach. Nowszy zapis nie jest zastępowany spóźnionym wynikiem odpytywania. Szkic ustawień zachowuje wersję wejściową i pozwala jawnie wczytać aktualne ustawienia po konflikcie. Błędy zapisu są widoczne także wewnątrz panelu.

### Wykonana weryfikacja

- `npm run typecheck`, `npm run lint`, `npm run build`: powodzenie na Node 24.
- `vitest run --maxWorkers=2`: **128 testów w 27 plikach**, bez błędów. Obejmuje m.in. wybór planu, stronicowanie historii, jawną ścieżkę Nowy plan, częściową akceptację, idempotencję, błędy i konflikty, szkice, pominięcia/przywracanie oraz istniejące reguły cen i rewizji.
- `playwright test e2e/meal-planner.spec.ts e2e/meal-planner-simplification.spec.ts --workers=2`: **5 scenariuszy**, bez błędów. Szerokości 360/390/1440 px, długie nazwy, pierwsze danie bez przewijania, małe puste miejsca, menu, Escape, fokus panelu, szkic po zmianie widoku, częściowy plan, niepełna cena poza szczegółami, błąd limitu AI, zatrzymanie/ponowienie oraz odhaczenia po przeładowaniu.
- Java 17, izolowane testy `MealPlanIntegrationTest`, `WeeklyPlannerIntegrationTest`, `PromotionFirstPlannerIntegrationTest` i `BrowserPlannerSmokeIT`: **43 testy**, bez błędów. Uruchomiono z `RUN_BROWSER_PLANNER_SMOKE=1` i `PLANNER_TEST_NODE` wskazującym Node 24.
- `BrowserPlannerSmokeIT` dodatkowo uruchomił **2 scenariusze Chromium z rzeczywistym lokalnym API i bazą H2**: PL 390 px oraz EN 1440 px. Potwierdzono pełny tydzień po przeładowaniu, ustawienia, podgląd i zastosowanie rewizji, ponowne sprawdzenie zmienionych ilości, wybór koszyka, odhaczenia i ich trwałość, zapis/odczyt/usunięcie własnej ceny oraz ochronę zachowanego dania podczas ponownego układania planu.
- Osobno obejrzano istniejący lokalny częściowy plan przez interfejs na 390/360/1440 px, otwarto menu i przepis, sprawdzono powrót fokusu po Escape oraz widok zakupów bez akceptacji. Nie wykonywano mutacji na tym planie.
- Sprawdzono zrzuty testowych widoków mobilnych i desktopowych oraz brak poziomego przewijania. `git diff --check`: poprawny.

Ograniczenia: nie wykonano publikacji produkcyjnej, płatnych wywołań Gemini, zmian rzeczywistych danych ani ponownego odbioru bieżącego źródła cen. Generowanie w testach backendu wykorzystuje kontrolowaną odpowiedź Gemini i oferty testowe; scenariusze z mockami API są raportowane oddzielnie od przepływu z rzeczywistym lokalnym API. Nie uruchamiano całego zestawu backendu ani migracji PostgreSQL w ramach tego uproszczenia.
