# Tydzień z okazji — stan implementacji

Stan lokalny: 3 listopada 2026. Dokument uzupełnia nadrzędny [plan](PLAN_TYGODNIA_Z_AKTUALNYCH_OKAZJI.md). Nie oznacza wdrożenia produkcyjnego ani odbioru automatycznego katalogu cen.

## Wynik

Działa nowy przepływ planera: zapisane ustawienia → opcjonalne oferty → trwałe generowanie tygodnia → poprawka migawki przepisu → wycena → osobna lista zakupów z wyborem koszyka. Budżet jest opcjonalny i miękki. Braki cen oraz przekroczenie kwoty nie blokują akceptacji.

**Pełny pilotaż aktualnych promocji pozostaje zablokowany odbiorem źródła.** Rzeczywisty adapter Lidla pobiera pierwszą partię strony do weryfikacji. Nie jest kompletnym feedem i celowo nie publikuje tych cen. Biedronka nie ma automatycznego adaptera. Kontrolowane ceny użyte w testach nie trafiają do produkcyjnej bazy.

| Etap nadrzędnego planu | Stan |
|---|---|
| A — źródła | Pobranie rzeczywistych stron, próbka 12 kandydatów Lidla, karta ograniczeń poniżej; brak odbioru 30–50 ofert i dwóch cykli |
| B — ustawienia | Wdrożone wraz ze zgodnością dokumentów schematu 1 i ochroną starego klienta |
| C — katalog | Partie importu, historia pobrań, walidacja, stabilne identyfikatory, kolejka sprawdzenia i panel administratora; publikacja nadal po ręcznej weryfikacji |
| D — wybór i koszyk | Katalog dla daty, opcjonalne wskazanie produktów, osobne kupony, wycena robocza, wybór koszyka |
| E — tydzień | Dostępna biblioteka przed AI, ograniczony dobór według całego koszyka, trwałe zadanie i odzyskiwanie; jakość doboru na rzeczywistym katalogu wymaga pilotażu |
| F — poprawki | Ręczna korekta, zamiana znanego składnika, inna dopuszczona oferta, szybsze danie, uproszczenie; podgląd, zastosowanie i cofnięcie |
| G — zakupy | Synchronizacja osobnej listy planu, odhaczenia, grupowanie według koszyka i kategorii, testy PL mobile i EN desktop; brak produkcyjnego pilotażu z odebranym feedem |
| H — rozszerzenia | Zestawy i podstawowa sprzedaż wagowa obsługiwane; lokalne ceny, wspólne limity wariantów, promocje mieszane i druga sieć pozostają poza odbiorem |

## Rozpoznanie rzeczywistych źródeł

