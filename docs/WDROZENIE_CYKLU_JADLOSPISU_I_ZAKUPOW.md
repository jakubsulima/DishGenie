# Wdrożenie cyklu jadłospisu i zakupów

Data: 8 listopada 2026. Status: ukończone lokalnie i zweryfikowane. Zakres: etapy 0–8. Nie wykonano publikacji ani migracji produkcyjnych.

Zachowano zastane niezacommitowane zmiany i nowe pliki. Wymagania w planie nie były
zmieniane. Historyczne wyniki w innych dokumentach pozostają historycznymi wynikami.

## Stan etapów

| Etap | Wdrożone zachowanie | Weryfikacja |
| --- | --- | --- |
| 0 | ADR 0001, dokument schema 4, API v4, addytywne V30–V32, ochrona przed obcięciem dokumentu przez v2/v3 | Stare plany i ceny w istniejących testach; odczyt bez mutacji; kontrola właściciela; PostgreSQL/Flyway/Hibernate validate |
| 1 | Jedno „Zaplanuj tydzień” tworzy plan i rozpoczyna trwałe zadanie. Utrata odpowiedzi nie traci intencji. Błąd uruchomienia pozostawia istniejący plan do wznowienia | Współbieżne tworzenie, replay zadania, przeładowanie w przeglądarce; GET podglądu nie akceptuje planu |
| 2 | Domyślny PRACTICAL bez obowiązku cen, wyjątki datowane, limit slotu, priorytety lodówki i korekta ilości, pozostające zapasy tygodnia w kontekście generowania | Brak ofert, pominięcia, limit 15 minut, nieznane ilości; skończony ranking biblioteki i istniejące limity AI |
| 3 | Partia i alokacje, gotowanie na dwa dni zadeklarowane przed generowaniem lub w podglądzie, przenoszenie i zmiana porcji | 2+2 porcje dają 600 g raz; zajęty cel odrzucany; replanning chroni partie; starsze sloty pozostają pojedynczymi gotowaniami |
| 4 | Jedna trwała wizyta z pochodzeniem PLAN/MANUAL/EXTRA, wspólny obiekt w planerze i ShoppingList, historia, stany koszyka, dodatkowe produkty i grupy sklepu/działu | Ryż i długi detergent razem; wybrane pozycje ręczne; brak automatycznego scalania niejednoznacznych nazw; zapis i ponowienie po połączeniu |
| 5 | Rzeczywiste ilości i ceny, wybór importu żywności, częściowe wyniki i dokończenie importu, bezpieczne undo, kolejne wizyty | Powtórzenie zakupu 500 g nie daje 1000 g; import nieżywnościowy nie jest domyślnie zaznaczany; pominięta jednostka jest jawna; undo po zużyciu odrzucany |
| 6 | Dzisiaj, najbliższy dzień przy braku dzisiejszych posiłków, serwerowy przegląd zużycia, przygotowane porcje, jedzenie bez ponownego zużycia, przechowanie/zamrożenie/usunięcie | Bilans 700→100 g; idempotentne gotowanie; częściowe jedzenie i bezpieczne cofanie; lokalne daty i DST Warszawy |
| 7 | Podglądy zależne od planu, lodówki, wizyt i powiązanych tygodni. Zamiany z biblioteki preferują mniejsze braki i wskazane zapasy. Zachowano również istniejące poprawki AI | Zmiana lodówki unieważnia apply; przyszłe 150 g przy 100 g w domu daje 50 g; historia wizyty i ugotowany przepis pozostają; edytor v4 obejmuje całą partię |
| 8 | Kolejny tydzień bez wyjątków i kuponów, aktualne zapasy i gotowe porcje, przenoszenie wolnych porcji między tygodniami, PL/EN, zdarzenia analityki | Weryfikacja 360/390/1440 px, klawiatura/Escape/fokus, długie nazwy, kolejne tygodnie, testy frontend/API/baza |

## Dane i zasady spójności

