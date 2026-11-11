# Plan wdrożenia tygodniowego jadłospisu i zakupów

Data: 8 listopada 2026 r.
Status: plan do wdrożenia. Etapy 0–8 opisują zakres docelowy, a nie wykonane zmiany.

Celem jest obsługa jednego procesu: ustalenie tygodnia → sprawdzenie zapasów → propozycja posiłków → zakupy → gotowanie → korekty z wykorzystaniem tego, co zostało. Użytkownik powinien powtarzać jak najmniej ustawień, korzystać z jednej listy podczas zakupów i móc zmienić tydzień bez utraty informacji o kupionych produktach.

Wdrożenie należy prowadzić etapami opisanymi poniżej. Pierwszy dostarcza prostsze rozpoczęcie planowania, kolejne wprowadzają wspólne zakupy i prawidłowe rozliczenie porcji, a ostatnie zamykają codzienny proces. Pełny zakres obejmuje wszystkie etapy, nie tylko zmianę wyglądu.

## Punkt wyjścia

Podstawą jest bieżący kod repozytorium. W katalogu roboczym są liczne wcześniejsze zmiany, także niezapisane w commitach. Należy je zachować. Dokument [PLAN_UPROSZCZENIA_JADLOSPISU.md](PLAN_UPROSZCZENIA_JADLOSPISU.md) opisuje wcześniejsze uproszczenie interfejsu. Jego historyczne wyniki testów nie potwierdzają wykonania tego planu.

| Obszar | Obecna implementacja | Zmiana potrzebna w tym wdrożeniu |
| --- | --- | --- |
| Rozpoczęcie | Formularz tworzy plan, oddzielna akcja uruchamia generowanie | Jedna świadoma akcja zapisuje ustawienia i rozpoczyna generowanie, z możliwością wznowienia po błędzie |
| Preferencje | Zapisane ustawienia zakupów oraz osobny profil diet i nielubianych składników | Wykorzystanie istniejących danych, wyjątki dla konkretnych dni i krótkie podsumowanie |
| Generowanie | Zadania w tle, biblioteka przed AI, wersjonowanie, limity i ponawianie | Planowanie dostępności i zapasów całego tygodnia; promocje opcjonalne |
| Promocje | Nowe plany v3 są wymuszane jako `PROMOTIONS_FIRST`; generowanie może zakończyć się `PRICE_COVERAGE_UNAVAILABLE` | Domyślny tryb praktycznego tygodnia, który działa także bez cen; dotychczasowy tryb ofert pozostaje dostępny |
| Zapasy | Agregacja odejmuje lodówkę; w trybie `PROMOTIONS_FIRST` kontekst generowania używa `FridgePolicy.IGNORE` | Zapasy i produkty do wykorzystania uczestniczą również w doborze dań |
| Porcje | Każdy slot zawiera własną migawkę przepisu i porcje | Jedno gotowanie może zapewnić posiłki na dwa dni bez podwójnego zapotrzebowania |
| Zakupy | Checklista planu i ręczna lista są odrębne | Jeden widok konkretnej wizyty w sklepie, z zachowaniem pochodzenia pozycji |
| Odhaczenia | `checkedKeys` bazuje na kluczach zależnych m.in. od ilości | Osobny trwały zapis faktycznego zakupu, niezależny od późniejszego zapotrzebowania |
| Lodówka po zakupach | Ręczna lista ma podgląd importu do lodówki i operacje magazynowe | Ten sam mechanizm obejmuje zakupy z planu i chroni przed powtórnym importem |
| Gotowanie | Istnieją pomocnicze funkcje zużycia składników i operacje `COOKED_RECIPE` | Powiązanie wykonania z konkretnym gotowaniem w planie, kontrola porcji i cofania |
| Poprawki | Podgląd, zastosowanie i cofnięcie rewizji przepisu | Podgląd wpływu na już kupione składniki, pozostałe porcje i dodatkowe zakupy |

To rozpoznanie kodu, nie nowy wynik testów wykonania. Model wdrażający ma zweryfikować aktualny stan przed zmianami.

## Decyzje produktowe

1. **Krótki start.** Podstawowe pola: od kiedy, ile dni, dla ilu osób, jakie posiłki. Podsumowanie sklepu i daty zakupów pozostaje widoczne. Pozostałe ustawienia są rozwijane. Na początek wykorzystać obsługiwane `LUNCH` i `DINNER`; rozszerzanie typów posiłków nie jest konieczne.
2. **Preferencje pamiętamy.** Dieta i wykluczenia korzystają z obecnego profilu. Nie tworzyć drugiej kopii profilu w nowym formularzu. Nie przedstawiać nielubianych składników jako zweryfikowanego systemu alergii.
3. **Wyjątki dotyczą konkretnego tygodnia.** Można wskazać posiłek poza domem, krótszy czas danego dnia i gotowanie większej porcji. Nie kopiować datowanych wyjątków do każdego następnego tygodnia.
4. **Sprawdzenie lodówki jest opcjonalne.** Sekcja „Wykorzystaj w tym tygodniu” pokazuje istniejące produkty. Można wskazać priorytety, poprawić ilość, oznaczyć brak lub pominąć przegląd. Pominięcie przeglądu nie oznacza potwierdzenia dokładności zapasów.
5. **Jedna akcja uruchamia planowanie.** Po konfiguracji i opcjonalnym przeglądzie zapasów przycisk „Zaplanuj tydzień” zapisuje plan i uruchamia zadanie. Nie pokazywać po drodze pustego tygodnia wymagającego drugiego kliknięcia.
6. **Promocje są pomocą w zwykłym planowaniu.** Domyślnie liczą się ograniczenia, czas, zapasy i użycie wspólnych składników. Brak cen nie blokuje planu. „Ułóż z promocji” pozostaje świadomą opcją zaawansowaną z dotychczasowymi ograniczeniami.
7. **Jeden sklep jest domyślny.** Dwie wybrane sieci pozwalają porównać dwa warianty jednej wizyty. Zakupy w dwóch sklepach wymagają wyboru użytkownika. Nie sugerować oszczędności na podstawie nieporównywalnych niepełnych wycen.
8. **Lista zakupów ma podgląd przed rozpoczęciem zakupów.** Zwykłe otwarcie zakładki jest odczytem. „Przejdź do zakupów” może utworzyć lub uaktualnić listę jako rezultat świadomej akcji, bez dodatkowego ekranu „zaakceptuj, aby utworzyć”. Zakończenie zakupów jest oddzielną akcją.
9. **Jedna lista podczas wizyty.** Składniki planu i dodatkowe produkty są widoczne razem. Dane zachowują pochodzenie, aby zmiana jadłospisu nie usuwała kawy czy detergentu wpisanego ręcznie.
10. **Po zakupach chronimy wykonane czynności.** Kupione ilości i ugotowane porcje są faktami. Nowa wersja przepisu nie może ich nadpisać. Zmiany przedstawiają nowe braki i produkty, które zostaną niewykorzystane.
11. **Codzienny widok odpowiada na pytanie „Co dziś gotuję?”.** Po rozpoczęciu realizacji tygodnia jest domyślny przy zwykłym wejściu. Jawny odnośnik do tygodnia lub zakupów ma pierwszeństwo.
12. **Użytkownik może pominąć część ewidencji.** Zakończenie zakupów nie wymaga dokładnej ilości każdego produktu ani dodania detergentu do lodówki. „Ugotowane” może oznaczyć wykonanie bez aktualizacji zapasów, ale aplikacja zapisuje wtedy, że stan zapasów wymaga sprawdzenia.