3 listopada pobrano bez logowania publiczne strony [Lidla](https://www.lidl.pl/c/zywnosc-i-napoje/s10068374) i [Biedronki](https://www.biedronka.pl/pl/nowa-oferta). Obie odpowiedziały HTTP 200. Początkowy odczyt Lidla przez narzędzie WWW miał timeout; osobne pobranie HTTP oraz późniejszy test adaptera zadziałały.

| Wymiar | Lidl | Biedronka |
|---|---|---|
| Format | Osadzony JSON Nuxt, odczyt bez wykonywania skryptów strony | Strona oferty z terminami i odnośnikami do gazetek oraz wyborem placówki |
| Próbka | 12 unikalnych identyfikatorów z pierwszej partii strony; to nie pełny katalog | Sprawdzono stronę wejściową i dwie gazetki; nie wyodrębniono kompletnej próbki rekordów cenowych |
| Ilość i cena | Są ceny za opakowanie i za podstawę wagową; jeden z odczytanych produktów nie ma liczbowej ceny | Nie potwierdzono stabilnego, kompletnego kontraktu rekordów cenowych |
| Warunki | Występują limity, osobne dane regionów i warunki w tekście; nie wolno zakładać ogólnopolskiego zakresu | Ceny i asortyment trzeba wiązać z placówką lub potwierdzonym zakresem |
| Daty | Zachowywane źródłowe daty sklepu i obiekt ceny; czas pobrania nie weryfikuje ich zgodności | Strona rozdziela okresy ofert, m.in. 2–7 i 3–4 listopada 2026 |
| Kompletność | Niepotwierdzona paginacja i pokrycie kategorii; nie wykonano odbioru dwóch cykli | Niepotwierdzona; osobny adapter i odbiór są konieczne |
| Wykorzystanie | Brak potwierdzonej podstawy do cyklicznej publikacji pełnego zbioru w aplikacji | Brak potwierdzonej podstawy i umowy dostępu |
| Decyzja | Wyłącznie pobieranie dowodów do sprawdzenia; automatyczna publikacja wyłączona konstrukcyjnie | Brak automatycznego importu |

Próbka Lidla zawierała m.in. podstawę ceny 100 g i limit wyrażony w kilogramach. To uzasadnia obsługę wagową, ale nie uprawnia do zgadywania kroku ważenia ani przekształcania ceny w stałe opakowanie. Brak ceny pozostaje brakiem.

Sprawdzono także [robots.txt Lidla](https://www.lidl.pl/robots.txt) i [Biedronki](https://www.biedronka.pl/robots.txt). Adapter nie używa wyłączonych przez Lidla wariantów paginacji. Robots.txt nie potwierdza licencji na dalszą publikację danych.

[Scrape.pl dla Lidla](https://scrape.pl/zrodla-danych/lidl.pl) i [Biedronki](https://scrape.pl/zrodla-danych/biedronka.pl) deklaruje pliki/API i próbki. [DataMiners](https://dataminers.pl/oferta/fmcg.html) opisuje monitoring FMCG. Nie otrzymano próbek od dostawców, wyceny, umowy ani uprawnienia do prezentacji. Nie wysłano zapytań w imieniu użytkownika i nie zaciągnięto płatnych zobowiązań.

Do uruchomienia feedu potrzebny jest wybrany, odebrany zakres danych i potwierdzone warunki użycia. Każda sieć wymaga osobnego odbioru, obejmującego gramatury, miejsce, karty, konkretne kupony, limity oraz dwa cykle aktualizacji. Nie ma potwierdzenia cen regularnych całego koszyka.

## Dane i zgodność

Migracja `V26__Add_week_planning_workflows.sql` jest addytywna. Dodaje preferencje zakupowe, zadania generowania, podglądy poprawek, partie importów, historię pobrań, prywatne zgłoszenia problemów zakupowych i trwałe rezerwacje limitu AI. Nie przepisuje historycznych planów ani katalogu ofert. Model planu nadal przechowuje ograniczony, wersjonowany dokument oraz migawki dań.

Nowy klient używa `/v3/meal-plans`. Kwota `null` oznacza brak preferencji; zero jest nieprawidłową kwotą. `budgetMode=NONE|SOFT` musi zgadzać się z obecnością kwoty. Obsługiwany tryb to `planningMode=DEALS`.

`shopping` zawiera datę zakupów, `maxStores`, `loyaltyStores`, `confirmedCouponOffers`, `selectedOffers` i `allowRepeats`. Nowy formularz domyślnie wybiera Lidl, jedną wizytę i brak powtórek. Zaznaczenie obu sieci przy `maxStores=1` daje dwa osobne warianty, bez koszyka mieszanego. Podział wymaga oddzielnej zgody. Zapisywane na koncie są ustawienia planowania; nowy tydzień nie przenosi automatycznie wyboru konkretnych ofert ani potwierdzeń kuponów. Data nowego tygodnia i zakupów zaczyna się od dzisiaj.

Dokumenty schematu 1 i stare żądania z dodatnią kwotą są odczytywane. Dla historycznego kontraktu zachowano dotychczasowe porównanie łączone i dopuszczenie powtórek. `/v2/meal-plans` nadal obsługuje stare plany z kwotą. Próba otwarcia nowego planu bez kwoty w starym kliencie dostaje `409` przed mutacją, zamiast prezentacji `null` jako zera. Utworzenie planu bez kwoty wymaga v3. Stary endpoint zaakceptowanej wyceny zachowuje kontrakt stałych opakowań; nowy klient używa podglądu rozszerzonego.

## API

Prefiksy nie uwzględniają konfigurowalnego `/api` aplikacji.

| Operacja | Endpoint |
|---|---|
| Preferencje konta | `GET/PUT /v2/shopping-preferences`; zapis ostatnich ustawień również przy tworzeniu i zmianie planu |
| Status źródeł | `GET /v2/stores` — jawne `MANUAL_REVIEW_ONLY` |
| Katalog | `GET /v2/offers?stores=LIDL,BIEDRONKA&shoppingDate=YYYY-MM-DD` |
| Tworzenie, odczyt i lista | Dotychczasowe operacje pod `/v3/meal-plans` |
| Ustawienia | `PATCH /v3/meal-plans/{id}/settings` — `version`, `settings` |
| Start tygodnia | `POST /v3/meal-plans/{id}/generations` — `version`, `requestId`; odpowiedź `202` |
| Powrót do zadania | `GET /v3/meal-plans/{id}/generations/latest` |
| Zatrzymanie | `POST /v3/meal-plans/{id}/generations/{jobId}/cancel` |
| Koszt roboczy | `POST /v3/meal-plans/{id}/quote-preview` |
| Podgląd poprawki | `POST /v3/meal-plans/{id}/slots/{slotId}/revision-previews` |
| Zastosowanie | `POST /v3/meal-plans/{id}/slots/{slotId}/apply-revision` — `version`, `previewId` |
| Cofnięcie | `POST /v3/meal-plans/{id}/slots/{slotId}/undo-revision` — tworzy nowy podgląd |
| Ostatnia zgodna poprawka | `GET /v3/meal-plans/{id}/slots/{slotId}/revisions/latest` |
| Wybór zakupów | `POST /v3/meal-plans/{id}/shopping-list/select` — wersja, wariant i kontekst wyceny |
| Synchronizacja | `POST /v3/meal-plans/{id}/shopping-list/sync` — `version`, `requestId` |

Ustawienia daty początku, liczby dni, osób, typów posiłków i języka istniejącego planu są stałe; do ich zmiany służy nowy plan. Porcje konkretnego dania pozostają edytowalne. Pozostałe ustawienia można zmieniać bez nadpisywania dań.

Właściciel jest ustalany z uwierzytelnionego konta. Mutacje nadal wymagają CSRF. CORS uwzględnia PATCH. Zmiany sprawdzają wersję; spóźniony wynik nie nadpisuje późniejszych edycji. Plan bez ceny lub ponad preferowaną kwotą nadal można zaakceptować.

## Pobieranie i weryfikacja

`LidlReviewCaptureService` pobiera wyłącznie stały, oficjalny adres HTTPS, bez przekierowań i wykonywania JavaScript. Pobranie ma limit czasu i 10 MB. Nieznany format, pusta odpowiedź lub przekroczenie limitów kończą się niepowodzeniem zapisanym w historii. Adapter zachowuje dowód źródłowy, daty, regiony i warunki jako dane, nie jako instrukcje dla AI.

- `POST /admin/offer-imports/capture-lidl-review` uruchamia pojedyncze pobranie.
- `GET /admin/offer-imports/source-runs` pokazuje historię prób.
- `LIDL_REVIEW_CAPTURE_ENABLED=true` włącza codzienne pobieranie do sprawdzenia o 05:00 w Europe/Warsaw. Domyślnie wyłączone; w tym wdrożeniu nie zmieniono produkcyjnych zmiennych ani harmonogramu.
- Każda obecna partia z publicznej strony ma `INCOMPLETE` / `INCOMPLETE_REVIEW_ONLY`. Nie można opublikować z niej cen przyciskiem weryfikacji. Niekompletna partia nie wycofuje poprzednich ofert.
- Ponowne pobranie identycznej treści wskazuje tę samą partię przez checksumę; osobno pozostaje historia prób. Czas pobrania nie zmienia `verifiedAt`.

Ogólny import administratora: `POST /admin/offer-imports`. Wymagane są `adapter`, `sourceBatchId`, `store`, `fetchedAt`, opcjonalne `sourceUpdatedAt`, `complete`, `expectedCount` i `candidates`. Kandydat zawiera `sourceProductId`, oficjalny `sourceUrl` i ograniczony rozmiarem tekst `evidence`. Tylko jawnie kompletny, kontrolowany zakres z poprawną liczbą i unikalnymi identyfikatorami przechodzi do kolejki. Deklaracja kompletności administratora nie zastępuje odbioru adaptera.

`GET /admin/offer-imports` zwraca ostatnie 30 partii. `POST /admin/offer-imports/{id}/review` wymaga wersji partii, indeksu rekordu i decyzji. Publikacja przyjmuje zweryfikowany `StoreOfferDto.Publish`; odrzucenie zapisuje powód. Zmiana ceny lub daty wymaga aktualnej wersji oferty. Stabilny identyfikator obejmuje sklep, produkt źródłowy i okres. Wycofanie pozostaje w `/admin/store-offers/{id}/withdraw`.

Panel administratora pokazuje źródło i odczytany dowód obok formularza sprawdzonej oferty JSON, historię i opublikowane pola. Nie zgaduje mapowania ani gramatur. To techniczny interfejs pilotażu; nie ma jeszcze wygodnego formularza pól, automatycznej tabeli różnic poprzednich partii ani mapowania lokalnych placówek. Można porównać obok siebie dwa dowody źródłowe i poprzednio opublikowane pola z ostatnich 30 partii.

## Generowanie i poprawki

Backend zapisuje kolejkę maksymalnie 14 slotów. Jedno zadanie na plan jest aktywne naraz; PostgreSQL dodatkowo wymusza to indeksem częściowym. Worker zapisuje kolejne wyniki oddzielnie. Zamknięcie strony po przyjęciu zadania nie zatrzymuje pracy. UI odtwarza ostatnie zadanie i odpyta postęp co 2,5 sekundy.

Blokada zadania trwa 10 minut. Po jej wygaśnięciu worker rozpoznaje już zatwierdzony wynik albo odzyskuje starą rezerwację slotu. Maksymalnie trzy przejęcia na slot i godzina na zadanie ograniczają ponawianie. Błąd dostawcy lub konflikt zatrzymuje dalszą pracę, zachowując wcześniejsze dania; użytkownik może ponowić brakujące. Zatrzymanie działa pomiędzy daniami. `PLANNER_JOBS_ENABLED=false` wyłącza worker, zachowując dane.

Trwały klucz rozliczenia limitu jest związany z logicznym slotem zadania, niezależnie od ponownego wykonania po awarii. Rezerwacja jest pobierana raz i zwalniana po obsłużonym błędzie. Nie eliminuje to możliwości powtórnego kosztu u dostawcy AI, jeżeli proces zakończy się po wywołaniu dostawcy, a przed zapisem wyniku; provider nie oferuje tutaj transakcji z naszą bazą. Powtórzenie nie nalicza użytkownikowi drugiego limitu za ten sam slot zadania.

Dobór pobiera do 60 przepisów w odpowiednim języku, wyłącznie publicznych i własnych. Sprawdza dietę, nielubiane składniki, jednostki i czas, unika powtórek i ocenia agregację całego częściowego tygodnia. Koszt niepełnego koszyka nie wygrywa przez brak cen. Koszt opakowań i nadwyżki są porównywane po uwzględnieniu zapasów. AI generuje jednego brakującego kandydata z ograniczonym kontekstem nazw dopuszczonych produktów, bez cen z modelu. Nie wdrożono wielowariantowego solvera ani empirycznie skalibrowanych wag jakości.

Podgląd poprawki zapisuje oryginał, proponowany przepis, zakupy i obie wyceny na 15 minut. Ceny są deterministyczne. Różnica pełnego kosztu pojawia się wyłącznie dla dwóch kompletnych koszyków. Automatyczna zamiana wymaga znanych tożsamości składników; wynik musi użyć wskazanego zamiennika/oferty. Zmiana nazw składników z pozostawieniem identycznych instrukcji jest odrzucana. Przy zastosowaniu ponownie sprawdzane są ograniczenia i wersje wykorzystanych ofert.

Zmienia się wyłącznie migawka slotu. Oryginał biblioteki i inne dni pozostają bez zmian. Blokada dania uniemożliwia poprawkę. Cofnięcie tworzy nowy podgląd względem bieżącego planu; późniejsza zmiana tego samego przepisu wymaga ponownej ręcznej korekty. Ostatnią pasującą poprawkę można odnaleźć po otwarciu edytora również po odświeżeniu strony. Po błędzie przygotowania podglądu ponowne otwarcie edytora rozpoczyna nową operację; powtórzenie tego samego identyfikatora nie uruchamia AI drugi raz.

Istniejący walidator diet opiera się na słowniku tekstowym, nie na kompletnym katalogu alergenów i cech produktów. Nieznane mapowanie nie uprawnia do automatycznej zamiany. Jakość dopasowania zapisanych przepisów, różnorodność i skuteczność uproszczeń nadal wymagają odbioru użytkowego.

## Wycena i lista

Kwoty liczy `BigDecimal`. Wycena rozróżnia pełne opakowanie, dokładną cenę zestawu oraz wagową podstawę ceny i krok. `bundlePrice` z `bundleSize` pozwala zapisać dwa opakowania za 7,99 zł bez wymyślania zaokrąglonej ceny jednej sztuki; w takim przypadku `packagePrice` może być puste. Dla wagi cena odnosi się do `packageAmount` jednostek, a `weightStep` określa kupowaną ilość. Opcjonalne `maximumAmount` jest limitem wagowym. Znana `regularPrice` może wycenić ilość ponad limit; sama cena referencyjna sprzed obniżki nie jest automatycznie ceną regularną.

Warianty mieszane, limity współdzielone między różnymi produktami, oferty lokalne i mechanizmy zależne od wartości całego paragonu nie są dopuszczane do automatycznej wyceny. Nie liczymy oszczędności względem nieporównywalnego odniesienia. Nie ma cen szacowanych przez AI: są znane kwoty i jawne braki. Karta i konkretny kupon są oddzielnymi warunkami. Koniec promocji jest datą ceny, nie terminem przydatności.

Lista nadal należy do konkretnego planu. To celowo zachowuje zgodność z ręczną listą i jej starszym PUT: listy różnych planów i ręczne pozycje nie są wspólnie zastępowane. Pochodzenie wiersza stanowią istniejące `slotIds`. Korekta przelicza bilans i zachowuje odhaczenia niezmienionych wymagań. Zmieniona ilość ma nowy klucz i wymaga odhaczenia ponownie. Synchronizacja z identyfikatorem żądania jest idempotentna. Zapis koszyka utrwala źródła, zakupione ilości i warunki, a lista grupuje je według sklepu i kategorii; brak kategorii trafia do „Pozostałe”.

Zgłoszenie „brak produktu / inna cena” zapisuje prywatny, idempotentny rekord dla planu i ewentualnej oferty. Nie nadpisuje globalnej ceny ani planu. Link prowadzi do dania, gdzie można wskazać inną okazję lub poprawić składnik. `GET/POST /v3/meal-plans/{id}/shopping-list/issues` wymaga właściciela; nowe zgłoszenie również oczekiwanej wersji.

Zmiana planu unieważnia przypisaną migawkę ceny i zachowuje wybór wariantu oraz checklistę. Po wygaśnięciu wyceny trzeba odświeżyć ceny. Nie ma rezerwacji towaru ani gwarancji dostępności w sklepie.

## Weryfikacja

Wykonano lokalnie:

- pełną regresję backendu oraz migracje Flyway na PostgreSQL 17 z walidacją encji;
- testy opakowań, zestawów 7,99 zł, sprzedaży wagowej, cen regularnych, kuponów, braków i wersji;
- testy pełnych 14 slotów, biblioteki i prywatności, trwałego postępu, konfliktów oraz odzyskania wyniku i limitu po awarii;
- testy podglądu, ponowienia zastosowania, cofania, zachowania innych dni i checklisty;
- build, TypeScript, ESLint i 98 testów frontendu w 24 plikach;
- Chromium: telefon PL i desktop EN z kontrolowanym API;
- osobno Chromium z prawdziwym lokalnym Spring Boot, bazą H2, workerem, sesją/CSRF i kontrolowaną odpowiedzią Gemini; mobilny wariant obejmuje siedem dni i 14 dań, poprawkę, koszyk, odhaczenia i odświeżenie;
- osobny smoke z rzeczywistym Gemini: poprawne polskie danie (w pierwszym sprawdzeniu dziewięć składników i osiem kroków); to nie pomiar jakości całych tygodni;
- osobny smoke rzeczywistego adaptera Lidla: 12 kandydatów, stan `INCOMPLETE_REVIEW_ONLY`, bez publikacji cen;
- dotychczasowe dwa testy parsera Python i nowe testy parsera Java.

Powtarzanie bez dostępu do sieci:

```sh
cd backendApi
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew test
cd ../frontend/recipeai
npm run build
npm run lint
npm run typecheck
npm run test -- --run
npx playwright test e2e/meal-planner.spec.ts
```

Pełne testy migracji wymagają lokalnego Dockera. Opcjonalne, odrębne sprawdzenia:

```sh
# Rzeczywisty dostawca; GEMINI_API_KEY musi być podany w środowisku.
RUN_LIVE_PLANNER_SMOKE=1 ./gradlew test --tests '*LivePlannerSmokeIT'
# Lokalny backend + Chromium; node i zainstalowany Chromium muszą być dostępne.
RUN_BROWSER_PLANNER_SMOKE=1 ./gradlew test --tests '*BrowserPlannerSmokeIT'
```

Drugi test zajmuje porty 18889 i 5174 i uruchamia tylko izolowaną bazę testową. `PLANNER_TEST_NODE` może wskazać konkretny plik wykonywalny Node 24. Proxy Vite `RECIPEAI_DEV_API_PROXY` jest opcjonalne i używane w tym teście. Nie należy współdzielić tych portów z własnym serwerem. Testy sieciowe i przeglądarkowe backendu są domyślnie pomijane.

Nie wykonano wdrożenia produkcyjnego, testu całego przepływu z odebranym feedem, odbioru Biedronki, testu dwóch kolejnych cykli ani pilotażu z użytkownikami. Nie potwierdzono celu trzech minut, kosztu tygodnia u dostawcy, jakości rankingu na reprezentatywnych koszykach ani produkcyjnej skali i retencji historii. Podgląd operatora jest techniczny; nie ma jeszcze procesu rozpatrywania zgłoszeń przez operatora. Te elementy nie są uznane za gotowe.


## Poprawki po przeglądzie — 3 listopada 2026

- Zaznaczony, dopuszczony produkt jest wymaganiem na poziomie tygodnia. Dopóki nie wykorzystuje go inne niepominięte danie, kandydat musi używać przynajmniej jednego z niewykorzystanych wskazanych składników. Brak dopasowania w bibliotece uruchamia AI z nazwami kanonicznymi; odpowiedź pomijająca składnik jest odrzucana. Dopasowanie uwzględnia aliasy.
- Cena opakowań porównuje pełną promocję (także z nadwyżką), zakup regularny i promocję z regularną końcówką również poniżej limitu. Dwa opakowania za 7,99 zł i trzecie regularne za 5 zł dają 12,99 zł. Brak ceny regularnej nadal wyklucza jej dopowiadanie.
- Zamiana wymaga obecności tożsamości zamiennika i nieobecności tożsamości zastępowanego składnika. Alias nie pozwala pozostawić starego produktu; zamiana składnika na jego własny alias jest odrzucana przed AI.
- Każda edycja formularza, w tym dodanie i usunięcie składnika, unieważnia podgląd. Pola są blokowane na czas żądania, a opóźniona odpowiedź nie odtwarza podglądu po zmianie danych. Zapis 75 g po podglądzie 50 g wymaga nowego podglądu.

Regresje odtworzono przed poprawkami w testach backendu i komponentu. Weryfikacja poprawek korzysta z kontrolowanych odpowiedzi AI i ofert; nie jest ponownym odbiorem produkcyjnego źródła ani rzeczywistego dostawcy AI.

Wynik regresji po poprawkach: 181 testów backendu bez błędów (3 opcjonalne testy sieciowe/przeglądarkowe pominięte), 98 testów frontendu bez błędów, TypeScript, ESLint i build zakończone powodzeniem.
