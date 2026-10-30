# Plan jadłospisu z budżetem i promocjami sklepowymi

RecipeAI ma układać lunche i obiady na wybrane dni, wykorzystywać zapasy użytkownika oraz promocje w wybranych sklepach i tworzyć listę zakupów mieszczącą się w zadanym budżecie. Koszt powinien wynikać z ilości faktycznie kupowanych produktów i opakowań. AI proponuje dania; aplikacja oblicza zapotrzebowanie, ceny i zgodność z budżetem.

Status: plan wdrożenia, 29 października 2026. Zakres pilotażu: Polska, PLN, Lidl i Biedronka jako sieci priorytetowe wskazane przez użytkownika, plan na 1–7 dni. Kolejność uruchomienia integracji zależy od dostępu do wiarygodnych danych; docelowy zakres obejmuje obie sieci.

Ten zakres rozwija Etapy 4–5 z [planu rozwoju](PLAN_ROZWOJU_PRODUKTU.md) oraz nadaje wcześniejszy priorytet budżetowi i promocjom, wcześniej odłożonym do Etapów 8–9. Szczegółowe zasady poniżej mają pierwszeństwo dla tych funkcji. Historia gotowania, meal prep i współdzielenie gospodarstwa nie są warunkiem uruchomienia tego zakresu.

## Przyrost implementacyjny z 29 października 2026

Pierwszy przyrost dodaje `/MealPlanner`: formularz na 1–7 dni, lunche i obiady, porcje, limit czasu, zapis budżetu PLN i preferencji Lidl/Biedronka. Plan jest prywatny, zapisywany na koncie i dostępny po odświeżeniu strony. Obsługuje generowanie brakujących dań, wymianę, blokadę, zmianę porcji, pominięcie oraz akceptację częściowego planu.

Lista zakupów jest na razie osobną checklistą wewnątrz jadłospisu. Obliczenia skalują porcje, przydzielają zapasy tylko raz, uwzględniają terminy oraz oznaczają nieznane ilości i niezgodne jednostki. Odhaczenia są zapisywane; przeliczenie zachowuje je dla pozycji o niezmienionym zapotrzebowaniu. Scalanie z istniejącą ręczną listą pozostaje do kolejnego przyrostu.

Technicznie pierwszy model przechowuje ograniczony do 14 pozycji agregat w tabeli `meal_plan`, z wersją encji oraz wersjonowanym dokumentem JSON zawierającym migawki dań. Migracja: `V24__Add_meal_plans.sql`. Generowanie jednego dania działa synchronicznie przez `POST /v2/meal-plans/{id}/slots/{slotId}/generate`; frontend wywołuje kolejne pozycje sekwencyjnie. Każdy wynik jest osobno zapisywany, a wyjście ze strony zatrzymuje uruchamianie następnych dań. Trwała kolejka całego planu i automatyczne wznowienie po restarcie są jeszcze przed nami. Operacja w toku ma identyfikator i pięciominutowy czas blokady; po nieudanej próbie można uruchomić nową, a spóźniony wynik nie nadpisze nowszej wersji.

Drugi przyrost dodaje wycenę zaakceptowanej listy: koszyk Lidla, Biedronki oraz opcję obu sklepów. Użytkownik wybiera datę zakupów i potwierdza możliwość skorzystania z rabatów lojalnościowych. Obliczenia wykorzystują całe opakowania, minimum i wielokrotności zakupu, limit opakowań, daty oferty oraz czas ostatniej weryfikacji. Brak ceny nie jest zerem i nie pozwala potwierdzić budżetu. Lista uwzględnia również odhaczone pozycje — koszt dotyczy całego planu. Zmiana dań usuwa starą listę i wycenę; ponowna akceptacja wylicza aktualne potrzeby.

Oferty zapisuje uprawniony administrator przez API, po potwierdzeniu źródła i warunków. Migracja `V25__Add_verified_store_offers.sql` dodaje wersjonowany katalog. Pilotaż obsługuje wyłącznie zweryfikowane ogólnopolskie oferty na produkty w stałych opakowaniach, z ceną za pojedyncze opakowanie w PLN. Nie obsługuje jeszcze cen luzem, promocji mieszanych, ofert lokalnych, indywidualnych kuponów ani automatycznego odświeżania. Brak zasilenia katalogu daje uczciwy komunikat „brak zweryfikowanych cen”. Szczegóły i instrukcja operacyjna: [oferty i wycena](OFERTY_I_WYCENA.md).