- `meal_plan.document` schema 4 dodaje `cycle`: wyjątki, priorytetowe identyfikatory
  zapasów, partie i alokacje, jawny stan wymagający przeglądu lodówki. Starszy slot
  jest odczytywany jako niezależne gotowanie. Odczyt nie zapisuje migracji danych.
- Partie zawierają migawkę przepisu. Zapotrzebowanie pochodzi z planowanych partii,
  skalowanych raz. Ugotowane partie nie wracają do listy surowych składników.
- `shopping_trip` przechowuje osobno wersję wizyty, źródła wierszy, potrzeby,
  opakowania, odhaczenia, zakup rzeczywisty i wynik importu. Zakończona wizyta nie
  jest przeliczana przy zmianie jadłospisu. Undo importu i jego jawna korekta są
  odrębnymi, wersjonowanymi czynnościami; nie zmieniają faktu zakupu.
- `cycle_request` zapisuje wejście oraz wynik intencji. Replay następuje przed
  kontrolą starej wersji; inna treść pod tym samym ID daje konflikt.
- `prepared_portion_transfer` rozlicza porcje między tygodniami. Gotowy posiłek w
  nowym tygodniu nie tworzy nowego surowego zapotrzebowania. Transfer blokuje
  cofnięcie gotowania źródłowego, dopóki istnieją zależne porcje.
- Operacje blokują właściciela, weryfikują właściciela każdego źródła i wersje.
  Operacje lodówki oraz zapis zakupu/gotowania i wyniku intencji są transakcyjne.
  Większe operacje używają istniejącego limitu 50 zmian w porcjach jednej transakcji.
- Stan dostępny pochodzi wyłącznie z lodówki. Historyczny zakup nie jest drugim
  zasobem. Nieznana ilość i niezgodna jednostka wymagają sprawdzenia. Ceny nieznane
  pozostają nieznane, a budżet jest preferencją miękką.
- Odcisk lodówki obejmuje ilości, jednostki, daty, dokładność i potwierdzenia.
  Podgląd zmiany dodatkowo obejmuje wersje wizyt i tygodni. Apply ponownie sprawdza
  aktualne ograniczenia profilu. Nieaktualne podglądy nie częściowo zapisują zmian.
- Istniejące mutacje v2/v3 odrzucają schema 4. Wspólne workery, ceny i rewizje
  zachowują nowe pola; zapis obniżający wersję dokumentu jest odrzucany.
- Intencje formularza, generowania, rewizji i czynności sklepu/gotowania są
  zachowane lokalnie do potwierdzenia. Odhaczenie pokazuje zapis oczekujący;
  ponowienie po powrocie sieci korzysta z tej samej treści i tego samego ID.

## API

Operacje dostępne pod `/v4` (z dotychczasowym prefiksem kontekstu `/api`):

| Trasa | Zastosowanie |
| --- | --- |
| `GET /shopping-preferences` | Preferencje z rozróżnieniem starego wymuszenia promocji i świadomego wyboru v4 |
| `POST /meal-plans/start` | Utrwalona intencja utworzenia i uruchomienia tygodnia |
| `GET /meal-plans/{id}/shopping-preview` | Podgląd bez mutacji |
| `POST /meal-plans/{id}/trips` | Utworzenie/przeliczenie jednej otwartej wizyty |
| `GET /shopping-trips`, `GET /shopping-trips/{id}` | Odczyt wspólnej listy i historii |
| `GET /shopping-trips/pending-manual` | Propozycja wybrania pozycji ręcznych |
| `POST /shopping-trips` | Wizyta wyłącznie z ręcznych produktów |
| `POST /shopping-trips/{id}/lines[/{lineId}]` | Dodatkowy produkt lub stan wiersza |
| `POST /shopping-trips/{id}/confirm` | Fakty zakupów i wybrane importy |
| `POST /shopping-trips/{id}/retry-import` | Dokończenie pominiętych importów |
| `POST /shopping-trips/{id}/undo-import` | Bezpieczne cofnięcie importu |
| `POST /meal-plans/{id}/change-previews`, `POST .../apply-change` | Podgląd partii/przeniesienia/porcji/przepisu i atomowe zastosowanie |
| `GET .../batches/{batchId}/preview`, `POST .../cook`, `POST .../undo` | Serwerowe rozliczenie gotowania |
| `POST .../allocations/{slotId}/eat` | Jedzenie całych lub części przydzielonych porcji |
| `GET .../today?date=YYYY-MM-DD` | Lokalny dzień lub najbliższy zaplanowany dzień |
| `GET .../resources`, `GET /ready-portions` | Konflikty zapasów i pozostałe porcje |
| `POST .../ready-portions` | Przydział wolnych ugotowanych porcji |
| `POST .../inventory-reviewed` | Potwierdzenie przeglądu po korekcie zapasów |