## Docelowa ścieżka użytkownika

| Moment | Główna zawartość | Główna akcja | Wynik |
| --- | --- | --- | --- |
| Nowy tydzień | Zapisane ustawienia i wyjątki, opcjonalny przegląd zapasów | Zaplanuj tydzień | Powstaje plan i trwałe zadanie generowania |
| Generowanie | Zapisane już dania i jeden komunikat postępu | Zatrzymaj po tym daniu | Można wyjść, wrócić i wznowić braki |
| Przegląd | Lista dni, czas, porcje, znany koszt i liczba brakujących cen | Przejdź do zakupów | Otwiera się wyliczona lista dla wizyty |
| Zakupy | Działy sklepu, ilości i opakowania, dodatkowe pozycje | Zakończ zakupy | Krótki podgląd tego, co faktycznie kupiono |
| Potwierdzenie zakupów | Ilości rzeczywiste i wybór pozycji do lodówki | Potwierdź zakupy | Zapis zakupów oraz jednokrotna aktualizacja wybranych zapasów |
| Dzień gotowania | Dzisiejsze dania i dostępne porcje | Otwórz przepis lub Oznacz jako ugotowane | Jedno rozliczenie gotowania i zapasów |
| Zmiana tygodnia | Przenieś, zamień lub pomiń oraz wpływ na zakupy | Zastosuj zmianę | Aktualizują się tylko przyszłe potrzeby |
| Następny tydzień | Te same preferencje, aktualne zapasy i niewykorzystane porcje | Zaplanuj kolejny tydzień | Nowy plan bez ponownego pełnego formularza |

Plan częściowy również może przejść do zakupów. Interfejs jasno podaje, ilu posiłków dotyczy lista. Brak cen, przerwane generowanie i plan z samymi pominiętymi posiłkami mają odrębne komunikaty; pusty plan nie tworzy pozornej listy składników.

## Model danych i reguły obliczeń

Poniższe nazwy są proponowanymi pojęciami implementacyjnymi. Można dopasować nazwy klas do repozytorium, zachowując znaczenie i niezmienniki. Rozbudować obecny backend; nie wprowadzać osobnej usługi ani drugiej bazy danych.

### Ustawienia tygodnia i zapasy

- Preferencje stałe pozostają przy koncie. Plan przechowuje ustawienia dla konkretnego tygodnia i użyte ograniczenia; przy generowaniu uwzględnić również aktualne wykluczenia profilu. Zmiana profilu nie przepisuje automatycznie historycznych dań.
- Wyjątek slotu ma datę, rodzaj posiłku, opcjonalny limit czasu i powód pominięcia. Liczba osób jest domyślna, a porcje mogą się różnić dla slotu.
- Wskazanie „wykorzystaj najpierw” odwołuje się do zapasu, ale nie usuwa go ani nie zużywa. Nieznana ilość pozostaje nieznana. Zmiana ilości w przeglądzie korzysta z obecnej operacji lodówki.
- Agregacja bierze pod uwagę datę wykorzystania, zgodne jednostki i dokładność ilości. Nie zakładać równoważności surowego i ugotowanego produktu ani przelicznika g↔ml bez danych.
- Bieżące zapasy są źródłem dostępności. Przy podglądzie zastosowania zmiany zapisać wersję lub odcisk użytych zapasów i sprawdzić go ponownie przy zatwierdzeniu.
- Wspólna alokacja zapasów w obrębie tygodnia nie może użyć tej samej ilości wielokrotnie. Dla nakładających się aktywnych planów pokazywać konflikt wykorzystania tych samych zapasów i ponownie przeliczać przed zakupami. Pełne rezerwacje między gospodarstwami i wieloma wizytami pozostają poza zakresem.

### Gotowanie i porcje

Wprowadzić pojęcie `CookingBatch`: jedno planowane lub wykonane gotowanie z migawką przepisu, liczbą przygotowywanych porcji i stabilnym identyfikatorem. Slot posiłku odwołuje się do tej partii i określa, ile porcji zostanie zjedzonych. Jeden zwykły posiłek odpowiada jednej partii.

Przykład: przepis na 2 porcje wymaga 300 g ryżu. Użytkownik gotuje 4 porcje: 2 na poniedziałek i 2 na wtorek. Zapotrzebowanie wynosi 600 g ryżu raz. Poniedziałek pokazuje „Ugotuj 4 porcje”, a wtorek „2 porcje z poniedziałku”. Oznaczenie wtorkowego posiłku jako zjedzonego nie odejmuje surowego ryżu ponownie.

- Suma zaplanowanych i już zużytych porcji nie przekracza liczby rzeczywiście przygotowanej bez jawnej korekty.
- Przed gotowaniem liczba przygotowywanych porcji może się zmieniać wraz z alokacją. Po gotowaniu nie przeliczać historii przepisu; zwalniać lub przydzielać pozostałe porcje.
- Rezygnacja z wtorkowego posiłku przed gotowaniem może zmniejszyć partię albo zostawić dodatkowe porcje — użytkownik widzi prosty wybór. Po gotowaniu zmienia wyłącznie przydział gotowych porcji.
- Przeniesienie posiłku na datę wcześniejszą niż gotowanie wymaga również przeniesienia gotowania albo zmiany powiązania. Zajęte miejsce wymaga jawnej zamiany miejsc; żadnego cichego zastąpienia dania.
- Nie dopuszczać cykli i osieroconych odwołań. Gotowanie nie może zależeć od późniejszego odgrzania.
- Pozostałe porcje mają własną ewidencję, odrębną od surowych składników. Nie tworzyć dla nich dowolnej „daty bezpiecznego spożycia” wygenerowanej przez AI. Użytkownik może oznaczyć przechowanie, zamrożenie lub usunięcie; nieznana przydatność wymaga sprawdzenia.
- Powtórzenie przepisu oznacza dwa gotowania; „ugotuj na dwa dni” oznacza jedną partię. Opcja `allowRepeats` nie zastępuje modelu partii.

