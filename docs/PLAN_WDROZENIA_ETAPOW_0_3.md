# Szczegółowy plan wdrożenia Etapów 0–3

## 1. Cel i zakres

Ten dokument zamienia Etapy 0–3 z `PLAN_ROZWOJU_PRODUKTU.md` na wykonawczy plan prac dla aktualnego stanu gałęzi `develop`.

Zakres obejmuje:

- Etap 0 — pomiar i stabilną bazę jakości;
- Etap 1 — prywatność przepisów i jawne publikowanie;
- Etap 2 — trwałe porcje i wspólny język składników;
- Etap 3 — strukturalny generator i ocenę wykorzystania lodówki.

Plan nie obejmuje jeszcze modelu tygodniowego planera. Jego implementację można rozpocząć dopiero po przejściu bram jakości opisanych na końcu Etapu 3.

## 2. Założenia i decyzje domyślne

Plan przyjmuje następujące decyzje, o ile nie zostaną jawnie zmienione:

1. `develop` jest gałęzią integracyjną, a obrazy produkcyjne i wdrożenie Dokploy powstają po włączeniu zmian do domyślnej gałęzi `main`.
2. Istniejące przepisy użytkowników po migracji pozostają prywatne. Tylko jawnie wybrane przepisy kuratorowane są ponownie publikowane.
3. Kanonicznym publicznym adresem przepisu pozostaje stabilny adres oparty na liczbowym `recipe.id`, np. `/Recipe/42`. Adresy oparte na nazwie nie są kanoniczne.
4. Nazwa wpisana przez użytkownika pozostaje nazwą wyświetlaną. Normalizacja służy dopasowaniu i agregacji, ale nie nadpisuje treści widocznej w przepisie ani lodówce.
5. Niepewne dopasowania składników nie są automatycznie scalane.
6. `PRIORITIZE` i `MINIMIZE` są domyślnymi preferencjami generatora. `NONE` pozostaje osobnym, świadomie wybranym trybem bez zakupów.
7. Diety wykluczające konkretne grupy produktów oraz nielubiane składniki są twardymi ograniczeniami. Diety opisujące styl żywienia wymagają osobno zdefiniowanych reguł, zanim będą traktowane jako deterministycznie sprawdzalne.
8. Nowy kontrakt generatora powstaje jako wersjonowany endpoint. Stary endpoint pozostaje czasowo dostępny do zakończenia migracji frontendu.

## 3. Stan początkowy

| Obszar | Stan na `develop` | Konsekwencja dla planu |
|---|---|---|
| Java i CI | CI używa Javy 17; lokalne uruchomienie na Javie 25 powoduje błędy Mockito/Byte Buddy | Etap 0 ma wymusić Javę 17 również lokalnie |
| Frontend | Testy, typecheck, lint, build i podstawowe E2E przechodzą | Można rozszerzać istniejącą bazę testów |
| Prywatność | `visibility`, filtrowanie, publikacja i UI istnieją | Etap 1 to domknięcie testów, migracji i wydania |
| Porcje | `servings` jest zapisane w encji i bazie | Brakuje skalowania i wyboru liczby porcji |
| Jednostki | Istnieje `UnitConversionService` dla masy, objętości i sztuk | Trzeba wydzielić jeden kontrakt normalizacji dla wszystkich modułów |
| Nazwy składników | Dopasowanie usuwa różnice wielkości liter, odstępów i częściowo znaków diakrytycznych | Brakuje kanonicznych rekordów, aliasów oraz obsługi niepewnych dopasowań |
| Generator | Backend i frontend używają części nowego kontraktu | Frontend nadal wpisuje na stałe porcje i typ posiłku, a część ustawień przesyła w tekście |
| Wynik generatora | Serwer waliduje schemat i wylicza braki | Brakuje typowanego API, pełnej kontroli ograniczeń oraz ograniczonej regeneracji |

## 3.1. Priorytety wykonawcze

| Priorytet | Zmiana | Stan | Efekt dla użytkownika | Ryzyko |
|---|---|---|---|---|
| Najważniejszy | Powtarzalne środowisko Java 17/Node 24 i bramy testowe | Częściowo gotowe | Mniej regresji i awarii przy kolejnych wydaniach | Chwilowe wykrycie błędów ukrywanych przez różne wersje lokalne |
| Najważniejszy | Produkcyjne domknięcie prywatności | Zaimplementowane na `develop` | Użytkownik kontroluje publikację własnych przepisów | Pusty katalog publiczny po bezpiecznej migracji, jeśli nie wybrano treści kuratorowanych |
| Najważniejszy | Kanoniczne składniki, jednostki i skalowanie porcji | Częściowe | Wiarygodne ilości i zakupy dla wybranej liczby osób | Błędne automatyczne scalenie podobnych produktów |
| Najważniejszy | Generator v2 i walidacja po AI | Częściowe | Przewidywalne propozycje zgodne z ograniczeniami | Dodatkowe próby zwiększają czas i koszt generowania |
| Średni | Dashboard lejka i alerty kosztowe | Zaplanowane | Zespół widzi, czy produkt prowadzi do zaakceptowanej decyzji | Niepełne dane dla użytkowników bez zgody analitycznej |
| Średni | Administracyjne zarządzanie aliasami i produktami podstawowymi | Zaplanowane | Mniej ręcznych korekt przy kolejnych użyciach | Słownik wymaga utrzymania i kontroli jakości |
| Średni | Usunięcie starego endpointu generatora | Zaplanowane po stabilizacji v2 | Prostszy kod i mniej rozbieżnych zachowań | Zbyt wczesne usunięcie utrudni rollback frontendu |