Istniejące operacje generowania, cen i rewizji mają również trasy v4. Rewizje AI
wykorzystują dotychczasowe limity, walidację, trwałe rezerwacje i komponent edytora;
nowy podgląd rozlicza całą partię i sprawdza aktualność zapasów.

## Faktyczne testy

Środowisko: Node **24.12.0**, Java **Zulu 17.0.20.1**, PostgreSQL **17-alpine**.
Domyślna Java hosta to 25, a automatyczna konfiguracja powłoki w katalogu frontendu
potrafi przełączyć Node na 20; testy uruchomiono z jawnym PATH dla Node 24 i JAVA_HOME
z Java 17. Nie zmieniano deklarowanych wymagań projektu.

- `npm run typecheck`, `npm run lint`, `npm run build`: przeszły.
- `npx vitest run --maxWorkers=2`: **138/138**, 29 plików (w tym trwałe intencje,
  replay po braku sieci i lokalne daty Warszawy w zmianie czasu).
- Wymagane cztery pliki Playwright: **9/9**. Obejmują starszy planer i ręczną listę.
- Pełny backend: **237 testów: 233 wykonane poprawnie, 4 pominięte warunkowo,
  0 błędów**. `WeekCycleIntegrationTest` zawiera 13 nowych przypadków, w tym
  opakowanie 500 g, rewizję v4 i porcje między tygodniami.
- `DatabaseMigrationIT`: wszystkie 4 testy przeszły na PostgreSQL z Flyway i
  `ddl-auto=validate`, z migracjami V30–V32.
- Rozszerzony `BrowserPlannerSmokeIT`: **5/5 scenariuszy Playwright** przeszło na
  rzeczywistym lokalnym frontendzie, API i izolowanej H2 z kontrolowanym Gemini.
  Dwa scenariusze chronią starszy interfejs, trzy sprawdzają cykl na 360/390/1440 px.
  Dokładny siedmiodniowy scenariusz 360 px przeszedł. Dodatkowy świeży przebieg
  1440 px potwierdził zwolnienie porcji w interfejsie, przydzielenie ich w nowym
  tygodniu i zjedzenie bez zmiany surowych 100 g ryżu.
- `git diff --check`: przeszedł po finalizacji zmian i raportu.

Testy nie korzystają z prawdziwych zapasów ani płatnego AI. Pominięcia warunkowe
obejmują m.in. zewnętrzny katalog i opt-in smoke, gdy uruchamiany jest zwykły pełny
zestaw backendu; osobny przebieg opt-in przeglądarki wykonuje się rzeczywiście.

### Bilans referencyjny

Test backendowy z prywatną ceną opakowania sprawdza:
`200 g → zapotrzebowanie partii 600 g → brak 400 g → 1 × 500 g i nadwyżka 100 g →
700 g po zakupie → 100 g po jednym gotowaniu → 100 g po zjedzeniu porcji →
50 g braku przy przyszłych 150 g`. Repliki żądań nie zmieniają bilansu.