### Wizyta zakupowa i faktyczne zakupy

Wprowadzić `ShoppingTrip`: wizyta powiązana z jednym planem i wybranymi dodatkowymi pozycjami. Jeden plan może mieć kolejne wizyty uzupełniające, ale na początek tylko jedną otwartą wizytę naraz. Zakończona wizyta pozostaje w historii.

Wiersz wizyty powinien rozróżniać:

- stabilną tożsamość wiersza oraz źródła zapotrzebowania;
- ilość potrzebną do przyszłych gotowań i ilość pokrytą przez zapasy;
- ilość do kupienia oraz sugerowaną liczbę opakowań, jeśli znana;
- ilość faktycznie kupioną, jednostkę, dokładność, datę i opcjonalną cenę rzeczywistą;
- stan sprawdzenia w sklepie oraz powiązanie z operacją dodania do lodówki.

Obecny `ShoppingItem.key`, zależny od wymaganej ilości, może nadal służyć do identyfikacji wersji zapotrzebowania i unieważniania wyceny. Nie może być jedynym identyfikatorem zapisu zakupu. Zmiana potrzeb z 500 g na 700 g nie może usunąć informacji, że kupiono już 500 g.

Po potwierdzeniu importu zakup zwiększa stan lodówki. Kolejne obliczenie nie odejmuje równocześnie tego zakupu jako drugiego, niezależnego zasobu. Wiersz zakupu jest dowodem i źródłem historii, a dostępna ilość wynika z aktualnego stanu zapasów i zużycia. Zakup, którego użytkownik nie dodał do lodówki, pozostaje widoczny jako nieuzgodniony; nie gwarantować na jego podstawie zerowych dodatkowych zakupów.

Ręczna pozycja dołączona do wizyty zachowuje identyfikator źródła. Nie kopiować całej ręcznej listy automatycznie do każdego planu. Przy pierwszym wejściu zaproponować dołączenie oczekujących pozycji, a nowe wpisy w widoku wizyty przypisywać do tej wizyty. Deterministycznie łączyć tylko rozpoznany ten sam składnik o zgodnych jednostkach i jasnej intencji ilości; pozycje niejednoznaczne zostawić osobno. Przed połączeniem ręcznego „mleko” z mlekiem z planu pozwolić wybrać, czy jest to dodatkowa ilość, czy przypomnienie o tym samym zakupie.

### Stany i wersjonowanie

Nie sprowadzać całego procesu do obecnego `DRAFT`/`ACCEPTED`. Zachować rozdzielone stany:

| Obiekt | Proponowane stany | Znaczenie |
| --- | --- | --- |
| Plan | Dotychczasowa akceptacja i wersja | Stan ustaleń, nie dowód zakupu lub gotowania |
| Zadanie generowania | Istniejące stany zadania | Postęp i możliwość wznowienia |
| Wizyta | `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Osobne wizyty i ich historia |
| Partia gotowania | `PLANNED`, `COOKED`, `CANCELLED` | Jednokrotne przygotowanie składników |
| Udział porcji w posiłku | `PLANNED`, `EATEN`, `SKIPPED` | Wykorzystanie gotowych porcji |

Stan „tydzień w realizacji” można wyliczać z dat, wizyt i gotowań. Nie dodawać kolejnego niezależnego pola, jeśli można go jednoznacznie wyprowadzić.

Każda mutacja sprawdza właściciela i właściwą wersję obiektu. Wieloobiektowa operacja potwierdzenia zakupów albo gotowania jest transakcyjna, z trwałym identyfikatorem żądania. Powtórzenie tego samego żądania zwraca wcześniejszy wynik; ten sam identyfikator z inną treścią daje konflikt. Identyfikator musi przetrwać przeładowanie i utratę odpowiedzi, nie tylko istnieć w pamięci komponentu.

## Etapy wdrożenia

### Etap 0 Uzgodnienie kontraktów i zgodność danych

**Wynik:** kolejne funkcje można dodać bez utraty starszych planów i zapisów.

1. Przeczytać instrukcje repozytorium, `CONTEXT.md`, dokumenty planera i `git status`. Zweryfikować powyższą mapę kodu i odnotować różnice.
2. Opisać kontrakty partii gotowania, wizyty zakupowej, faktycznego zakupu i wyjątków tygodnia w krótkim ADR w istniejącym miejscu dokumentacji decyzji albo w `docs/adr/`, jeśli jeszcze nie istnieje.
3. Przyjąć nową wersję dokumentu planu, odrębną od wersji endpointów. Dla nowych znaczeń udostępnić kontrakt v4; zachować odczyt starszych planów przez nowy klient.
4. Wszystkie stare ścieżki zapisu v2/v3 muszą odrzucić mutację dokumentu z nowymi, nieobsługiwanymi danymi przed zapisem. Sam dodatkowy frontendowy warunek nie wystarczy. Dotyczy również workerów, rewizji, cen i synchronizacji listy.
5. Migracje wyłącznie addytywne, z numerami dobranymi do aktualnego repozytorium. Nie modyfikować już zastosowanych migracji. Przy odczycie starego slotu interpretować go jako jedno samodzielne gotowanie; samo odczytanie nie wykonuje migracji zapisu ani operacji na lodówce.
6. Zachować stare odhaczenia jako stan checklisty. Nie tworzyć na ich podstawie historycznych zakupów, dat zakupu ani dowodu dodania do lodówki.
7. Ustalić wspólny kontrakt ilości, zaokrągleń i wersji zapasów. Wykorzystać istniejącą normalizację składników i konwersję jednostek po stronie serwera.

**Odbiór:** stare plany z budżetem i bez niego dają się odczytać; stare endpointy nie obcinają nowych pól; migracje działają na PostgreSQL; próba mutacji obcego planu/wizyty/partii nie zmienia danych.

### Etap 1 Jedno uruchomienie planowania i łatwy powrót

**Zależność:** etap 0. **Wynik:** użytkownik nie przechodzi przez pusty plan wymagający kolejnego kliknięcia.

1. Przycisk formularza zmienić na „Zaplanuj tydzień”. Wykonać zapis i start istniejącego trwałego zadania w ramach jednej intencji użytkownika. Nie uruchamiać AI jako efekt montowania komponentu.
2. Utrwalić identyfikatory tworzenia i generowania. Po udanym utworzeniu zapamiętać `planId`; błąd startu zadania daje „Wznów planowanie”, a nie kolejny nowy plan.
3. Po przeładowaniu odczytywać serwerowy stan zadania. Nie generować drugi raz po utracie odpowiedzi i nie zastępować zapisanych dań przy uzupełnianiu braków.
4. Zostawić krótki formularz, ustawienia dodatkowe i widoczne podsumowanie sklepu/daty. Zachować preferencje; nowych ofert i potwierdzeń kuponów nie kopiować z poprzedniego tygodnia.
5. Dla „Przejdź do zakupów” wykorzystać lub rozszerzyć obecną akceptację tak, aby świadoma akcja od razu otwierała gotową listę. Bez dodatkowego potwierdzenia i bez mutacji podczas samego `GET` lub otwarcia zakładki.
6. Przy bezpośrednim wejściu w Zakupy przed akceptacją pokazać podgląd wyliczony przez serwer. Dodać odczyt podglądu, jeśli obecne API go nie udostępnia. Wspólną wizytę z etapu 4 podłączyć później w to samo miejsce.
7. Zachować działającą nawigację do konkretnego planu, historię, nowy plan, szkice i ochronę przed spóźnioną odpowiedzią.

**Główne miejsca:** `MealPlanner.tsx`, `MealPlanForm.tsx`, `mealPlans.ts`, `MealPlanController`, `MealPlanService`, `MealPlanJobService`.

**Odbiór:** jedno kliknięcie formularza uruchamia tydzień; dwuklik, timeout i przeładowanie nie tworzą duplikatu planu ani zadania; częściowy tydzień przechodzi do zakupów; zwykłe otwarcie zakładki niczego nie akceptuje.

### Etap 2 Tydzień dopasowany do czasu i zapasów

**Zależność:** etap 1. **Wynik:** plan uwzględnia rzeczywisty tydzień i działa bez katalogu cen.

1. Dodać prosty wybór wyjątków: posiłek poza domem i limit czasu danego slotu. Pozostałe wartości dziedziczyć z ustawień tygodnia.
2. Dodać opcjonalną sekcję „Wykorzystaj w tym tygodniu” przed generowaniem. Pokazać produkty według znanych terminów, umożliwić priorytet i korektę przez istniejące operacje lodówki. Nie wymagać pełnego spisu zapasów.
3. Dodać domyślny tryb `PRACTICAL` lub równoważny. Usunąć wymuszanie `PROMOTIONS_FIRST` dla tego kontraktu, także w kontrolerze. Istniejących planów nie przełączać po cichu.
4. W trybie praktycznym dostarczać zapasy do doboru z biblioteki i do AI. Preferować produkty do wykorzystania, ograniczać nowe składniki, uwzględniać inne dania i pozostałe ilości w tygodniu. Ceny stanowią dodatkową wskazówkę.
5. Oddzielić twarde warunki od preferencji. Dieta/wykluczenia, liczba porcji, pominięcia i limit czasu muszą przejść walidację. Budżet, różnorodność, wykorzystanie zapasów i promocje są kryteriami porządkowania kandydatów. Nie rozluźniać wykluczeń, gdy nie uda się znaleźć dania.
6. Ranking ograniczyć do skończonej liczby kandydatów i prób. Wykorzystać obecną bibliotekę, walidatory, limity i trwałego workera. Nie wprowadzać nieograniczonego wyszukiwania ani wielokrotnych płatnych generacji w celu minimalnej oszczędności.
7. Dla braku cen pokazać znany subtotal i liczbę niewycenionych pozycji. Nie zatrzymywać zwykłego planu; w zaawansowanym trybie promocji zachować jego jawne warunki i komunikat błędu.
8. Pozwolić planować tydzień poza horyzontem aktualnych promocji. Oznaczyć wtedy ceny jako niedostępne do potwierdzenia później, bez wymuszania fałszywej daty zakupów. Data zakupów nie może pokrywać posiłków zaplanowanych przed tą wizytą, jeśli nie mają zapasów.

**Główne miejsca:** formularz, profil preferencji, kontekst lodówki, `MealPlanGenerationService`, `MealPlanCandidateService`, `GeneratedRecipeValidator`, `MealPlanJobWorker`, kontrakty ustawień.

**Odbiór:** brak ofert nie blokuje trybu praktycznego; pominięty posiłek nie jest generowany; wtorkowy limit 15 minut jest respektowany; zapas nie jest wydawany kilka razy; nieznana ilość nie znika jako potwierdzone pokrycie; tryb promocji nadal działa zgodnie ze swoim kontraktem.

### Etap 3 Gotowanie na dwa dni i przenoszenie posiłków

**Zależność:** etap 2. **Wynik:** oszczędzanie czasu nie powoduje podwójnych zakupów.

1. Wprowadzić partie i alokację porcji zgodnie z modelem wyżej. Najpierw agregacja i API, następnie akcje interfejsu.
2. Dodać „Ugotuj na dwa dni” z domyślną propozycją następnego odpowiedniego slotu i możliwością wyboru. Zajęty slot pokaże skutki zastąpienia przed zapisem.
3. Skalować składniki raz dla całej partii. Slot korzystający z gotowych porcji nie generuje drugiego zapotrzebowania na surowe składniki.
4. Rozszerzyć operacje przenieś, pomiń, zmień porcje, zamień i blokuj tak, aby respektowały zależności partii. Nie pozwalać na przypadkową zamianę przepisu tylko w połowie jednej partii.
5. Zaktualizować wycenę, podgląd rewizji i synchronizację zakupów, aby używały tej samej agregacji. Usunąć rozbieżne liczenie po stronie UI.
6. W generowaniu uwzględniać zadeklarowane gotowanie na dwa dni jako jedną partię. W pozostałych dniach zachować różnorodność; nie utożsamiać tego z dowolnymi powtórkami.

**Główne miejsca:** DTO i zapis planu, `PlanIngredientAggregationService`, `MealPlanService`, `MealPlanRevisionService`, `MealPlanPricingService`, `MealPlanSlotCard.tsx`.

**Odbiór:** test 2+2 porcji liczy 600 g ryżu raz; przeniesienie gotowania kontroluje powiązane dni; usunięcie drugiego dnia nie usuwa pierwszego; zmiana porcji daje spójny podgląd listy i ceny; stary plan zachowuje wcześniejsze ilości.

### Etap 4 Jedna lista na wizytę w sklepie

**Zależności:** etapy 1–3. **Wynik:** w sklepie użytkownik nie przełącza się pomiędzy listą jadłospisu a ręcznymi zakupami.

1. Dodać wizytę i trwałe wiersze z odwołaniami do źródeł. `Przejdź do zakupów` tworzy albo aktualizuje jedną otwartą wizytę dla planu.
2. Widok Zakupy w planerze i strona listy zakupów mają otwierać ten sam obiekt wizyty, a nie dwie niezależne kopie. Zachować możliwość korzystania wyłącznie z ręcznej listy bez planu.
3. Zaproponować dołączenie oczekujących ręcznych pozycji; zapewnić dodawanie dowolnego produktu bez opuszczania wizyty. Edycja planu aktualizuje tylko jego wkład w zapotrzebowanie.
4. Na wierszu pokazać prosty komunikat „Kup”, a potrzebne szczegóły pod rozwinięciem: potrzeba, z domu, opakowania, nadwyżka i posiłki korzystające ze składnika.
5. Grupować według sklepu i działu. Jeśli cena/oferta nie określa działu, użyć rozpoznanej kategorii składnika lub „Pozostałe”; nie uzależniać czytelności listy od kompletności cen.
6. Dodać stany pozycji: do kupienia, w koszyku, niedostępne. Odhaczenie jeszcze nie dodaje do lodówki. Pozycje pokryte z domu są zwinięte, a ilości do sprawdzenia pozostają wyraźne.
7. Zachować raport „nie ma produktu” i powiązać go z zamiennikiem albo poprawką posiłku. Pełne dopasowanie zamiany do zapasów zostanie ukończone w etapie 7.
8. Obsłużyć utratę połączenia: zachować ostatnią listę oraz niezapisane odhaczenie, pokazać stan zapisu i ponowić po odzyskaniu połączenia. Nie deklarować pełnego trybu offline ani sukcesu, którego serwer nie potwierdził.
9. Zmiana wymaganej ilości oznacza wiersz do ponownego sprawdzenia. Zachowuje istniejący wpis rzeczywistego zakupu, jeśli taki już powstał.

**Główne miejsca:** `ShoppingList.tsx`, `PlanShoppingGroups.tsx`, `PlanShoppingIssue.tsx`, `shoppingList.ts`, `ShoppingListService`, nowy agregat wizyty oraz istniejąca agregacja i wycena.

**Odbiór:** ryż z planu i ręczny detergent są na jednej liście; zmiana dania nie usuwa detergentu; niejednoznaczne „mleko” nie zostaje automatycznie zdublowane ani scalone; przeładowanie zachowuje stan; cena nieznana nie blokuje odhaczenia.

### Etap 5 Potwierdzenie zakupów i aktualizacja lodówki

**Zależność:** etap 4. **Wynik:** aplikacja zna faktyczne zakupy i nie dodaje ich wielokrotnie.

1. „Zakończ zakupy” otwiera krótki podgląd pozycji w koszyku. Sugerować ilość kupionych opakowań, a nie tylko ilość potrzebną w przepisie. Gdy dane są nieznane, umożliwić wpisanie albo pozostawienie nieznanej ilości.
2. Pozwolić poprawić ilości, zaznaczyć produkty niedostępne i wybrać żywność do dodania do zapasów. Cena rzeczywista jest opcjonalna i odrębna od szacunkowej wyceny sklepu.
3. Utrwalić wpisy zakupów i powiązać je z operacją `FridgeInventoryOperationService`. Potwierdzenie, aktualizacja zapasów i zapis powiązania muszą być transakcyjne albo mieć trwałą, testowaną ścieżkę dokończenia bez podwójnego efektu.
4. Powtórzenie potwierdzenia po timeoutcie, w drugim oknie lub po przeładowaniu zwraca ten sam rezultat. Uwzględnić istniejące wyniki częściowe operacji lodówki: pozycje pominięte nie mogą wyglądać na zaimportowane.
5. Zakończenie wizyty jest możliwe przy niekupionych pozycjach. Pozostawić je jako jawne braki; kolejna akcja tworzy wizytę uzupełniającą tylko dla pozostałych potrzeb.
6. Po zakupie większego opakowania cała rzeczywiście kupiona ilość trafia do lodówki. Przyszłe gotowania odejmują tylko ilość faktycznie zużytą.
7. Cofnięcie importu korzysta z istniejącego mechanizmu undo i sprawdza późniejsze operacje. Nie odejmować bezwarunkowo produktu, który został już zużyty. Odróżnić cofnięcie importu do lodówki od korekty faktu zakupu.

**Główne miejsca:** `ShoppingToFridgeReview.tsx`, `shoppingToFridge.ts`, `fridgeOperations.ts`, `FridgeInventoryOperationService`, API wizyty, `FridgeOperationSuccess.tsx`.

**Odbiór:** kupione 1 kg przy potrzebie 700 g daje 1 kg w zapasach; powtórzenie żądania nie daje 2 kg; nieżywnościowy produkt nie trafia do lodówki; częściowy import jest czytelny; wizyta uzupełniająca nie kupuje ponownie zrealizowanych ilości.

### Etap 6 Widok dzisiaj i wykonanie gotowania

**Zależności:** etapy 3 i 5. **Wynik:** plan jest użyteczny również po wyjściu ze sklepu.

1. Dodać widok „Dzisiaj” obok tygodnia i zakupów. Pokazywać dzisiejsze gotowania, porcje z wcześniejszych dni i krótką informację o przygotowaniu na jutro wynikającą z planu.
2. Domyślnie wybierać go dla bieżącego tygodnia z rozpoczętą realizacją. Jawny parametr widoku zawsze ma pierwszeństwo. Gdy dziś nie ma posiłków, pokazać najbliższy zaplanowany dzień zamiast błędu.
3. „Ugotowane” dotyczy konkretnej partii i otwiera krótki podgląd użytych składników oraz przygotowanych porcji. Ponownie wykorzystać istniejący komponent przeglądu operacji lodówki.
4. Obliczanie i autoryzacja zużycia mają ostatecznie należeć do backendu. Istniejące frontendowe `cookedRecipe.ts` może pomagać w prezentacji; nie powinno być jedyną ochroną ilości i zgodności składników.
5. Potwierdzenie oznacza partię jako ugotowaną i stosuje operację zużycia najwyżej raz. Potwierdzenie zjedzenia porcji następnego dnia zmniejsza gotowe porcje, bez ponownego zużycia surowców.
6. Można skorygować faktycznie ugotowaną ilość i zrezygnować z aktualizacji niepewnych zapasów. Taki stan zapisuje się jawnie, aby późniejsze sugestie nie traktowały niepewnego zapasu jako pewnego.
7. Dodać cofnięcie dopuszczalne tylko wtedy, gdy nie naruszy późniejszego zużycia porcji/zapasów. Konflikt ma wskazywać konkretną zależność, a nie bezwarunkowo odtwarzać dawny stan.
8. Daty liczyć jako dni lokalne użytkownika. Testy obejmują Europe/Warsaw, granicę północy i zmianę czasu; nie wyznaczać „dzisiaj” przez obcięcie UTC.

**Główne miejsca:** `MealPlanner.tsx`, karty slotów, podgląd przepisu, `cookedRecipe.ts`, komponenty operacji lodówki, API partii i alokacji porcji.

**Odbiór:** gotowanie na dwa dni odejmuje składniki raz; ponowienie „Ugotowane” nie odejmuje ponownie; wtorek korzysta z gotowych porcji; widok Dzisiaj nie gubi jawnie wybranego planu; zmiana daty nie nadpisuje historii.

### Etap 7 Zmiana jadłospisu po zakupach

**Zależności:** etapy 3–6. **Wynik:** użytkownik może zmienić tydzień bez niepotrzebnych zakupów i bez utraty historii.

1. Rozszerzyć podglądy rewizji o kontekst aktualnych zapasów, kupionych produktów, pozostałych gotowych porcji i innych niezrealizowanych posiłków.
2. Po zakupach domyślnie proponować zamianę wykorzystującą dostępne składniki. Najpierw odfiltrować naruszenia wykluczeń/czasu; następnie preferować brak dodatkowych zakupów, wykorzystanie produktów do zużycia i małą liczbę nowych składników. Budżet i urozmaicenie są dalszymi preferencjami.
3. Podgląd pokazuje: nowe składniki do kupienia, rzeczy do sprawdzenia w domu, produkty kupione, które przestaną być potrzebne, oraz wpływ na powiązane posiłki/porcje. „Bez dodatkowych zakupów” jest dozwolone tylko przy potwierdzonym pokryciu.
4. Jeśli nie ma odpowiedniego zamiennika, pokazać konkretny brak albo zaproponować przeniesienie posiłku. Nie dodawać nieznanych składników do lodówki i nie przedstawiać niepełnej wyceny jako zerowego kosztu.
5. Zastosowanie sprawdza wersję planu, wizyty, użytych partii i zapasów. Nieaktualny podgląd wymaga ponownego obliczenia; nie stosować go do zmienionej lodówki.
6. Zakończone wizyty i ugotowane partie nie są przepisywane. Uaktualniają się przyszłe alokacje i niezrealizowane wymagania. Nowe braki można dodać do otwartej albo nowej wizyty uzupełniającej.
7. „Przenieś na jutro” zachowuje przepis i istniejący zakup. Jeśli zmienia się dostępność produktu względem terminu lub partii, pokazać wpływ i poprosić o wybór w samym podglądzie operacji.
8. Replanowanie całego tygodnia chroni ugotowane/zjedzone i zablokowane elementy. Domyślnie dotyczy przyszłych niewykonanych posiłków, a nie historii.

**Główne miejsca:** `MealPlanRevisionService`, `MealPlanRevisionStore`, `MealPlanCandidateService`, `MealPlanService`, `MealPlanRevision.tsx`, `PlanShoppingIssue.tsx`, kontrakty podglądu.

**Odbiór:** kupione produkty pozostają w historii po zamianie; nowy brak jest widoczny przed zatwierdzeniem; przeniesienie nie kupuje drugi raz tego samego; niewystarczająca lub nieznana ilość nie daje obietnicy pełnego pokrycia; stare podglądy dają konflikt bez częściowego zapisu.

### Etap 8 Kolejny tydzień i odbiór całości

**Zależność:** etapy 0–7. **Wynik:** powtarzalny proces gotowy do oceny jako całość.

1. „Zaplanuj kolejny tydzień” dziedziczy preferencje i pokazuje aktualne zapasy oraz niewykorzystane porcje. Nie kopiuje zakończonych zakupów, datowanych wyjątków ani kuponów.
2. Ujednolicić nazwy PL/EN, stany puste, postęp, konflikty, błędy limitu AI i odzyskiwanie po utracie połączenia. Jedna główna akcja zależna od bieżącego etapu.
3. Sprawdzić szerokości 360/390/1440 px, duże nazwy produktów, klawiaturę, Escape, powrót fokusu i dotyk. Szczegóły i rzadkie opcje nie wypychają pierwszego dania/listy poza ekran.
4. Dodać zdarzenia w istniejącym mechanizmie analityki: rozpoczęcie i gotowość tygodnia, otwarcie i zakończenie wizyty, oznaczenie gotowania, podgląd i zastosowanie zamiany po zakupach. Nie wysyłać nazw składników, treści diety i przepisów; wystarczą liczniki, czasy, typ operacji i wynik.
5. Uzupełnić `CONTEXT.md` i dokumentację kontraktów rzeczywistym zachowaniem. Zastąpić regułę o odrębnych listach regułą o jednym widoku wizyty i zachowanym pochodzeniu danych. Historycznego opisu wdrożenia z 6 listopada nie przepisywać jako nowego wyniku.
6. Zapisać status każdego etapu, testy, scenariusze i konkretne ograniczenia. Oddzielić wdrożenie lokalne od publikacji.

**Odbiór:** pełny scenariusz poniżej przechodzi przez rzeczywisty lokalny frontend, API i testową bazę; nie ogranicza się do atrap endpointów.

## Mapa kodu

Ścieżki frontendowe poniżej są względem `frontend/recipeai/src`, a klasy backendowe względem `backendApi/src/main/java/org/jakub/backendapi`. Nowe klasy mają rozszerzać istniejące odpowiedzialności, bez rozbudowy jednego ogromnego komponentu lub serwisu.

| Obszar | Pliki istniejące | Odpowiedzialność do dodania |
| --- | --- | --- |
| Nawigacja i start | `pages/MealPlanner.tsx`, `components/MealPlanForm.tsx`, `lib/mealPlans.ts` | Jedna intencja generowania, wyjątki, widok Dzisiaj, obsługa nowych kontraktów |
| Dania | `components/MealPlanSlotCard.tsx`, `components/MealPlanRevision.tsx` | Partie, porcje, przenoszenie i skutki zmian |
| Zakupy | `pages/ShoppingList.tsx`, `components/PlanShoppingGroups.tsx`, `components/PlanShoppingIssue.tsx` | Wspólny widok wizyty i źródła wierszy |
| Lodówka | `components/ShoppingToFridgeReview.tsx`, `components/FridgeOperationReview.tsx`, `lib/fridgeOperations.ts`, `lib/shoppingToFridge.ts`, `lib/cookedRecipe.ts` | Przegląd rzeczywistych zakupów i zużycia bez podwójnych operacji |
| Plan | `controllers/MealPlanController.java`, `dto/MealPlanDto.java`, `services/MealPlanService.java` | Wersja kontraktu, wyjątki, zapis partii i spójne mutacje |
| Generowanie | `services/MealPlanJobService.java`, `services/MealPlanJobWorker.java`, `services/MealPlanGenerationService.java`, `services/MealPlanCandidateService.java` | Praktyczny tryb, wspólne zasoby tygodnia i ograniczony ranking |
| Ilości i ceny | `services/PlanIngredientAggregationService.java`, `services/MealPlanPricingService.java`, `services/MealPlanItemPriceService.java` | Zapotrzebowanie partii, ilości przyszłe i osobny fakt zakupu |
| Rewizje | `services/MealPlanRevisionService.java`, `services/MealPlanRevisionStore.java` | Podgląd zależny od zapasów, zakupów i porcji |
| Dane użytkownika | `services/ShoppingPreferencesService.java`, `services/UserPreferencesService.java` | Preferencje stałe i jawne oddzielenie wyjątków tygodnia |
| Zapasy i lista ręczna | `services/FridgeInventoryOperationService.java`, `services/ShoppingListService.java` | Ponowne użycie operacji magazynowych i powiązanie źródeł wizyty |

## Kontrakty API

Etap 0 ma zapisać ostateczne nazwy DTO i tras przed ich implementacją. Poniższa tabela określa wymagane operacje, a nie istniejące endpointy. Nowe zachowanie udostępnić pod v4, a operacje zapasów współdzielić z istniejącą logiką serwerową.

| Operacja | Dane wejściowe | Gwarancja wyniku |
| --- | --- | --- |
| Utworzenie i uruchomienie tygodnia | Ustawienia, wyjątki, wskazane zapasy, trwały identyfikator intencji | Odtwarzalny `planId` i stan zadania, brak duplikatu po retry |
| Podgląd listy | Plan i jego wersja | Odczyt bez akceptacji i bez zmiany zapasów |
| Przygotowanie wizyty | Wersja planu, identyfikator żądania, wybrane dodatkowe pozycje | Jedna otwarta wizyta, trwałe identyfikatory i pochodzenie wierszy |
| Zmiana pozycji wizyty | Wersja wizyty, ID wiersza, stan/ilość, request ID | Widoczny zapis albo konflikt, zachowane kupione ilości |
| Potwierdzenie zakupów | Wersja wizyty, kupione ilości, wybór importu, request ID | Trwałe fakty zakupów i wynik powiązanej operacji lodówki |
| Podgląd zmiany partii/slotu | Wersja planu, zmiana i wersje zależności | Zmiana porcji, przyszłe potrzeby, niepewne pokrycie i nadwyżki |
| Zastosowanie podglądu | ID podglądu i aktualne wersje | Atomowy zapis albo konflikt bez częściowej mutacji |
| Oznaczenie gotowania | ID partii, wersja, wykonane porcje, uzgodnione zużycie, request ID | Jedna operacja zużycia i trwały stan partii |
| Zjedzenie/zwolnienie porcji | ID alokacji, wersja, liczba porcji, request ID | Zmiana gotowych porcji bez ponownego zużycia składników |
| Odczyt dzisiaj | Data lokalna i wybrany plan | Gotowania, porcje i braki wynikające z zapisanych danych |

Wszystkie identyfikatory źródłowych ręcznych pozycji, zapasów, partii i wizyt muszą należeć do użytkownika. Nie ufać przekazanej przez klienta cenie jako cenie katalogowej ani wyliczonej przez klienta sumie jako rozliczeniu serwerowym. Zachować CSRF, limity, prywatność cen i istniejące kontrole dostępu.

## Weryfikacja

### Scenariusz referencyjny

Przygotować izolowanego użytkownika testowego: 2 osoby, 7 dni, sam obiad, zakupy przed pierwszym posiłkiem, 200 g ryżu o potwierdzonej ilości w lodówce, ręczny detergent na liście. Środa jest poza domem, czwartek ma limit 15 minut. Kontrolowany przepis na 2 porcje wymaga 300 g ryżu.

1. Jednym kliknięciem uruchomić tydzień; przeładować podczas generowania i odzyskać to samo zadanie.
2. Ustawić gotowanie tego przepisu na poniedziałek i wtorek po 2 porcje. Potrzeba 600 g ryżu, z czego 200 g jest w domu, więc brak 400 g.
3. W testowym katalogu ustawić opakowanie 500 g. Lista sugeruje jedno opakowanie i pokazuje 100 g nadwyżki po tych posiłkach. Detergent jest na tej samej liście.
4. Potwierdzić zakup 500 g ryżu; lodówka zawiera 700 g. Powtórzyć żądanie i przeładować: nadal 700 g.
5. Oznaczyć poniedziałkową partię 4 porcji jako ugotowaną: zużycie wynosi 600 g, zostaje 100 g ryżu. Dwie porcje są na poniedziałek, dwie na wtorek.
6. Oznaczyć wtorkowe porcje jako zjedzone: ryż nadal wynosi 100 g.
7. Zamienić przyszły niezrealizowany posiłek na danie wymagające 150 g ryżu. Podgląd pokazuje brak 50 g, a nie ponowny zakup 150 g ani użycie całych historycznych 500 g.
8. Zastosować zmianę i utworzyć wizytę uzupełniającą. Historia pierwszej wizyty pozostaje bez zmian.
9. Utworzyć następny tydzień z tymi samymi preferencjami. Nie kopiować środowego wyjścia, starego kuponu ani odhaczeń.

### Macierz przypadków brzegowych

| Przypadek | Wymagany rezultat |
| --- | --- |
| Dwuklik, timeout po zapisie, ponowienie po przeładowaniu | Jeden plan, zadanie, zakup lub gotowanie dla tej samej intencji |
| Dwie karty przeglądarki zapisują jednocześnie | Konflikt wersji albo jednoznaczne uzgodnienie, bez utraty nowszego zapisu |
| Lodówka zmienia się po podglądzie rewizji | Podgląd nie jest stosowany bez ponownego sprawdzenia zasobów |
| Zmieniona ilość wymagania po odhaczeniu | Ponowne sprawdzenie potrzeby, ale zachowany faktyczny zakup |
| Nieznane ilości i niezgodne jednostki | Jawne „sprawdź”, bez fałszywej pełnej dostępności |
| Usunięty drugi dzień partii | Poprawiona alokacja; brak podwójnego kosztu i osieroconego posiłku |
| Zmiana po ugotowaniu | Historia partii i zużycia zostaje; zmieniają się tylko pozostałe porcje |
| Brak ofert lub awaria źródła | Zwykłe planowanie działa; ceny są jawnie niepełne |
| Brak dopuszczalnego przepisu lub limit AI | Czytelny częściowy wynik, bez rozluźniania wykluczeń |
| Potwierdzone tylko część zakupów/importu | Braki i pominięte importy pozostają widoczne, ponowienie nie dubluje sukcesów |
| Stare plany i stary klient | Odczyt zgodny; stary zapis nie usuwa nowych danych |
| Obcy identyfikator planu, zapasu, pozycji ręcznej lub partii | Brak dostępu i brak efektów ubocznych |
| Przejście przez północ i zmianę czasu | Poprawny lokalny dzień i kolejność slotów |
| Zajęty docelowy dzień przeniesienia | Jawna zamiana lub wybór innego miejsca, bez nadpisania |
| Brak sieci w sklepie | Stan oczekujący na zapis, bez fałszywego potwierdzenia sukcesu |

### Polecenia i zakres testów

Repozytorium deklaruje Node 24 i Java 17. Sprawdzić dostępne wersje przed uruchomieniem; nie zmieniać wymagań projektu tylko po to, aby ominąć problem lokalnego środowiska.

W `frontend/recipeai`:

```sh
npm run typecheck
npm run lint
npm run build
npx vitest run --maxWorkers=2
npx playwright test e2e/meal-planner.spec.ts e2e/meal-planner-simplification.spec.ts e2e/meal-planner-disclosures.spec.ts e2e/shopping-list.spec.ts --workers=2
```

Rozszerzyć istniejące scenariusze i uruchomić nowe pliki procesu tygodniowego, wizyty i partii. Testy z atrapami API sprawdzają interakcje, ale nie zastępują scenariusza z rzeczywistym backendem.

W `backendApi`:

```sh
./gradlew test --tests '*MealPlanIntegrationTest' --tests '*WeeklyPlannerIntegrationTest' --tests '*PromotionFirstPlannerIntegrationTest' --tests '*PlanIngredientAggregationServiceTest' --tests '*MealPlanPricingServiceTest' --tests '*FridgeInventoryOperationServiceTest'
./gradlew test --tests '*DatabaseMigrationIT'
RUN_BROWSER_PLANNER_SMOKE=1 ./gradlew test --tests '*BrowserPlannerSmokeIT'
```

Dołączyć nowe testy wizyt, partii, idempotencji i rewizji po zakupach. `DatabaseMigrationIT` wymaga działającego Dockera/Testcontainers i sprawdza PostgreSQL. `BrowserPlannerSmokeIT` uruchamia lokalny frontend/API i izolowaną H2 z kontrolowaną odpowiedzią Gemini; w razie potrzeby `PLANNER_TEST_NODE` wskazuje Node 24. Rozszerzyć obecny harness o nowy scenariusz. H2 nie zastępuje testu migracji na PostgreSQL.

Po zmianach przekrojowych wykonać odpowiedni szerszy zestaw backendu. Rozróżnić świeże wykonanie od wyniku `UP-TO-DATE` i od testów pominiętych warunkiem środowiska. Nie przedstawiać starego raportu jako nowej weryfikacji. Nie testować zakupów i zużycia na rzeczywistych danych użytkownika ani nie uruchamiać płatnego AI tylko dla demonstracji.

## Kolejność dostarczania i granice zakresu

| Przyrost | Etapy | Użyteczny efekt |
| --- | --- | --- |
| A | 0–2 | Jedno rozpoczęcie, wyjątki i planowanie z zapasów bez obowiązku cen |
| B | 3–5 | Gotowanie na dwa dni, jedna lista wizyty i faktyczne zakupy w lodówce |
| C | 6–8 | Dzisiaj, rozliczone gotowanie, zmiany po zakupach i kolejny tydzień |

Każdy przyrost powinien być możliwy do sprawdzenia lokalnie. Wprowadzać funkcje w kolejności zależności i nie udostępniać akcji rozliczających ilości przed ukończeniem ich logiki serwerowej. Publikacja, wdrożenie migracji na produkcji i wybór daty wydania są osobną czynnością; wykonanie tego planu kończy się kompletnym lokalnym wdrożeniem oraz raportem weryfikacji.

Poza zakresem są: nowy importer promocji, zamawianie w sklepach, płatności, pełny tryb offline, współdzielone gospodarstwa, automatyczne porady o bezpiecznym przechowywaniu, kalendarze zewnętrzne, aplikacja natywna i przebudowa całego systemu przepisów. Nie jest natomiast poza zakresem backend potrzebny do prawidłowego rozliczenia zakupów, porcji i zapasów.

Miarami efektu będą: czas do gotowego tygodnia, liczba kroków do listy, odsetek tygodni zakończonych zakupami oraz liczba dodatkowych pozycji po zmianie dania. Najpierw zebrać punkt odniesienia; nie obiecywać procentowej poprawy bez danych.

## Definicja ukończenia

- Wszystkie etapy 0–8 mają wdrożony przepływ użytkownika i logikę serwerową albo konkretnie wskazaną blokadę; brak nie może zostać ukryty jako „dalsze ulepszenie”.
- Scenariusz referencyjny zachowuje ilości na każdym kroku oraz historię po zakupach i gotowaniu.
- Nowe funkcje działają dla istniejącego użytkownika i starych planów; wcześniejsze zmiany repozytorium są zachowane.
- Weryfikacja obejmuje frontend, backend, PostgreSQL i przeglądarkę, z rozróżnieniem testów wykonanych, pominiętych i niedostępnych.
- Dokumentacja opisuje stan faktycznie wdrożony, a końcowy raport nie deklaruje publikacji produkcyjnej.

Prompt do realizacji: [PROMPT_WDROZENIA_CYKLU_JADLOSPISU_I_ZAKUPOW.md](PROMPT_WDROZENIA_CYKLU_JADLOSPISU_I_ZAKUPOW.md).