## 4. Kolejność wydań

| Wydanie | Zakres | Zależność | Wynik |
|---|---|---|---|
| R0A | Środowisko, kontrakty analityki i testy bramowe | Brak | Powtarzalna baza jakości |
| R1A | Domknięcie prywatności i przygotowanie danych | R0A | Etap 1 gotowy do produkcji |
| R1B | Produkcyjne wydanie prywatności | R1A | Prywatność działa na produkcji |
| R2A | Addytywny model normalizacji i porcje | R1B | Można zapisywać dane kanoniczne bez łamania obecnych rekordów |
| R2B | Wspólne dopasowanie, skalowanie i agregacja | R2A | Etap 2 działa end-to-end |
| R2C | Zaostrzenie ograniczeń danych | R2B i sprawdzony backfill | Model składników jest stabilny |
| R3A | Wersjonowany kontrakt generatora | R2B | Frontend i backend wymieniają strukturalne dane |
| R3B | Walidacja, regeneracja i pełny wynik pokrycia | R3A | Generator spełnia bramę jakości Etapu 3 |
| R3C | Przełączenie ruchu i usunięcie zależności od starego kontraktu | R3B | Gotowa podstawa pod planer |

---

# Etap 0 — pomiar i stabilna baza jakości

## 0.1. Ujednolicenie środowiska

### Backend

1. Zmienić konfigurację `backendApi/build.gradle` z samego `sourceCompatibility` na Java Toolchains dla Javy 17.
2. Jawnie ustawić launcher Javy 17 dla zadań `Test`, aby Gradle uruchomiony z innej Javy nie wykonywał testów na Javie 25.
3. Zachować Javę 17 w GitHub Actions i obrazach backendu.
4. Dodać do README krótką komendę diagnostyczną sprawdzającą wersję Javy przed testami.
5. Nie rozwiązywać problemu przez zezwolenie Byte Buddy na eksperymentalną Javę 25 — docelowym środowiskiem projektu pozostaje Java 17.

### Frontend

1. Zachować Node 24 w `.nvmrc`, `package.json` i GitHub Actions.
2. Opisać użycie `nvm use` przed instalacją zależności.
3. Traktować ostrzeżenie o Node 20 jako błąd przygotowania środowiska deweloperskiego, nie jako błąd aplikacji.

### Kryteria odbioru

- `./gradlew test` uruchamia testy na Javie 17 także wtedy, gdy systemowy `java` wskazuje inną wersję.
- `npm test -- --run`, `npm run typecheck`, `npm run lint` i `npm run build` przechodzą na Node 24.
- README, `.nvmrc`, Gradle i CI wskazują te same wersje środowiska.

## 0.2. Kontrakt analityki planera

Utworzyć `docs/ANALITYKA_PLANERA.md` z jednym słownikiem zdarzeń i dozwolonych właściwości.

| Zdarzenie | Moment | Wymagane właściwości |
|---|---|---|
| `planner_opened` | Otwarcie planera | `entryPoint`, `isReturningUser` |
| `meal_plan_generation_requested` | Rozpoczęcie generowania | `planId`, `generationId`, liczba dni i slotów, liczba osób |
| `meal_plan_generation_completed` | Zakończenie generowania | `planId`, `generationId`, liczba udanych i nieudanych slotów, czas, wynik |
| `meal_plan_slot_swapped` | Pierwsza i kolejne wymiany | `planId`, `slotId`, `generationId`, numer wymiany, opcjonalny kod powodu |
| `meal_plan_slot_locked` | Zablokowanie/odblokowanie | `planId`, `slotId`, `locked` |
| `meal_plan_accepted` | Akceptacja planu | `planId`, liczba pełnych i pustych slotów, czas od utworzenia |
| `meal_plan_shopping_list_created` | Utworzenie listy | `planId`, wersja planu, liczba pozycji |
| `meal_plan_slot_cooked` | Oznaczenie ugotowania | `planId`, `slotId`, liczba porcji |
| `meal_plan_slot_skipped` | Pominięcie | `planId`, `slotId`, kod powodu, jeżeli podano |

Zabronione właściwości:

- prompt i tekst wpisany przez użytkownika;
- nazwy składników i produktów z lodówki;
- diety i nielubiane składniki;
- pełna treść przepisu;
- e-mail w zdarzeniach produktowych.

Wymagania implementacyjne:

1. `planId`, `slotId` i `generationId` są nieprzewidywalnymi identyfikatorami technicznymi, a nie nazwami ani datami planu.
2. Frontendowy typ `AnalyticsEventName` otrzymuje zdarzenia dopiero wraz z funkcją, która je emituje; nie dodawać martwego kodu blokującego `knip`.
3. Dodać test właściwości analitycznych, który odrzuca klucze `prompt`, `requestText`, `fridgeItems`, `ingredients`, `diets` i `dislikedIngredients`.
4. Zdarzenia backendowe i frontendowe nie mogą dublować tej samej operacji. Źródłem prawdy dla zakończonych operacji zapisywanych w bazie jest backend.

## 0.3. Główny miernik i raportowanie

Główny miernik:

> Odsetek użytkowników, którzy w jednym tygodniu zaakceptowali plan i utworzyli dla tej samej wersji planu listę zakupów.

Definicja techniczna:

- mianownik: unikalni użytkownicy z `meal_plan_generation_completed` zakończonym co najmniej jednym poprawnym slotem;
- licznik: ci sami użytkownicy z `meal_plan_accepted` oraz `meal_plan_shopping_list_created` dla tego samego `planId` i wersji;
- okno: siedem dni od pierwszego `meal_plan_generation_completed`;
- zdarzenia bez zgody analitycznej nie trafiają do PostHog i nie są sztucznie uzupełniane.

Po uzyskaniu dostępu do PostHog utworzyć zapisany lejek i sprawdzić, czy nie zawiera właściwości wrażliwych. Brak dostępu do PostHog nie blokuje zapisania kontraktu i testów w repozytorium, ale blokuje oznaczenie dashboardu jako zweryfikowanego.

## 0.4. Testy kontraktowe przed nowymi endpointami

1. Rozszerzyć `SecurityRoutesIntegrationTest` o macierz: gość, właściciel, inny użytkownik i administrator.
2. Dodać test integracyjny publicznej listy, wyszukiwarki, odczytu po ID i sitemap.
3. Utrzymać `DatabaseMigrationIT` na PostgreSQL 17 dla pustej bazy.
4. Dodać scenariusz aktualizacji bazy zawierającej dane sprzed migracji prywatności i porcji.
5. Dla nowego endpointu generatora najpierw zapisać testy JSON request/response, a dopiero potem kontroler.
6. E2E wykonywać na widokach mobilnym i desktopowym dla krytycznych przepływów; pozostałe warianty mogą pozostać testami komponentów.

## 0.5. Brama ukończenia Etapu 0

- [ ] Lokalny backend i CI wykonują testy na Javie 17.
- [ ] Frontend lokalnie i w CI używa Node 24.
- [ ] Istnieje wersjonowany słownik zdarzeń analitycznych.
- [ ] Istnieje test blokujący właściwości wrażliwe w analityce.
- [ ] Główny miernik ma jednoznaczną definicję.
- [ ] Testy kontraktowe prywatności przechodzą.
- [ ] Repozytorium przechodzi testy, typecheck, lint, build i podstawowe E2E.

## 0.6. Ryzyka i wycofanie

| Ryzyko | Ograniczenie |
|---|---|
| Różne środowiska lokalne | Toolchain Javy i `.nvmrc` zamiast polegania na konfiguracji systemu |
| Dane wrażliwe w PostHog | Jawna allowlista właściwości i test negatywny |
| Dublowanie zdarzeń | Backend rejestruje wynik operacji, frontend intencję i stan UI |
| Testy przechodzą tylko na H2 | Krytyczne migracje i zapytania uruchamiać również na PostgreSQL/Testcontainers |

---

# Etap 1 — prywatność przepisów i jawne publikowanie

## 1.1. Zakres już zaimplementowany

Na `develop` istnieją:

- `RecipeVisibility.PRIVATE/PUBLIC`;
- domyślna prywatność nowych przepisów;
- filtrowanie listy, wyszukiwarki, szczegółu i sitemap;
- odczyt prywatnego przepisu przez właściciela lub administratora;
- osobne operacje publikacji i wycofania;
- status widoczności i potwierdzenie publikacji w UI;
- stabilny kanoniczny URL oparty na `recipe.id`.

Tych elementów nie należy implementować ponownie. Należy je domknąć testami, migracją danych i kontrolowanym wydaniem.

## 1.2. Audyt danych przed wdrożeniem

Przed uruchomieniem migracji na produkcji wykonać wyłącznie odczytowy raport:

1. liczba wszystkich przepisów;
2. liczba przepisów według właściciela;
3. lista aktywnych publicznych adresów `/Recipe/{id}`;
4. lista przepisów kuratorowanych, które mają pozostać publiczne;
5. liczba przepisów bez właściciela lub z usuniętym użytkownikiem — oczekiwany wynik to zero.

Raport z identyfikatorami użytkowników nie powinien trafiać do publicznego repozytorium.

Decyzja wydaniowa:

- wszystkie istniejące przepisy stają się prywatne;
- administrator publikuje ponownie tylko zatwierdzoną listę kuratorowaną;
- jeśli nie ma pewnej listy kuratorowanej, bezpiecznym wynikiem jest pusty katalog publiczny.

## 1.3. Domknięcie backendu

1. Dodać integracyjne testy wszystkich publicznych odczytów:
   - lista;
   - wyszukiwarka;
   - szczegół po ID;
   - odczyt po nazwie/slug;
   - sitemap.
2. Dla prywatnego przepisu potwierdzić `404` dla gościa i innego użytkownika.
3. Potwierdzić odczyt i zarządzanie przez właściciela oraz administratora.
4. Potwierdzić, że `updateRecipe` nie może zmienić widoczności przesłanej w ogólnym DTO.
5. Dodać test, że nowe przepisy pozostają prywatne nawet wtedy, gdy klient prześle `visibility=PUBLIC`.
6. Utrzymać publiczny identyfikator numeryczny jako kanoniczny. Zmiana nazwy nie może zmienić adresu w sitemap ani linku z biblioteki.

## 1.4. Domknięcie frontendu

1. W bibliotece właściciela zawsze pokazywać `Prywatny` albo `Publiczny`.
2. Publikację wykonać jako dwustopniową akcję z komunikatem, że nazwa, opis, składniki i instrukcje staną się publiczne.
3. Po wycofaniu publikacji natychmiast zaktualizować stan karty oraz szczegółu.
4. Dla błędu publikacji przywrócić poprzedni stan lub ponownie pobrać przepis; nie pozostawiać optymistycznie błędnej etykiety.
5. Dodać test komponentu dla publikacji, wycofania, anulowania potwierdzenia i błędu API.
6. Dodać E2E: zapis prywatny → brak dla gościa → publikacja → widoczny dla gościa → wycofanie → ponownie `404`.