Scenariusze przeglądarkowe sprawdzają ten sam bilans od formularza do API i bazy,
historię pierwszej wizyty po nowej wizycie oraz kolejny tydzień bez wyjątków.
Scenariusz 360 px rozszerzono o pełne 7 dni, środę poza domem, czwartek 15 minut,
wycenę i automatyczną propozycję opakowania 500 g, niepełną wycenę i istniejący edytor rewizji v4.

### Problemy środowiska i obejścia

1. Docker zgłosił brak miejsca przy inicjalizacji testowego PostgreSQL. Nie
   czyszczono żadnych kontenerów ani wolumenów. Testowa baza używa teraz tmpfs;
   pozostaje prawdziwym PostgreSQL, z normalnym Flyway i walidacją schematu.
2. Zastany katalog wyników zawierał duplikaty nazw `.class` z sufiksem ` 2` i
   uszkodzone lokalne wpisy cache Gradle. Bez czyszczenia projektu uruchomiono
   weryfikację w `/private/tmp/recipeai-cycle-build`, z osobnym cache projektu.
3. Pierwsze przebiegi ujawniły nieaktualne selektory i brakujący widoczny stan
   oczekującego odhaczenia. Poprawiono testy i interfejs; nie przedstawiamy
   nieudanych prób jako poprawnych wyników.
4. Jeden przebieg został pominięty przez Gradle jako `UP-TO-DATE`; nie zaliczono go
   jako wykonania testu. Nowy scenariusz uruchomiono rzeczywiście. Jawny opt-in
   `RUN_BROWSER_PLANNER_SMOKE=1` obecnie zawsze wyłącza ponowne użycie wyników
   zadania testowego, ponieważ harness uruchamia również kod TypeScript.
5. Wyniki backendu i przeglądarki mają oddzielne katalogi tymczasowe; zapobiega to
   kolizjom raportów przy równoległych procesach Gradle. Przejściowa kolizja zapisu
   XML nie jest zaliczona jako poprawny przebieg; końcowe wyniki są niezależne.

## Granice

Brak publikacji produkcyjnej jest zamierzony. Offline obejmuje ostatni zapis i
oczekującą intencję z możliwością ponowienia, nie pełną synchronizację offline.
Nakładające się plany pokazują konflikt i wymagają przeliczenia; nie wprowadzono
rezerwacji zapasów między gospodarstwami. Nie nadano gotowym porcjom automatycznej
„bezpiecznej daty” — sposób przechowania i przydatność wymagają oceny użytkownika.

Decyzja techniczna: [ADR 0001](adr/0001-week-cycle-v4.md).

## Powtórzenie weryfikacji w tym środowisku

Z katalogu `frontend/recipeai`, z Node 24 na początku PATH:

```sh
npm run typecheck
npm run lint
npm run build
npx vitest run --maxWorkers=2
npx playwright test e2e/meal-planner.spec.ts e2e/meal-planner-simplification.spec.ts e2e/meal-planner-disclosures.spec.ts e2e/shopping-list.spec.ts --workers=2
```

W `backendApi` można użyć zwykłego `./gradlew test`. Zastane duplikaty klas w tym
konkretnym środowisku ominięto addytywną konfiguracją poza katalogiem repozytorium:

```sh
cat > /tmp/recipeai-cycle-test.gradle <<'GRADLE'
allprojects { layout.buildDirectory = file('/tmp/recipeai-cycle-verification') }
GRADLE
JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home ./gradlew --init-script /tmp/recipeai-cycle-test.gradle --project-cache-dir /tmp/recipeai-cycle-verification-cache test
RUN_BROWSER_PLANNER_SMOKE=1 PLANNER_TEST_NODE=/Users/jakub/.nvm/versions/node/v24.12.0/bin/node JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home ./gradlew --init-script /tmp/recipeai-cycle-test.gradle --project-cache-dir /tmp/recipeai-cycle-verification-cache test --tests '*BrowserPlannerSmokeIT'
```

Powyższe polecenia należy uruchamiać kolejno. Opcjonalny `PLANNER_TEST_GREP`
ogranicza przypadki Playwright (np. `week cycle.*1440`); bez niego harness uruchamia
stary planer i wszystkie trzy szerokości nowego cyklu. Nie wymaga klucza płatnego
AI ani połączenia z rzeczywistym magazynem użytkownika.