Sprawdzono publiczne dane [żywności Lidla](https://www.lidl.pl/c/zywnosc-i-napoje/s10068374) i [oferty Biedronki](https://www.biedronka.pl/pl/nowa-oferta). Lidl udostępnia w HTML dane produktów z cenami, regionami oraz osobnymi datami dostępności sklepowej i obowiązywania ceny. Skrypt `scripts/offers/prepare_lidl_candidates.py` przygotowuje plik do weryfikacji z zapisanej strony, bez publikacji i automatycznego dopasowania składników. Na pobranej próbce rozpoznał 12 produktów. Biedronka wymaga wyboru sklepu dla ofert lokalnych; adapter automatyczny nie został wdrożony. Nie potwierdzono kompletności cen regularnych ani kontraktu produkcyjnego z żadną siecią.

Do zrealizowania pozostają: automatyczne źródła i aktualizacja obu sieci, ceny wagowe i oferty lokalne, wybór placówki, ranking kosztowy dań, tańsze zamiany oraz pełne zdarzenia analityczne generowania. Generowanie posiłków nie korzysta jeszcze z wyceny i nie gwarantuje budżetu. Dotychczasowy limit generowania przepisów jest rozliczany osobno dla każdego dania.

Weryfikacja obejmuje testy jednostkowe bilansu i wyceny, integrację API z bazą i kontrolą uprawnień, migracje PostgreSQL, komponenty React oraz Chromium (telefon PL i desktop EN). Sprawdzono również lint, typy i build frontendu. Testy generowania używają kontrolowanych odpowiedzi AI, a scenariusze przeglądarkowe zastępują API fixture’ami; nie jest to potwierdzenie jakości rzeczywistego Gemini, rzeczywistego feedu cen ani wdrożenia produkcyjnego.

## 1. Co wykorzystujemy z obecnej aplikacji

Stan wyjściowy przed powyższym przyrostem, na podstawie kodu lokalnego, bez potwierdzania wdrożenia produkcyjnego:

| Obszar | Dostępna podstawa | Praca potrzebna do nowej funkcji |
|---|---|---|
| Przepisy | `Recipe` przechowuje `servings` i `visibility`; `RecipePage.tsx` ma zmianę porcji | Migawka przepisu w pozycji jadłospisu |
| Generator | `/v2/recipes/generate`, `GeneratedRecipeValidator`, klient v2 w `lib/hooks.tsx` | Generowanie wielu pozycji, zachowanie częściowych wyników i ranking według kosztu |
| Ilości | `ServingScalingService`, `UnitConversionService`, `IngredientNormalizationService` | Wspólna agregacja tygodnia i ostrożne dopasowanie produktów sklepowych |
| Lodówka | Ilości, jednostki, terminy i operacje korekty zapasów | Jednorazowe rozliczenie zapasów na cały plan oraz uwzględnienie daty posiłku |
| Zakupy | `ShoppingListItem`, `ShoppingListService`, podgląd z przepisu | Pochodzenie pozycji, wersje, opakowania, sklepy i wycena |
| Preferencje | Diety i nielubiane składniki na koncie | Sklepy, obszar zakupów i warunki korzystania z promocji |
| Analityka | [Kontrakt planera](ANALITYKA_PLANERA.md) | Podłączenie zdarzeń do nowego przepływu |

Nie ma jeszcze modelu jadłospisu, katalogu sklepów, ofert ani wyceny koszyka. Opisy brakujących porcji i widoczności w starszej roadmapie są historyczne; nie należy implementować tych pól ponownie.

Dwie istniejące reguły wymagają zmiany przed wyceną:

- `ShoppingListCoverageService` sprawdza składniki osobno względem całej lodówki i może uznać produkt bez ilości za dostępny. Plan potrzebuje wspólnego bilansu: ten sam zapas nie może pokrywać kilku dań, a nieznana ilość wymaga sprawdzenia.
- `ShoppingListService.replaceShoppingList` usuwa i zapisuje listę od nowa. Synchronizacja planera musi zachowywać ręczne pozycje, odhaczenia oraz identyfikatory pochodzenia, także przy zapisie ze starszej wersji klienta.

## 2. Ścieżka użytkownika

1. Użytkownik otwiera „Zaplanuj posiłki”. Wybiera dni, liczbę osób oraz lunch i/lub obiad. Domyślnie widzi 7 dni i dwa rodzaje posiłków; obiad odpowiada `DINNER`, lunch `LUNCH`.
2. Wpisuje budżet w PLN dla całego wybranego okresu. Formularz wyjaśnia, że obejmuje zakupy do tych posiłków, a nie wszystkie wydatki spożywcze gospodarstwa.
3. Wybiera sklepy, obszar lub placówkę, planowaną datę zakupów i maksymalną liczbę sklepów do odwiedzenia. Domyślnie jedna wizyta w jednym sklepie. Opcjonalnie zaznacza posiadanie karty lojalnościowej; nie podaje jej numeru ani hasła.
4. Aplikacja pobiera dostępne oferty, uwzględnia lodówkę i zapisane preferencje, a następnie proponuje jadłospis z wyceną.
5. Użytkownik widzi dania, porcje, czas przygotowania, koszt koszyka, pozostały budżet oraz pozycje bez ceny. Może zablokować danie lub wymienić je, np. na tańsze.
6. Po akceptacji otrzymuje listę pogrupowaną według sklepu i kategorii. Każda pozycja pokazuje ilość potrzebną, ilość do kupienia, cenę i ewentualny warunek promocji.
7. Przed zakupami może odświeżyć wycenę. Zmiana ceny pokazuje różnicę i pozwala wybrać zamiennik bez utraty zaakceptowanych dań.

Przykład formularza, bez deklaracji osiągalnej ceny: „2 osoby, 7 dni, lunche i obiady, 300 zł, Lidl i Biedronka, zakupy w sobotę”. To 14 pozycji planu i 28 porcji. Użytkownik może wybrać jedną lub obie sieci; przy limicie jednego odwiedzanego sklepu aplikacja porównuje dostępne koszyki i wybiera jeden sklep, a podział zakupów między sieci wymaga ustawienia limitu dwóch sklepów.

## 3. Zakres pierwszego pełnego wydania

| Funkcja | Zakres |
|---|---|
| Ustawienia | 1–7 dni, lunch i obiad, liczba osób, budżet, wybrane sklepy, data zakupów, limit odwiedzanych sklepów |
| Jadłospis | Zapis wersji roboczej, wymiana pojedynczego dania, blokada, pominięcie posiłku, akceptacja |
| Preferencje | Diety, nielubiane składniki, czas przygotowania oraz wykorzystanie lodówki |
| Promocje | Zweryfikowane oferty pilotażowych sieci, termin, region, opakowanie, warunki i źródło |
| Budżet | Koszt całych opakowań, ponowna wycena po zmianach, tańsze alternatywy i jawne braki cen |
| Zakupy | Agregacja planu, odjęcie lodówki, podział na sklepy, pochodzenie pozycji, odhaczanie |

Poza pierwszym wydaniem: zamawianie i płatności, automatyczne logowanie do kont sklepów, spersonalizowane kupony, optymalizacja trasy, wszystkie polskie sieci, pełny kalendarz miesięczny i automatyczne planowanie resztek. Ręczny import ofert umożliwia testy i pilotaż, ale automatyczne sprawdzanie promocji jest ukończone dopiero po uruchomieniu co najmniej jednego rzeczywistego źródła.

## 4. Dane sklepowe i promocje

### Wybór źródła

Pierwszym zadaniem integracyjnym jest osobne sprawdzenie źródeł dla Lidla i Biedronki. Nie zakładamy istnienia publicznego API. W kolejności oceniamy oficjalny feed lub partnerstwo, dostawcę danych z odpowiednim zakresem wykorzystania, a następnie import gazetek lub ofert z weryfikacją operatora. Automatyczne pobieranie stron wymaga oceny możliwości wykorzystania danych i kosztu utrzymania konkretnego źródła.

Wynikiem rozpoznania ma być tabela: sieć, źródło, sposób dostępu, obszar, ceny regularne, warunki promocji, częstotliwość aktualizacji, koszt i ograniczenia. Wybór źródła oraz zasady jego użycia są warunkiem uruchomienia integracji produkcyjnej. Brak źródła zatrzymuje automatyzację danej sieci, ale nie prace nad jadłospisem i listą.

### Minimalne dane oferty

- Sieć, opcjonalna placówka, region i kanał sprzedaży; cena internetowa nie staje się automatycznie ceną w sklepie stacjonarnym.
- Produkt, marka lub wariant, EAN jeśli dostępny, wielkość opakowania, jednostka i dopasowany składnik kanoniczny.
- Cena brutto, waluta i jednostka sprzedaży; cena regularna tylko jeśli została pozyskana ze źródła.
- Początek i koniec obowiązywania, źródłowy identyfikator, link lub referencja źródła, czas pobrania i weryfikacji.
- Warunki: karta, aplikacja, zakup wielosztukowy, limit ilości i ewentualny wymagany kupon.
- Stan: aktywna, przyszła, wygasła, nieaktualna lub wymagająca weryfikacji. Informacja o promocji sama w sobie nie potwierdza stanu magazynowego.

Importer uruchamia się cyklicznie według możliwości źródła i przedłuża aktualność wyłącznie po udanym odczycie. Powtórny import nie duplikuje ofert. Nieudany import zachowuje historię i oznacza problem z aktualnością. Tekst z gazetki lub odpowiedź OCR to dane do walidacji; nie może sterować instrukcjami generatora.

Do obliczeń trafiają tylko oferty pasujące do daty zakupów, miejsca i spełnionych warunków. Oferty wymagające niepotwierdzonego kuponu są wyłączone. Prosty rabat wielosztukowy można obsłużyć regułą; nierozpoznana promocja nie może obniżać wyceny.

## 5. Reguły wyceny i planowania

### Bilans składników

1. Przelicz składniki każdego dania do liczby porcji jego pozycji.
2. Rozwiąż tożsamość składnika i jednostki. Nie łącz surowego ryżu z ugotowanym ani sztuk z gramami bez potwierdzonego przelicznika.
3. Przydziel zapasy do kolejnych dni, zaczynając od najkrótszego terminu. Nie wykorzystuj zapasu po zadeklarowanym terminie; nie traktuj samej daty jako gwarancji jakości.
4. Sumuj pozostałe zapotrzebowanie i dobierz produkty sklepowe. Zapasy bez ilości oznacz jako „Do sprawdzenia”; nie zerują kosztu.
5. Dla opakowań kupowanych na sztuki zaokrąglij w górę liczbę opakowań. Dla produktów na wagę zastosuj jednostkę sprzedaży i znany krok ważenia.
6. Wyceń cały koszyk po uwzględnieniu warunków promocji, limitów i wymaganych dopłat, jeśli występują w danych. Nadwyżka z opakowania może zasilić następne danie w tym planie, ale nie zmienia faktycznej lodówki przed zakupem.

Przykład obliczeniowy z umownymi cenami: plan potrzebuje łącznie 750 g ryżu, a użytkownik ma 250 g. Opakowanie 1 kg kosztuje 8 zł, więc budżet obciąża 8 zł, a nie 4 zł odpowiadające zużytym 500 g. Pozostałe 500 g pokazujemy jako nadwyżkę po realizacji planu.

### Status budżetu

| Status | Znaczenie w interfejsie |
|---|---|
| `WITHIN_ESTIMATE` | Wszystkie pozycje wycenione i aktualna wycena koszyka mieści się w budżecie |
| `OVER_ESTIMATE` | Znana suma przekracza limit; pokazać kwotę przekroczenia i możliwe zamiany |
| `INCOMPLETE` | Brak ceny, ilości, dopasowania lub aktualnych danych; pokazać znaną sumę i listę niewiadomych |

Brak ceny nigdy nie oznacza zera. Przy niepełnej wycenie, której znana część już przekracza limit, pokazujemy zarówno brak danych, jak i przekroczenie. Orientacyjne ceny bazowe muszą mieć źródło, datę i odrębną etykietę. Bez aktualnych cen nie pokazujemy zapewnienia o zmieszczeniu się w budżecie.

Budżet dotyczy koszyka przypisanego do planu. Ręczne zakupy spoza planu są widoczne jako osobna suma; dopiero jawne włączenie ich do budżetu powoduje przeliczenie. Jeśli użytkownik pomija podstawowe produkty, formularz jasno wskazuje, że zakładamy ich posiadanie.

### Wybór dań

Najpierw egzekwujemy diety, wykluczenia, porcje, daty i wybrane sklepy. Następnie ograniczamy koszt całego koszyka, wykorzystujemy zapasy, zmniejszamy liczbę wizyt i dbamy o różnorodność dań. Sam procent rabatu nie jest celem rankingu.

AI otrzymuje sprawdzone produkty i proponuje dania. Backend waliduje wynik, skaluje ilości i wycenia koszyk. Pula propozycji powinna wykorzystywać również dostępne użytkownikowi zapisane przepisy, aby ograniczyć koszt i czas generowania.

Jeśli nie znaleziono planu w budżecie, pokazujemy najlepszy znaleziony wariant i konkretne możliwe zmiany. Nie obniżamy samodzielnie liczby porcji i nie naruszamy wykluczeń. Ograniczone wyszukiwanie nie uzasadnia komunikatu „taki plan nie istnieje”. Wymiana dania przelicza cały koszyk, ponieważ może zmienić wykorzystanie wspólnych opakowań. Zablokowane dania pozostają bez zmian.

## 6. Proponowany model i podział odpowiedzialności

Rozbudowa istniejącego backendu Spring Boot i frontendu React, bez wydzielania osobnego serwisu na start.

| Model | Najważniejsze dane |
|---|---|
| `MealPlan` | Właściciel, daty, budżet, waluta, status `DRAFT`/`ACCEPTED`, wersja, ustawienia sklepów i zakupów |
| `MealPlanSlot` | Plan, dzień, rodzaj posiłku, porcje, blokada, stan, migawka przepisu i opcjonalny identyfikator oryginału |
| `MealPlanGeneration` | Plan i wersja wejściowa, identyfikator zadania, idempotencja, postęp, wynik każdego slotu, limit prób |
| `Store` i `UserShoppingPreferences` | Sieć, obszar lub placówka, wybrane sklepy, limit wizyt, uprawnienie do prostych promocji lojalnościowych |
| `StoreProduct` | Identyfikator produktu źródłowego, wariant, opakowanie, jednostka sprzedaży, mapowanie do składnika |
| `PriceOffer` | Produkt, cena, zakres miejsca i czasu, warunki, źródło, świeżość i wersja |
| `PlanQuote` i `PlanQuoteItem` | Wersja planu, stan zapasów, data zakupów, migawki cen, liczba opakowań, sumy, braki danych i termin aktualności |
| Rozszerzenie zakupów | Źródło `MANUAL`/`RECIPE`/`MEAL_PLAN`, plan, wersja, wkłady slotów, sklep, oferta, potrzebna i kupowana ilość |

Kwoty przechowujemy jako `BigDecimal`/`NUMERIC` z walutą, bez obliczeń pieniężnych na `double`. Porównanie z budżetem następuje po obliczeniu kwot zgodnie z regułą ceny źródłowej. Nie wymaga to migracji wszystkich istniejących ilości w tej samej zmianie.

Proponowane serwisy: `MealPlanService` zarządza planem, `MealPlanGenerationService` zadaniami AI, `PlanIngredientAggregationService` bilansem, `PromotionImportService` ofertami, `BasketPricingService` kosztami, a `PlanShoppingListService` synchronizacją zakupów. Współdzielą istniejące reguły porcji, jednostek i preferencji.

## 7. Proponowane API i odporność na błędy

Ścieżki poniżej są nowymi kontraktami do wdrożenia, względem istniejącego prefiksu API.

| Operacja | Kontrakt |
|---|---|
| Katalog i preferencje | `GET /v2/stores`, `GET` i `PUT /v2/shopping-preferences` |
| Oferty | `GET /v2/offers` z filtrami sklepów, obszaru i daty zakupów |
| Plan | `POST /v2/meal-plans`, `GET` i `PATCH /v2/meal-plans/{id}` |
| Generowanie | `POST /v2/meal-plans/{id}/generations`, odpowiedź `202` z identyfikatorem zadania |
| Postęp | `GET /v2/meal-plans/{id}/generations/{generationId}` |
| Pozycja planu | `PATCH /v2/meal-plans/{id}/slots/{slotId}`, `POST /v2/meal-plans/{id}/slots/{slotId}/swap` |
| Wycena | `POST /v2/meal-plans/{id}/quotes` |
| Akceptacja | `POST /v2/meal-plans/{id}/accept` z wersją planu i identyfikatorem wyceny |
| Lista | `POST /v2/meal-plans/{id}/shopping-list/preview` i `POST /v2/meal-plans/{id}/shopping-list/sync` |

Właściciel wynika z zalogowanego konta. Zmiany wymagają oczekiwanej wersji; konflikt zwraca `409`. Generowanie, wymiana, akceptacja i synchronizacja mają klucze idempotencji. Wynik spóźnionego zadania nie nadpisuje późniejszych zmian użytkownika.

Generowanie zapisuje postęp w bazie i pozwala ponowić brakujące pozycje po awarii. MVP może używać zadania wykonywanego w backendzie z trwałym statusem, blokadą wykonania i odzyskaniem po restarcie; osobna kolejka nie jest wymagana. Wprowadzić limit równoległości, czasu, prób i kosztu na plan oraz spójne rozliczanie istniejącego limitu generowania przepisów.

Akceptacja planu i utworzenie zakupów używają tej samej wersji. Zmiana planu, daty zakupów, zapasów lub wygaśnięcie oferty unieważnia aktualność wyceny, ale zachowuje jej historię. Odświeżenie nie zmienia samodzielnie zaakceptowanych dań.

Synchronizacja listy modyfikuje wyłącznie wkład danego planu. Dla tej samej wersji nie tworzy duplikatów. Nie usuwa ręcznych pozycji ani zakupów z innego planu; wzrost ilości już odhaczonego produktu pokazuje dodatkowe zapotrzebowanie. Przy scalaniu zachowuje osobne wkłady źródeł. Przed włączeniem funkcji trzeba zabezpieczyć starszy `PUT /shoppingList` przed kasowaniem tych danych i obsłużyć konflikt wersji w kliencie.

## 8. Kolejność realizacji

| Etap | Zakres do wdrożenia | Kryterium odbioru |
|---|---|---|
| A. Rozpoznanie danych | Próbki ofert Lidla i Biedronki, osobna ocena źródeł i warunków, ręczny import danych testowych | Ocena obu sieci; co najmniej jedno wybrane źródło pozwala odtworzyć cenę, opakowanie, datę i warunki; znane braki cen regularnych |
| B. Jadłospis | Model, migracje, API, formularz, widok dni, zapis, blokowanie i wymiana | Plan lunchów i obiadów przetrwa odświeżenie; zmiana jednego dania zachowuje pozostałe |
| C. Zakupy z planu | Bilans całego planu, normalizacja, pochodzenie i bezpieczna synchronizacja | Zapasy odjęte raz, brak duplikatów, zachowane ręczne pozycje i odhaczenia |
| D. Sklepy i oferty | Preferencje, katalog, mapowanie produktów, importer pierwszej sieci i prezentacja warunków | Użytkownik widzi rzeczywiste aktualne oferty dla właściwej daty i miejsca |
| E. Budżet | Wycena opakowań, status pokrycia cenami, ranking dań, tańsze wymiany | Cała lista ma odtwarzalną wycenę lub jawne braki; wymiana przelicza cały koszyk |
| F. Pełny pilotaż | Połączenie przepływu, druga sieć jeśli gotowa, obsługa awarii, pomiar i testy użytkowe | Użytkownik przechodzi od sklepów i budżetu do jadłospisu oraz zakupów w jednej ścieżce |

Etap A może toczyć się równolegle z B i C. D wymaga wyniku A, E wymaga C i D, a F wszystkich poprzednich etapów. Pierwszy użyteczny przyrost B–C daje planer i zakupy; pełne zrealizowanie pomysłu wymaga D–F.

Proponowane osobne PR-y: (1) plan i migracje, (2) UI i zapis, (3) zadania generowania i wymiana, (4) agregacja i zabezpieczenie synchronizacji listy, (5) sklepy i model ofert z importem testowym, (6) rzeczywisty adapter i odświeżanie, (7) wycena oraz testy reguł cenowych, (8) ranking według budżetu i interfejs kosztu, (9) pełne E2E i uruchomienie pilotażu. Dobór adaptera i harmonogram ustalić po etapie A; dostęp do cen jest największą niewiadomą zakresu.

## 9. Kryteria odbioru i testy

- Dwa dania potrzebujące po 300 g produktu oraz lodówka z 400 g dają łącznie brak 200 g, a nie zero. Nieznana ilość pozostaje do sprawdzenia.
- Skalowanie porcji, konwersje `g/kg` i `ml/l`, niejednoznaczne aliasy oraz niezgodne wymiary zachowują poprawne zapotrzebowanie.
- Cena całego opakowania wchodzi do koszyka; ceny wagowe, rabaty wielosztukowe i limity mają osobne przypadki referencyjne.
- Promocja wygasła, dotycząca innej placówki albo wymagająca nieposiadanej karty nie obniża sumy. Awaria importera nie odświeża czasu ostatniej poprawnej weryfikacji.
- Brak ceny jednej pozycji daje niepełną wycenę. Kwota dokładnie równa budżetowi mieści się w nim, a przekroczenie o 0,01 zł jest wykrywane.
- Zmiana dania lub porcji przelicza wspólne opakowania i cały koszyk. Nie można wykorzystać jednego opakowania lub zapasu dwukrotnie.
- Podwójne kliknięcie i ponowienie po błędzie sieci nie tworzą dwóch planów, zadań ani list. Częściowa awaria AI zachowuje poprawne pozycje.
- Konflikt edycji i spóźniona odpowiedź AI nie nadpisują nowszego planu. Migawki przepisów przetrwają zmianę oryginału.
- Ręczne zakupy, odhaczenia i wkłady innych planów przetrwają odświeżenie. Starszy klient nie usuwa pochodzenia pozycji.
- Inny użytkownik nie odczyta ani nie zmieni planu, wyceny czy zadania. Dane budżetu, lokalizacji, kart i diety nie trafiają do analityki ani promptów bez potrzeby wynikającej z generowania.
- Pełny scenariusz na telefonie i desktopie, po polsku i angielsku: wybór sklepów → budżet → lunch i obiad → wymiana → akceptacja → lista → odświeżenie ceny.

Weryfikacja implementacji: testy jednostkowe bilansu i wyceny, kontrakty API, migracje na PostgreSQL, integracja synchronizacji, testy komponentów i E2E. CI używa ustalonych odpowiedzi AI i fixture'ów ofert; kontrolowany smoke rzeczywistego dostawcy sprawdza integrację przed uruchomieniem pilotażu.

## 10. Uruchomienie i pomiar

Wdrażać migracje addytywnie, a nowe funkcje włączać flagami osobno dla planera i cen. Najpierw konta testowe i jedna sieć, następnie mała grupa użytkowników. Wyłączenie integracji ofert zachowuje plany i zakupy, pokazując wycenę jako wymagającą odświeżenia.

Główny miernik pozostaje zgodny z kontraktem analityki: użytkownik akceptuje plan i tworzy listę dla tej samej wersji. Dodatkowo mierzyć kompletność wyceny, udział przekroczeń budżetu, częstotliwość nieaktualnych ofert, czas generowania oraz koszt AI na zaakceptowany plan. Nowe zdarzenia i dozwolone pola najpierw dopisać do `ANALITYKA_PLANERA.md`; nie przesyłać dokładnego budżetu, lokalizacji ani list produktów.

Sieci priorytetowe są ustalone: Lidl i Biedronka. Przed integracją trzeba ustalić obszar pilotażu i zweryfikować źródła dla obu sieci. Przed publikacją doprecyzować maksymalny czas i koszt generowania oraz sposób naliczania limitów użytkownika. Pozostałe domyślne założenia do realizacji: PLN, budżet na wybrane posiłki i okres, jedna data zakupów, maksymalnie jeden odwiedzany sklep, opcjonalne rozszerzenie do dwóch.