## 1.5. Wdrożenie produkcyjne

Kolejność:

1. wykonać backup bazy i sprawdzić możliwość odtworzenia;
2. zapisać audyt publicznych adresów;
3. uruchomić pełny pipeline na commitcie przeznaczonym do `main`;
4. wdrożyć backend z migracją oraz frontend;
5. sprawdzić migrację `visibility` i `servings`;
6. zalogować się jako administrator i opublikować zatwierdzone przepisy kuratorowane;
7. wykonać smoke test jako gość, właściciel i administrator;
8. sprawdzić sitemap i brak prywatnych przepisów w odpowiedzi publicznej;
9. obserwować błędy `404/403/5xx` i czas odpowiedzi przez pierwsze wdrożenie.

### Krytyczna zasada rollbacku

Po zastosowaniu migracji dodającej prywatność nie wolno cofać backendu do wersji, która nie filtruje `visibility`, ponieważ starszy kod mógłby ponownie ujawnić prywatne przepisy.

Dozwolone wycofanie:

- wycofanie samego frontendu;
- pozostawienie backendu obsługującego prywatność;
- poprawka backendu wdrożona do przodu;
- w ostateczności przywrócenie całej bazy i aplikacji z backupu sprzed migracji, po świadomej decyzji operacyjnej.

## 1.6. Brama ukończenia Etapu 1

- [ ] Nowy przepis jest zawsze prywatny.
- [ ] Gość i inny użytkownik otrzymują `404` dla prywatnego przepisu.
- [ ] Właściciel i administrator mogą odczytać prywatny przepis.
- [ ] Tylko właściciel i administrator mogą publikować i wycofywać publikację.
- [ ] Publiczne listy, wyszukiwarka i sitemap zawierają wyłącznie `PUBLIC`.
- [ ] Zmiana nazwy nie zmienia kanonicznego URL-a opartego na ID.
- [ ] Lista kuratorowanych przepisów została świadomie opublikowana albo zaakceptowano pusty katalog.
- [ ] Smoke test produkcyjny przeszedł dla wszystkich ról.

---

# Etap 2 — trwałe porcje i wspólny język składników

## 2.1. Docelowy model danych

Rozszerzyć istniejący model zamiast tworzyć drugi, niezależny katalog składników.

### `ingredient`

- zachować `id` jako identyfikator kanonicznego składnika;
- zachować czytelną nazwę główną;
- dodać `canonical_name`, używane wyłącznie do dokładnego dopasowania;
- dodać `is_staple`, domyślnie `false`;
- dodać indeks po `canonical_name`;
- ograniczenie unikalności włączyć dopiero po oczyszczeniu duplikatów.

### `ingredient_alias`

- `id`;
- `ingredient_id`;
- `normalized_alias`;
- opcjonalne `locale` (`pl`, `en` albo `null`);
- `created_at` i źródło aliasu, np. `CURATED` albo `USER_CONFIRMED`;
- unikalność aliasu w ramach języka dopiero po sprawdzeniu konfliktów.

### `recipe_ingredient`

- zachować powiązanie z kanonicznym `ingredient_id`;
- dodać `display_name`, aby nie zastępować nazwy wyświetlanej nazwą słownikową;
- zachować oryginalną ilość i jednostkę przepisu;
- nie zmieniać oryginalnych ilości podczas wyświetlania innej liczby porcji.

### `fridge_ingredient`

- zachować nazwę wpisaną przez użytkownika;
- dodać nullable `ingredient_id` jako potwierdzone lub bezpiecznie rozpoznane powiązanie kanoniczne;
- brak `ingredient_id` jest poprawnym stanem i nie blokuje używania produktu;
- zmiana nazwy produktu ponownie uruchamia dopasowanie, ale nie może automatycznie zmienić ilości ani jednostki.

## 2.2. Migracja addytywna R2A

Migracja musi być kompatybilna z aktualnym kodem podczas wdrożenia:

1. dodać nowe nullable kolumny i tabelę aliasów;
2. nie usuwać ani nie zmieniać znaczenia istniejących kolumn;
3. uzupełnić `recipe_ingredient.display_name` z obecnej nazwy `ingredient.name`;
4. uzupełnić `ingredient.canonical_name` przez bezpieczne: trim, lowercase i redukcję wielokrotnych odstępów;
5. przygotować raport kolizji zamiast automatycznie scalać rekordy;
6. dodać dual-read i dual-write w aplikacji;
7. dopiero po obserwacji i ręcznym rozwiązaniu kolizji dodać `NOT NULL` i indeksy unikalne w R2C.

Nie usuwać polskich znaków w zapisanej nazwie kanonicznej. Wariant bez znaków diakrytycznych powinien być aliasem, nie zastępstwem nazwy.

## 2.3. Serwisy domenowe

### `IngredientNormalizationService`

Jeden serwis używany przez:

- zapis i edycję lodówki;
- zapis przepisu;
- wynik skanowania paragonu;
- generator;
- pokrycie lodówki;
- listę zakupów.

Kontrakt wyniku:

- `EXACT_CANONICAL` — dokładna nazwa kanoniczna;
- `ALIAS` — jednoznaczny alias;
- `UNRESOLVED` — brak dopasowania;
- `AMBIGUOUS` — więcej niż jeden kandydat.

Tylko dwa pierwsze stany mogą być automatycznie agregowane. `UNRESOLVED` i `AMBIGUOUS` zachowują oddzielne pozycje.

### `MeasurementService`