## Naprawa lokalnego kontenera — 8 listopada 2026

Po zgłoszeniu awarii kontenera odtworzono błąd Flyway: lokalna baza zdążyła
zastosować pierwotną V31, a późniejsza zmiana tego samego pliku dodała `discarded`.
Zapisana suma kontrolna wynosiła `1291847981`, a zmieniony plik miał `-217788695`.
Był to błąd kolejności migracji w tym wdrożeniu.

Przywrócono dokładną pierwotną V31 (checksum `1291847981`). Kolumna `discarded`
i jej warunek bilansu zostały przeniesione do addytywnej V32. Nie wykonano naprawy
historii Flyway, resetu bazy ani usuwania danych. Istniejący lokalny kontener
zastosował V32 (`904687935`) i zachował udaną historię V31.

Po uruchomieniu aplikacji wystąpił drugi, niezależny stan `DOWN`: lokalna kontrola
SMTP próbowała połączyć się z nieuruchomioną usługą pocztową. Kontrola mail została
wyłączona wyłącznie w profilu deweloperskim `docker`; konfiguracja produkcyjna
pozostaje bez zmian. Stan API/bazy nadal bierze udział w kontroli zdrowia.

Weryfikacja:

- odtworzony test V31 przed poprawką: błąd sumy kontrolnej;
- odtworzony test zdrowia przed poprawką: oczekiwano 200, otrzymano 503;
- test migracji istniejącej bazy V31 do V32: zachowane porcje, zjedzone ilości i ID
  partii, nowa wartość `discarded=0`;
- 4 testy PostgreSQL, test zdrowia profilu docker i 13 testów cyklu: przeszły;
- `recipeai-backend-1`: `running healthy`;
- `http://localhost/api/actuator/health`: HTTP 200, `status=UP`;
- `http://localhost/login`: HTTP 200.

Końcowy świeży pełny zestaw backendu po naprawie: **237 testów, 233 poprawne, 4 pominięte warunkowo, 0 błędów**. Zadanie `test` wykonane rzeczywiście; tylko kompilacja została wykorzystana z aktualnych wyników. `git diff --check` również przeszedł.

## Naprawa pobierania promocji — 8 listopada 2026

Odtworzono zaniżoną liczbę ofert: stary importer odczytywał wyłącznie 12 produktów
osadzonych w HTML, cztery dodatkowe adresy kategorii zwracały przekierowanie na
stronę główną, a słownik odrzucał wszystkie bieżące nazwy. Ostatnie pobranie miało
`LIVE_FETCH_INCOMPLETE`, 12 kandydatów i 0 opublikowanych cen. Stare zapisane oferty
kończyły ważność 7 listopada.

Importer korzysta teraz z publicznego katalogu JSON Lidla dla całej kategorii
„Żywność i napoje”, przechodząc kolejne strony po 48 wyników. Limit 20 stron,
czas pobierania i rozmiar odpowiedzi ograniczają pracę; osiągnięcie limitu, zmiana
liczby wyników, brak strony lub brakujące/konfliktowe produkty oznaczają niepełne
pobranie. W takim przypadku poprzednie ceny nie są wycofywane. Adresy żądań są
ściśle wyznaczone przez importer, bez dowolnych URL i bez podążania za redirectami.
API ofert zwraca rzeczywisty stan pobrania zamiast stałego `LIVE_PARTIAL`.

Dodano rozpoznawanie bieżących warzyw, owoców, goudy i jawnie zapakowanego mięsa
mielonego oraz normalizację twardych spacji. Zachowano weryfikację regionów, dat,
opakowań, limitów i kuponów. Nieznana masa całej paczki mięsa, słodycze i napoje
pozostają poza zakresem. Nieobsługiwany mechanizm gratis nie staje się wyliczoną
promocją; osobno podana cena poza promocją może być zapisana bez kuponu.