Rozszerzyć lub zastąpić obecny `UnitConversionService` jednym serwisem, który:

- rozpoznaje kanoniczne jednostki `g`, `kg`, `ml`, `l`, `pcs`;
- zwraca wymiar `MASS`, `VOLUME` lub `COUNT`;
- przelicza do jednostki bazowej;
- zabrania przeliczania pomiędzy wymiarami;
- nie przelicza masy na objętość bez jawnego współczynnika dla danego składnika;
- zachowuje oryginalną jednostkę do wyświetlenia.

### `ServingScalingService`

Wejście:

- oryginalne składniki;
- `baseServings` zapisane w przepisie;
- `targetServings` wybrane przez użytkownika.

Wyjście:

- nowa lista DTO z ilością `originalAmount × targetServings / baseServings`;
- oryginalny przepis pozostaje bez zmian;
- wartości są zaokrąglane wyłącznie na granicy prezentacji, nie w kolejnych krokach obliczeń.

### `IngredientAggregationService`

1. grupuje tylko po potwierdzonym składniku kanonicznym;
2. sumuje wyłącznie zgodne wymiary;
3. wybiera czytelną jednostkę wyniku;
4. pozostawia oddzielne rekordy dla nieznanych lub niezgodnych jednostek;
5. zwraca informację o źródłach i niepewnych dopasowaniach, potrzebną później planerowi.

## 2.4. API porcji i listy z przepisu

Obecny endpoint listy zakupów przyjmuje składniki podane przez klienta. Dodać bezpieczniejszy kontrakt:

`POST /v2/shopping-list/preview-from-recipe`

```json
{
  "recipeId": 42,
  "targetServings": 4,
  "excludeStaples": true
}
```

Backend:

1. odczytuje przepis z uwzględnieniem uprawnień;
2. skaluje składniki względem zapisanych `servings`;
3. normalizuje nazwy i jednostki;
4. odejmuje lodówkę użytkownika;
5. zwraca sekcje `missing`, `available` i `unresolved`;
6. nie zapisuje listy — jest to podgląd;
7. zapis do istniejącej listy pozostaje osobną, jawną akcją użytkownika.

Stary endpoint może pozostać przez jedno wydanie dla kompatybilności, ale frontend powinien przejść na wariant oparty na `recipeId`.

## 2.5. Frontend porcji

1. Na szczególe przepisu pokazać bazową liczbę porcji.
2. Dodać sterowanie `− / liczba / +` z zakresem 1–100.
3. Skalować widoczne ilości bez modyfikowania danych przepisu.
4. Przekazywać wybraną liczbę porcji do podglądu listy zakupów.
5. Po ponownym otwarciu zapisanego przepisu wracać do bazowej liczby porcji, chyba że kontekst planera jawnie poda inną wartość.
6. Przy braku ilości lub nierozpoznanej jednostce pozostawić wartość czytelną i oznaczyć ją jako wymagającą sprawdzenia.
7. Dodać opcję pomijania produktów podstawowych, domyślnie wyłączoną do czasu zebrania danych o jej użyciu.

## 2.6. Backfill i zaostrzenie modelu R2C

Przed dodaniem ograniczeń:

1. policzyć rekordy bez `canonical_name`;
2. policzyć kolizje nazw kanonicznych;
3. policzyć niejednoznaczne aliasy;
4. sprawdzić liczbę produktów lodówki bez dopasowania — brak dopasowania jest dozwolony;
5. przepiąć `recipe_ingredient` z duplikatów do jednego kanonicznego `ingredient_id`;
6. usunąć nieużywane duplikaty dopiero po sprawdzeniu referencji;
7. dodać `NOT NULL` dla wymaganych pól i bezpieczne indeksy unikalne.

Rollback R2A polega na wyłączeniu dual-read i dalszym używaniu starych pól. R2C jest wdrożeniem do przodu; przed nim wymagany jest backup i raport zerowych kolizji.

## 2.7. Testy Etapu 2

### Jednostkowe

- `1 kg + 500 g = 1.5 kg` lub `1500 g` zgodnie z regułą prezentacji;
- `1 l + 250 ml` agreguje się;
- `2 pcs` i `300 g` nie agregują się;
- alias `pomidor` dopasowuje się do właściwego składnika, ale zachowuje wpisaną nazwę;
- niejednoznaczny alias nie jest automatycznie scalany;
- skalowanie `2 → 4` podwaja ilości;
- skalowanie nie modyfikuje oryginalnej encji;
- produkt podstawowy jest pomijany tylko przy `excludeStaples=true`.

### Integracyjne

- migracja na pustej bazie;
- migracja na bazie z różną wielkością liter, odstępami i duplikatami;
- podgląd listy odczytuje przepis po stronie serwera;
- użytkownik nie może generować podglądu z cudzego prywatnego przepisu;
- odjęcie kilku pozycji lodówki działa w jednej jednostce bazowej.

### Frontend i E2E

- zmiana porcji aktualizuje ilości;
- przeładowanie zapisanego przepisu pokazuje bazowe porcje;
- lista zakupów otrzymuje `targetServings`;
- nierozpoznane pozycje są widoczne i nie znikają;
- scenariusze mobilny i desktopowy.

## 2.8. Brama ukończenia Etapu 2

- [ ] Każdy zapisany przepis ma trwałe `servings`.
- [ ] UI skaluje składniki bez modyfikacji oryginału.
- [ ] Lista zakupów używa tej samej liczby porcji co UI.
- [ ] Jeden normalizator obsługuje lodówkę, przepisy, paragony, generator i zakupy.
- [ ] Aliasy nie niszczą nazwy wyświetlanej.
- [ ] Niezgodne wymiary i niepewne dopasowania nie są scalane.
- [ ] Backfill nie ma nierozwiązanych kolizji blokujących ograniczenia.
- [ ] Testy na PostgreSQL i E2E przechodzą.

---

# Etap 3 — strukturalny generator i ocena wykorzystania lodówki

## 3.1. Wersjonowany kontrakt API

Dodać endpoint:

`POST /v2/recipes/generate`

Przykładowe żądanie:

```json
{
  "requestText": "lekka kolacja",
  "locale": "pl",
  "count": 3,
  "servings": 2,
  "fridgePolicy": "PRIORITIZE",
  "shoppingPolicy": "MINIMIZE",
  "mustUseFridgeItemIds": [17],
  "preferences": {
    "mealType": "DINNER",
    "maxMinutes": 30,
    "effort": "LOW",
    "mood": "LIGHT",
    "flavor": "ANY"
  }
}
```

Zasady wejścia:

- `requestText` jest opcjonalnym opisem, nie miejscem na pola strukturalne;
- diety i nielubiane składniki nie są przyjmowane od klienta — backend pobiera je z konta;
- `mustUseFridgeItemIds` musi wskazywać produkty należące do użytkownika;
- gość nie może podać prywatnych identyfikatorów lodówki;
- `NONE` wymaga jawnego wyboru użytkownika i nie jest ustawiane automatycznie;
- limity długości, liczby produktów, liczby propozycji i zakresu porcji pozostają walidowane przed wywołaniem AI.

Przykładowa odpowiedź:

```json
{
  "generationId": "0f6ec244-38fd-4f29-a6ef-04d10372a5ec",
  "recipes": [
    {
      "recipe": {
        "name": "Ryż ze szpinakiem",
        "description": "...",
        "timeToPrepare": "25 min",
        "servings": 2,
        "ingredients": [],
        "instructions": [],
        "nutrition": {}
      },
      "fridgeCoverage": {
        "available": [],
        "missing": [],
        "unresolved": [],
        "coverageRatio": 0.65,
        "explanation": "..."
      },
      "constraintCheck": {
        "status": "PASSED",
        "warnings": []
      }
    }
  ],
  "warnings": []
}
```

Odpowiedź jest zawsze obiektem z tablicą `recipes`, również dla jednej propozycji. Kontroler zwraca DTO, a nie surowy JSON w `String`.

## 3.2. Migracja frontendu na pola strukturalne

1. Wydzielić frontendowy typ `RecipeGenerationOptions`.
2. `HomePage` buduje ten obiekt z kontrolek, zamiast zamieniać wszystkie ustawienia na fragmenty promptu.
3. Stan przekazać do strony przepisu przez jawny obiekt nawigacji lub dedykowany kontekst procesu; odświeżenie nie może przypadkowo wygenerować innych ustawień.
4. Mapowanie kontrolek:

| Kontrolka | Pole kontraktu |
|---|---|
| Typ posiłku | `preferences.mealType` |
| Liczba osób | `servings` |
| Limit czasu | `preferences.maxMinutes` |
| Wysiłek | `preferences.effort` |
| Użyj zawartości lodówki | `fridgePolicy` |
| Minimalizuj zakupy | `shoppingPolicy=MINIMIZE` |
| Bez zakupów | `shoppingPolicy=NONE` |
| Wskazane produkty | `mustUseFridgeItemIds` |
| Swobodny opis | `requestText` |

5. Usunąć stałe `servings=2` i `mealType=ANY` z kodu wysyłającego żądanie.
6. Wprowadzić typowany klient odpowiedzi i usunąć ręczne czyszczenie JSON dla endpointu v2.
7. Zachować obsługę starego endpointu tylko jako czasowy fallback sterowany flagą wdrożeniową.

## 3.3. Walidacja po odpowiedzi AI

Wydzielić `GeneratedRecipeValidator` uruchamiany przed zwróceniem wyniku klientowi.

Kolejność walidacji:

1. poprawność schematu i wymaganych pól;
2. zgodność liczby propozycji;
3. poprawność `servings`, ilości i jednostek;
4. obecność wszystkich jawnie wymaganych produktów;
5. brak nielubianych składników po normalizacji aliasów;
6. zgodność z twardymi regułami diety;
7. zgodność z maksymalnym czasem, jeśli czas jest możliwy do jednoznacznego odczytu;
8. ponowne, deterministyczne obliczenie pokrycia lodówki i braków.

### Reguły diet

Do kanonicznych składników dodać kontrolowane tagi potrzebne do reguł, np. `MEAT`, `FISH`, `DAIRY`, `EGG`, `GLUTEN`, `ANIMAL_PRODUCT`.

- `VEGAN`, `VEGETARIAN`, `GLUTEN_FREE` i `DAIRY_FREE` mogą być walidowane przez reguły wykluczające.
- Nielubiane składniki są zawsze wykluczeniem.
- `KETO`, `PALEO`, `MEDITERRANEAN`, `LOW_CARB` i `HIGH_PROTEIN` wymagają zaakceptowanej definicji progów lub pozostają preferencją rankingową, a nie obietnicą deterministyczną.
- Nieznany składnik w przepisie z restrykcyjną dietą nie może automatycznie otrzymać statusu `PASSED`; powinien dać `UNKNOWN` i uruchomić regenerację lub bezpieczny komunikat błędu.

## 3.4. Regeneracja i obsługa częściowej jakości