Rzeczywisty katalog w chwili weryfikacji zwrócił 15 pozycji. Do lokalnej bazy
zapisano **16 wariantów cen dla 11 składników**, z datami **9–10 listopada 2026**
(`SOURCE_VERSION=5`). Liczba wariantów obejmuje również jawne ceny poza promocją.
Dla zakupów 8 listopada te ceny prawidłowo nie są dostępne. Katalog nadal jest
częściowy: obsługuje zweryfikowane formaty składników do posiłków, a nie wszystkie
pozycje każdej gazetki; Biedronka nie ma automatycznego źródła.

Weryfikacja obejmuje zapisany publiczny zestaw danych z 8 listopada, przejście na
drugą stronę, niedostępną/powtórzoną stronę, zachowanie poprzednich cen i poprawny
status API. Opcjonalny `RUN_LIVE_PRICE_SMOKE=1` wymusza świeży test pobrania do
izolowanej bazy H2 oraz wyceny kontrolowanego planu bez płatnego AI. Rzeczywisty
test: 15 kandydatów, 16 zapisanych wariantów, 1 wyceniona pozycja (3,99 zł),
data zakupów 9 listopada. Lokalny kontener także automatycznie zapisał te ceny.

Końcowy pełny przebieg po tej poprawce z włączonym testem live: **241 testów, 238 poprawnych, 3 pominięte warunkowo, 0 błędów**. Frontend: kontrola typów, lint, build oraz 11 testów ofert/wyceny/sekcji interfejsu — poprawne. `git diff --check` poprawny; lokalny backend `healthy`, health HTTP 200 `UP`.


## Uproszczenie tygodnia i zakupów — 8 listopada 2026

Ta korekta zastępuje wcześniejsze założenie osobnej zakładki „Dzisiaj”. Główna
nawigacja ma wyłącznie „Tydzień” i „Zakupy”, również dla starszych planów.
Historyczne odnośniki `view=today` otwierają tydzień. Backendowe API dnia pozostaje
zgodne z wcześniejszymi klientami.

- Karty posiłków pokazują nazwę, czas, porcje, „Zamień” oraz menu „⋯”. Gotowanie,
  przenoszenie, porcje i zaawansowana edycja są dostępne po otwarciu menu;
  gotowanie i jedzenie również w szczegółach przepisu.
- Podgląd zamiany pokazuje proponowane danie przed zatwierdzeniem. Szczegóły
  przepisu są zwinięte, a podsumowanie zakupów pomija niezmienione pozycje.
- Lista zakupów pokazuje ilość całego proponowanego opakowania. Dokładny brak,
  zapasy i opcje produktu są w menu wiersza. Ceny i historia są wspólnie zwinięte.
- Potwierdzenie zakupów pokazuje ilość oraz jawny wybór dodania do lodówki.
  Korekta ilości, jednostki, dokładności i ceny wymaga rozwinięcia „Edytuj zakup”.
- Wyjątki tygodnia są w „Dostosuj” i pokazują kontrolki wybranego dnia.
  Dodatkowe opcje ręcznej listy również pozostają zwinięte.

Świeża weryfikacja po uproszczeniu:

- Frontend: **142/142 testy w 30 plikach**, kontrola typów, lint i build poprawne.
- Starszy planer i ręczne zakupy: **9/9 scenariuszy Playwright**.
- Rzeczywisty lokalny backend z izolowanymi kontami i kontrolowanym AI:
  **5/5 scenariuszy**, w tym pełny cykl na 360/390/1440 px. Zachowany bilans
  zakupów/gotowania, historia, porcje i kolejny tydzień.
- Po końcowej korekcie komunikatu nieznanej ilości powtórzono kontrolę typów,
  lint zmienionych plików, 4 testy uproszczenia oraz **2/2 scenariusze mobilne**,
  rozszerzone o polskie widoki. W teście komponentu odizolowano też pobieranie
  ofert, aby nie wysyłał przypadkowego żądania sieciowego.