1. Maksymalnie dwie dodatkowe próby tylko dla błędu schematu albo ograniczeń.
2. Nie ponawiać automatycznie błędów autoryzacji, limitu użytkownika, rate limitu i błędów walidacji żądania.
3. Dla trzech propozycji odrzucać tylko niepoprawną propozycję, jeśli pozostałe są poprawne.
4. Uzupełnić brakującą liczbę propozycji w ograniczonej próbie zamiast regenerować poprawne wyniki.
5. Po wyczerpaniu prób zwrócić poprawne propozycje oraz ostrzeżenie o mniejszej liczbie wyników; jeżeli żadna nie jest poprawna, zwrócić kontrolowany błąd domenowy.
6. Nie logować pełnego promptu, nazw produktów ani wyników przepisów.

## 3.5. Deterministyczne pokrycie lodówki

Pokrycie oblicza kod aplikacji po walidacji przepisu:

1. skaluje składniki do żądanej liczby porcji;
2. rozwiązuje kanoniczne składniki i aliasy;
3. agreguje pasujące pozycje lodówki w jednostkach bazowych;
4. dzieli wynik na `available`, `missing` i `unresolved`;
5. wylicza `coverageRatio` tylko z pozycji o rozpoznanej ilości i jednostce;
6. traktuje brak ilości w lodówce jako informację „produkt prawdopodobnie jest”, ale nie jako pełne pokrycie ilościowe;
7. przygotowuje kod powodu rekomendacji, np. `USES_EXPIRING_ITEM`, `HIGH_FRIDGE_COVERAGE`, `LOW_SHOPPING_NEED`;
8. lokalizuje tekst wyjaśnienia na podstawie kodu, zamiast przechowywać logikę produktu wyłącznie w tekście AI.

AI może przygotować kulinarne uzasadnienie, ale nie jest źródłem wartości `missing`, `available`, `coverageRatio` ani wyniku ograniczeń.

## 3.6. UI wyniku generatora

Każda propozycja pokazuje:

- nazwę, czas, wysiłek i porcje;
- `Masz`;
- `Brakuje`;
- `Do sprawdzenia`, jeśli istnieją nierozpoznane pozycje;
- `Dlaczego pasuje`;
- jasną etykietę `Minimalizuje zakupy` albo `Bez zakupów`;
- ostrzeżenie, jeżeli zwrócono mniej propozycji niż żądano.

Stany wymagane w UI:

- ładowanie;
- częściowy sukces;
- brak poprawnych propozycji;
- timeout;
- rate limit;
- wyczerpany limit planu użytkownika;
- błąd sieci i możliwość ponowienia;
- wynik po ponowieniu bez podwójnego zapisu.

## 3.7. Obserwowalność i koszt

Rejestrować bez danych wrażliwych:

- `generationId`;
- liczbę żądanych i zwróconych propozycji;
- liczbę prób;
- czas pierwszej odpowiedzi i całej operacji;
- model główny lub fallback jako kod techniczny;
- wynik `success`, `partial`, `validation_failed`, `provider_failed`, `timeout`;
- przyczynę odrzucenia jako kod, nie treść składnika;
- szacowany koszt, jeśli dostawca zwraca użycie tokenów.

Alerty operacyjne:

- wzrost `validation_failed`;
- wzrost użycia fallbacku;
- przekroczenie uzgodnionego czasu odpowiedzi;
- nagły wzrost średniej liczby prób;
- przekroczenie budżetu AI.

## 3.8. Testy Etapu 3

### Kontraktowe

- pełne i minimalne poprawne żądanie;
- odrzucenie niepoprawnych enumów, porcji, czasu i identyfikatorów;
- odpowiedź zawsze zawiera `generationId` i tablicę `recipes`;
- klient nie może przesłać diet zastępujących preferencje konta.

### Jednostkowe

- walidacja każdego twardego ograniczenia;
- wymagany produkt po aliasie;
- brak nielubianego składnika po aliasie;
- nieznany składnik przy restrykcyjnej diecie;
- maksymalnie dwie regeneracje;
- brak regeneracji dla 4xx i rate limitu;
- stabilne braki dla tego samego przepisu i lodówki;
- zgodne wyniki `g/kg`, `ml/l` i brak łączenia wymiarów.

### Zestaw referencyjny generatora

Przechowywać wersjonowane przypadki bez danych użytkowników:

- dieta wegańska z produktami zwierzęcymi w lodówce;
- dieta bezglutenowa z aliasami produktów zawierających gluten;
- nielubiany składnik występujący pod aliasem;
- `MINIMIZE` dopuszczające kilka braków;
- `NONE` wymagające zerowej listy braków;
- produkt z krótką datą;
- niezgodne jednostki;
- częściowy wynik przy trzech propozycjach.

Testy nie powinny wymagać prawdziwego Gemini w każdym CI. Odpowiedzi dostawcy należy stubować, a ograniczony test integracyjny z prawdziwym dostawcą uruchamiać ręcznie lub w kontrolowanym środowisku z limitem kosztu.

### Frontend i E2E

- każda kontrolka zmienia właściwe pole payloadu;
- diety i nielubiane składniki nie pojawiają się w payloadzie klienta;
- wynik pokazuje trzy sekcje pokrycia;
- tryb minimalizacji różni się wizualnie od trybu bez zakupów;
- częściowy sukces zachowuje poprawne propozycje;
- retry nie tworzy dwóch równoległych żądań;
- wariant polski i angielski;
- widok mobilny i desktopowy.

## 3.9. Przełączenie ruchu R3C

1. Wdrożyć endpoint v2 bez przełączania frontendu.
2. Uruchomić testy kontraktowe i kontrolowane wywołania smoke.
3. Wdrożyć frontend z flagą wybierającą v2.
4. Włączyć v2 dla zespołu/testerów.
5. Sprawdzić błędy, czas, liczbę regeneracji, koszt i jakość zestawu referencyjnego.
6. Włączyć v2 dla wszystkich użytkowników.
7. Zachować stary endpoint przez jedno stabilne wydanie.
8. Usunąć fallback i stary parser JSON dopiero po potwierdzeniu braku ruchu na starym kontrakcie.

Rollback polega na przełączeniu frontendu na stary endpoint. Addytywny endpoint v2 i nowe pola bazy pozostają wdrożone.

## 3.10. Brama ukończenia Etapu 3

- [ ] Frontend nie wpisuje na stałe porcji ani typu posiłku.
- [ ] Wszystkie główne ustawienia są polami strukturalnymi.
- [ ] Diety i nielubiane składniki są pobierane po stronie serwera.
- [ ] Schemat, wymagane produkty i twarde ograniczenia są walidowane po odpowiedzi AI.
- [ ] Liczba automatycznych regeneracji jest ograniczona.
- [ ] Pokrycie lodówki i braki są deterministyczne.
- [ ] UI rozróżnia `MINIMIZE` i `NONE`.
- [ ] Zestaw referencyjny, testy kontraktowe i E2E przechodzą.
- [ ] Metryki nie zawierają promptów, diet ani nazw składników.
- [ ] Endpoint v2 obsługuje cały ruch, a stary kontrakt nie jest potrzebny frontendowi.

---

# 5. Plan pull requestów

Każdy zakres powinien być możliwy do przeglądu i wdrożenia niezależnie.

| PR | Zakres | Zależność |
|---|---|---|
| PR-01 | Java Toolchains 17, Node 24 i dokumentacja środowiska | Brak |
| PR-02 | Kontrakt analityki, allowlista właściwości i test prywatności danych | PR-01 |
| PR-03 | Integracyjne testy prywatności i sitemap | PR-01 |
| PR-04 | Domknięcie UI publikacji i E2E pełnego cyklu widoczności | PR-03 |
| PR-05 | Checklist, audyt danych i wydanie Etapu 1 | PR-02–04 |
| PR-06 | Addytywna migracja kanonicznych składników i aliasów | PR-05 |
| PR-07 | `IngredientNormalizationService` i dual-read/dual-write | PR-06 |
| PR-08 | `MeasurementService`, skalowanie porcji i agregacja | PR-07 |
| PR-09 | API podglądu listy z `recipeId` i `targetServings` | PR-08 |
| PR-10 | UI porcji i E2E | PR-09 |
| PR-11 | Backfill, raport kolizji i zaostrzenie ograniczeń | PR-10 |
| PR-12 | DTO i endpoint `/v2/recipes/generate` | PR-08 |
| PR-13 | Strukturalne opcje generatora we frontendzie | PR-12 |
| PR-14 | Walidator ograniczeń i kontrolowana regeneracja | PR-11–13 |
| PR-15 | Deterministyczne pokrycie, kody wyjaśnień i UI | PR-14 |
| PR-16 | Metryki, referencyjne przypadki, rollout v2 i usunięcie fallbacku | PR-15 |

PR-12 i PR-09 mogą rozpocząć się równolegle po ustabilizowaniu serwisów z PR-08. PR-14 wymaga zakończonej normalizacji i tagów składników.

# 6. Minimalna macierz weryfikacji przed każdym wydaniem

| Warstwa | Kontrola |
|---|---|
| Baza | Flyway na pustej bazie i bazie z poprzedniego wydania |
| Backend | Testy jednostkowe, kontrolery, uprawnienia i PostgreSQL/Testcontainers |
| Frontend | Testy komponentów, typecheck, lint i build |
| E2E | Główna ścieżka mobilna i desktopowa po polsku i angielsku |
| Bezpieczeństwo | Brak wycieku prywatnych przepisów oraz danych w analityce/logach |
| AI | Stubowany zestaw referencyjny i kontrolowany smoke prawdziwego dostawcy |
| Operacje | Backup, smoke po wdrożeniu, metryki i udokumentowany rollback |

# 7. Decyzje wymagające zatwierdzenia

Przed R1B:

1. Które istniejące przepisy są kuratorowane i mają zostać ponownie opublikowane?

Przed R2A:

2. Czy aliasy mogą być dodawane tylko przez administratora i potwierdzenie użytkownika? Rekomendacja: tak; nie uczyć globalnego słownika automatycznie z pojedynczych wpisów.

Przed R3B:

3. Które wartości `Diet` są twardymi regułami? Rekomendacja: `VEGAN`, `VEGETARIAN`, `GLUTEN_FREE`, `DAIRY_FREE` i nielubiane składniki traktować jako twarde; pozostałe jako preferencje do czasu zdefiniowania mierzalnych kryteriów.

# 8. Warunek rozpoczęcia Etapu 4

Etap 4 może się rozpocząć, gdy:

- wszystkie bramy Etapów 0–3 są zaznaczone;
- Etap 1 jest zweryfikowany na produkcji;
- skalowanie i normalizacja działają w przepisie, lodówce i podglądzie zakupów;
- generator v2 obsługuje cały ruch;
- zestaw referencyjny nie ujawnia naruszeń twardych ograniczeń;
- znane są koszt i czas generowania trzech propozycji;
- istnieje zatwierdzony kontrakt analityczny dla przyszłych `meal_plan` i `meal_plan_slot`.