- Oceniono zrzuty tygodnia, zakupów i potwierdzenia. Polskie widoki przy
  360 i 390 px nie mają przewijania poziomego; długie nazwy zawijają się,
  dodatkowe opcje pozostają schowane. Jest to emulacja rozmiaru telefonu
  w Chromium, nie test na fizycznym urządzeniu.

Poprawiono nieaktualne oczekiwania testów dotyczące nazw zakładek, aktualnego
źródła cen oraz rozróżnienia całego opakowania 500 g od dokładnego braku 50 g.
Weryfikacja dotyczy zmian lokalnych; nie wykonano publikacji produkcyjnej.


## Mobilny proces: promocje → 5 dni × 3 posiłki → zakupy

Dodano `e2e/five-day-mobile.spec.ts` uruchamiany przez BrowserPlannerSmokeIT.
Scenariusz używa polskiego interfejsu, dotyku i mobilnego viewportu 360/390 × 844.
Przechodzi od przycisku pobrania promocji, przez wybór 5 dni i trzech rodzajów
posiłków, do 15 gotowych przepisów i trwałej listy zakupów po przeładowaniu.
Sprawdza po pięć śniadań, obiadów i kolacji, tryb PROMOTIONS_FIRST, pełną
agregację i odjęcie zapasów: 4500 g potrzeby − 200 g w domu = 4300 g braku,
9 opakowań po 500 g.

Jest to rzeczywisty lokalny frontend, endpoint pobrania katalogu, API, worker
i izolowana baza. Katalog promocji oraz odpowiedzi Gemini są kontrolowanymi
danymi testowymi; ten test nie ocenia jakości rzeczywistych przepisów AI ani
bieżących cen sklepu. Nie używa danych użytkownika.

Ocena widoków wykazała zbędny przycisk ponownego pobierania promocji nad aktywną
listą zakupów oraz ryzyko przesłonięcia zakupów długim katalogiem. Aktywna lista
nie pokazuje już przycisku promocji; pobrany katalog rozwija się przez „Zobacz
promocje”. Formularz zachowuje na wierzchu liczbę dni, osoby i trzy typy posiłków,
a dodatkowe ustawienia pozostają zwinięte.


## Weryfikacja rzeczywistego konta — 8 listopada 2026

Rzeczywisty test ujawnił błąd niewidoczny na kontach bez zapisanych preferencji:
worker tracił sesję Hibernate podczas mapowania `dislikedIngredients`. Odczyt
`UserPreferencesService.getPreferences` otrzymał transakcję tylko do odczytu,
obejmującą pobranie encji i mapowanie DTO. Dodano regresję z utrwaloną listą
nielubianych składników poza żądaniem HTTP.

W nowym schemacie 4 promocje są wskazówką do planowania; niepełny katalog cen
nie wymusza wyceny połowy składników ani dwóch automatycznie wybranych produktów
w każdym daniu. Jawnie wskazane produkty i ograniczenia żywieniowe pozostają
walidowane. Starszy rygorystyczny tryb schematów 2/3 zachowano. Dodano regresję
braku cen, diagnostykę odrzucania przepisu i zatrzymania workera.

Świeże testy: 16 WeekCycleIntegrationTest i 7 PromotionFirstPlannerIntegrationTest
— wszystkie przeszły. Lokalny backend automatycznie wczytał poprawki.

Rzeczywisty test w zalogowanej przeglądarce zakończył generowanie 15/15 posiłków
na 9–13 listopada dla 2 osób. Powstała trwała lista zakupów i zachowała się po
odświeżeniu. Nie oznaczano zakupów ani nie zmieniano zapasów. Mobilny widok
390 px sprawdzono wizualnie. Usunięto mylący licznik ukończonej części zadania,
przetłumaczono działy owoców/warzyw i poprawiono komunikat dla zerowej ilości
wymagającej przeglądu. Lista ujawniła również mieszane PL/EN nazwy składników
z wcześniejszych danych; nie zastosowano niepewnego automatycznego scalania.
