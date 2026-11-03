# Plan wdrożenia tygodniowego jadłospisu z aktualnych okazji

Data: 2 listopada 2026. Punkt odniesienia kodu: `d5161ed`. Status: wdrożenie częściowe; szczegółowy [stan, testy i blokady](WDROZENIE_TYGODNIA_Z_OKAZJI.md), aktualizacja 3 listopada 2026. Automatyczny feed nie został odebrany.

Dish Genie ma skracać wybór jedzenia na tydzień przez proponowanie posiłków wykorzystujących aktualne promocje w sklepach użytkownika. Najważniejsze rezultaty to mniej przeglądania gazetek, mniej ręcznego liczenia zakupów i mniej poprawiania przepisów. Koszt jest informacją pomocniczą. Budżet pozostaje opcjonalną, elastyczną preferencją i nie blokuje utworzenia ani akceptacji jadłospisu.

Ten kierunek zastępuje założenie obowiązkowego budżetu z [wcześniejszego planu](PLAN_JADLOSPISU_BUDZETU_I_PROMOCJI.md). Wykorzystuje istniejący planer i wycenę. Opisane niżej rozszerzenia wymagają implementacji; sam dokument nie zmienia zachowania aplikacji.

## 1 Cel i zakres pierwszego wydania

Domyślna ścieżka: zapisane ustawienia → aktualne okazje dobrane automatycznie → propozycja tygodnia → ewentualne poprawki → lista zakupów według sklepu.

Użytkownik może także wskazać konkretne oferty i wybrać „Ułóż tydzień z tych produktów”. Przeglądanie i zaznaczanie promocji nie jest obowiązkowym krokiem przed generowaniem.

| Obszar | Pierwsze wydanie | Dalszy rozwój |
|---|---|---|
| Rynek | Polska, PLN; docelowo Lidl i Biedronka | Kolejne sieci po potwierdzeniu jakości integracji |
| Okres | Istniejące 1–7 dni, lunch i obiad, liczba osób i limit czasu | Śniadania, kolacje i różne ustawienia dla poszczególnych dni |
| Zakupy | Jedna data zakupów, domyślnie jeden odwiedzany sklep; jawna opcja dwóch | Dwie daty zakupów i porównanie terminów |
| Promocje | Aktywne w dniu zakupów, zgodne z miejscem i rozpoznanymi warunkami | Złożone promocje mieszane i indywidualne kupony |
| Koszt | Znana suma oraz jawne braki; osobno oznaczone szacunki, jeśli je dopuścimy | Historia rzeczywistych koszyków i dokładniejsze porównania |
| Poprawki | Wymiana dania z powodem, zamiana składnika, uproszczenie i korekta ręczna | Uczenie rankingu na podstawie zaakceptowanych zmian |
| Źródła | Pierwsza działająca sieć może uruchomić pilotaż | Obie sieci wymagają niezależnych adapterów i odbioru danych |

Poza tym wydaniem: zamawianie i płatności, logowanie do kont sklepów, automatyczna aktywacja kuponów, śledzenie lokalizacji i optymalizacja trasy. Brak oferty dla składnika nie wyklucza dobrego przepisu.

## 2 Stan obecny i elementy do wykorzystania

| Obszar | Potwierdzone w kodzie | Zmiana potrzebna do nowego przepływu |
|---|---|---|
| Planer | [MealPlanner](../frontend/recipeai/src/pages/MealPlanner.tsx) i [MealPlanService](../backendApi/src/main/java/org/jakub/backendapi/services/MealPlanService.java): zapis planu, blokady, porcje, pomijanie, wymiana i częściowa akceptacja | Ustawienia zakupów przed generowaniem, wybór okazji i podgląd kosztu bez akceptacji |
| Generowanie | [MealPlanGenerationService](../backendApi/src/main/java/org/jakub/backendapi/services/MealPlanGenerationService.java) korzysta z lodówki i preferencji; tworzy po jednym daniu | Przekazanie sprawdzonych produktów promocyjnych, dobór zapisanych przepisów i wspólny ranking tygodnia |
| Szybkość | Frontend uruchamia kolejne dania sekwencyjnie; opuszczenie strony zatrzymuje uruchamianie następnych | Zadanie zarządzane przez backend i powrót do postępu; mniej wywołań AI dzięki bibliotece przepisów |
| Zapotrzebowanie | [PlanIngredientAggregationService](../backendApi/src/main/java/org/jakub/backendapi/services/PlanIngredientAggregationService.java) skaluje porcje, przydziela zapas raz i uwzględnia daty | Użyć również do oceniania kandydatów przed zatwierdzeniem planu |
| Wycena | [MealPlanPricingService](../backendApi/src/main/java/org/jakub/backendapi/services/MealPlanPricingService.java) liczy całe opakowania i porównuje sieci | Oddzielić obliczenia od wymogu `ACCEPTED`, włączyć cenę regularną i sprzedaż wagową |
| Oferty | [StoreOfferService](../backendApi/src/main/java/org/jakub/backendapi/services/StoreOfferService.java) i API administratora: zweryfikowane ogólnopolskie opakowania, minimum, wielokrotności, limity, ważność | Automatyczny import, identyfikatory źródłowe, regiony, placówki i dokładniejsze warunki |
| Import | [prepare_lidl_candidates.py](../scripts/offers/prepare_lidl_candidates.py) czyta zapisany HTML i przygotowuje kandydatów do weryfikacji | Pobieranie cykliczne i odbiór jakości; skrypt nie jest gotowym feedem ani pełnym katalogiem |
| Budżet | [MealPlanDto](../backendApi/src/main/java/org/jakub/backendapi/dto/MealPlanDto.java) wymaga dodatniej kwoty; formularz domyślnie wpisuje 300 zł | Opcjonalna kwota oraz jawny tryb bez budżetu, bez podstawiania zera |
| Poprawki | [MealPlanSlotCard](../frontend/recipeai/src/components/MealPlanSlotCard.tsx) daje regenerację, porcje i blokadę | Korekta konkretnej części przepisu, podgląd różnic i cofnięcie |
| Zakupy | Plan ma osobną checklistę; zmiana zawartości planu usuwa ją z bieżącego dokumentu | Zachowanie wkładów pozycji i odhaczeń przy poprawkach; wybór koszyka ze sklepami |
| Analityka | Wysyłane są otwarcie, akceptacja i utworzenie listy; pozostałe zdarzenia mają kontrakt | Rzeczywisty czas całej ścieżki, powody poprawek i jakość wykorzystania promocji |

Szczegóły istniejącego pilotażu opisuje [OFERTY_I_WYCENA.md](OFERTY_I_WYCENA.md). Starsza roadmapa zawiera historyczny audyt; nie należy ponownie implementować istniejącego modelu planu, porcji i widoczności przepisów.

## 3 Research i wynikające z niego decyzje

Źródła sprawdzono 2 listopada 2026. Informacje o funkcjach innych aplikacji opisują ich dokumentację; nie są pomiarem skuteczności w Dish Genie.

| Ustalenie | Źródło | Konsekwencja dla wdrożenia |
|---|---|---|
| Biedronka wiąże cenę ze wskazanym sklepem, a informację o dostępności określa jako orientacyjną | [FAQ Biedronki](https://www.biedronka.pl/pl/faq) | Przechowywać zakres miejsca i kanał sprzedaży; nie obiecywać stanu magazynowego |
| Oferty indywidualne mogą zależeć od konta, aktywacji i konkretnego okresu | [FAQ Biedronki](https://www.biedronka.pl/pl/faq) | Oddzielić zwykłe oferty, kartę lojalnościową i aktywację konkretnego kuponu; personalizację wyłączyć z pierwszego wydania |
| Publiczna oferta Biedronki rozdziela zakresy dat; otwarta gazetka wyróżnia sklepy z ladą tradycyjną | [Oferta Biedronki](https://www.biedronka.pl/pl/nowa-oferta), [gazetka od 2 listopada](https://www.biedronka.pl/pl/codziennie-niskie-ceny-02-11) | Pobierać zakres geograficzny i format placówki. Sama etykieta „w tym tygodniu” nie wystarcza |
| Cena referencyjna przy obniżce ma znaczenie; UOKiK rozróżnia m.in. najniższą cenę przed obniżką oraz przypadek produktów szybko psujących się | [Informacje UOKiK](https://prawakonsumenta.uokik.gov.pl/prawo-do-informacji/informacje-o-obnizkach-cen/) | Zachować rodzaj i okres ceny porównawczej ze źródła; nie wymyślać procentu oszczędności ani utożsamiać wszystkich cen referencyjnych |
| Jow opisuje zamiany produktów markowych na tańsze odpowiedniki w koszyku oraz wykorzystanie promocji i korzyści lojalnościowych | [Pomoc Jow](https://jow.fr/help?question=payer-moins-cher-mes-courses) | Dać osobną akcję zamiany produktu oraz podgląd wpływu na koszyk |
| Choosy automatycznie zbiera składniki tygodnia, obsługuje zapasy, listy dla różnych sklepów i kategorie | [Pomoc Choosy](https://choosy-hilfe.helpscoutdocs.com/article/25-einkaufsliste) | Lista zakupów ma powstawać z planu i pozostać edytowalna; użytkownik nie powinien przepisywać składników |
| Scrape.pl deklaruje dostarczanie danych Lidla i Biedronki w plikach lub API, z cenami i terminami | [Oferta dla Lidla](https://scrape.pl/zrodla-danych/lidl.pl), [oferta dla Biedronki](https://scrape.pl/zrodla-danych/biedronka.pl) | Kandydat do zamówienia próbki. Deklaracja nie potwierdza kompletności warunków, lokalnych cen ani prawa do dalszej prezentacji danych |
| DataMiners deklaruje monitoring gazetek i mechanizmów promocyjnych oraz dostawy danych do systemów | [Oferta DataMiners](https://dataminers.pl/oferta/fmcg.html) | Drugi kandydat do porównania próbki, kosztu i warunków wykorzystania; nie wybierać dostawcy wyłącznie na podstawie strony |

Nie potwierdzono publicznego, udokumentowanego API produkcyjnego Lidla lub Biedronki odpowiedniego dla tej integracji. Nie zakładamy jego dostępności. Odczyt strony produktów Lidla przez narzędzie badawcze zakończył się timeoutem; wcześniejszy parser w repozytorium nie potwierdza aktualnej kompletności źródła.

Wniosek projektowy: dostępność wiarygodnych danych jest pierwszą zależnością. Można rozwijać interfejs na kontrolowanych danych i zachować ręczny import dla pilotażu, ale funkcję automatycznych promocji uznajemy za ukończoną dopiero po uruchomieniu rzeczywistego źródła.

## 4 Wybór i odbiór źródła ofert

### Kolejność rozpoznania

| Wariant | Co sprawdzić | Kiedy wybrać | Ograniczenie |
|---|---|---|---|
| Oficjalny feed lub partnerstwo sieci | Dostęp, zakres, warunki publikacji, częstotliwość i koszt | Gdy sieć faktycznie udostępni odpowiednie dane | Termin uzyskania dostępu jest zależnością zewnętrzną |
| Dostawca danych | Próbki dla obu sieci, warunki promocji, uprawnienie do wykorzystania i prezentacji, koszt aktualizacji | Gdy próbka spełni kryteria, a koszt mieści się w założeniach produktu | Publiczna oferta usługi nie jest gwarancją jakości ani licencji |
| Własny adapter publicznego źródła | Stabilność formatu, kompletność, dopuszczalny sposób użycia i koszt utrzymania | Po ocenie konkretnego źródła i udanym pilotażu | Zmiany stron, niepełne partie danych, OCR i regionalizacja |
| Ręczny import ze sprawdzeniem | CSV/JSON i panel weryfikacji | Do testów oraz ograniczonego pilotażu | Nie realizuje automatycznego wyszukiwania promocji |

Wybór płatnego źródła wymaga decyzji kosztowej po porównaniu próbek i warunków dostępu.

### Próbka przed implementacją adaptera

Przygotować osobną kartę oceny dla każdej sieci i źródła: sposób dostępu, ceny regularne, oferty aktywne i przyszłe, gramatury, sprzedaż na wagę, placówki, karty, kupony, wielosztuki, limity, identyfikatory, częstotliwość zmian, koszt i ograniczenia wykorzystania.

Proponowana próba odbiorowa to 30–50 ofert na sieć, obejmujących mięso lub zamienniki, warzywa, nabiał i produkty suche, oraz dwa następujące po sobie cykle ofert. To próbka do wykrywania błędów, a nie dowód pełnego pokrycia asortymentu.

Kryteria dopuszczenia:

- Każda publikowana oferta ma źródło, cenę, jednostkę sprzedaży, ilość lub podstawę ważenia, zakres dat i rozpoznane warunki.
- Cena za kilogram nie zostaje uznana za cenę opakowania. Rabat na drugi produkt nie staje się rabatem na każdą sztukę.
- Zakres miejsca jest potwierdzony; brak lokalizacji nie oznacza automatycznie oferty ogólnopolskiej.
- Rekordy niejednoznaczne trafiają do sprawdzenia i nie obniżają automatycznie wyceny.
- Powtórny import nie tworzy duplikatów. Awaria lub brak strony paginacji nie publikuje pustego katalogu.
- W próbce dopuszczonych ofert nie ma krytycznego błędu ceny, daty lub warunków. Błąd blokuje dany parser lub typ oferty do poprawy.
- Widać pokrycie kategorii i czas ręcznej obsługi. Źródło o dobrych cenach wyłącznie na słodycze nie wystarcza do planowania obiadów.

### Działanie importera

Przepływ: pobranie → zapis dowodu źródłowego i czasu → ekstrakcja → normalizacja → walidacja → dopasowanie składnika → publikacja albo kolejka sprawdzenia.

Na początek przyjąć codzienną synchronizację i odświeżanie po wykrytej zmianie gazetki, jeśli pozwala na to źródło. Częstotliwość i dopuszczalny wiek danych ustalić dla adaptera po próbce. Obecny limit 48 godzin pozostaje punktem wyjścia, a nie automatycznie właściwą regułą dla każdego źródła.

Zapisywać osobno `fetchedAt`, `sourceUpdatedAt`, `verifiedAt` i ostatnią udaną synchronizację. Sama próba pobrania nie odnawia weryfikacji. Brak produktu w niekompletnej odpowiedzi nie oznacza wycofania oferty. Historia pozostaje do odtworzenia wcześniejszych wycen, ale nieaktualne dane nie są przedstawiane jako aktualne okazje.

Panel administratora musi pokazywać źródło obok odczytanych pól, różnice względem poprzedniego importu, dopasowanie składnika i przyczynę odrzucenia. Publikacja wielu rekordów wymaga walidacji każdego z nich. Administrator może wycofać błędną ofertę i wyłączyć pojedynczy adapter.

## 5 Docelowa obsługa użytkownika

### Ustawienia zapisane na koncie

Formularz pokazuje dni, posiłki, osoby, maksymalny czas przygotowania, sklepy i datę zakupów. Diety i nielubiane składniki pobiera z istniejących preferencji.

Domyślnie odwiedzany jest jeden sklep. Zaznaczenie dwóch sieci oznacza możliwość porównania wariantów jednego sklepu, dopóki użytkownik jawnie nie dopuści podziału zakupów. Powtarzanie tego samego dania przez dwa dni jest osobną opcją, początkowo wyłączoną.

Sekcja „Orientacyjny koszt” jest opcjonalna. `budgetMode=NONE` oznacza brak kwoty, a `SOFT` preferencję rankingu. Przekroczenie kwoty daje informację i propozycje zmian, bez blokady planu. Zachować dawną kwotę przy otwieraniu istniejących planów, bez zamiany jej znaczenia w tle.

Zapamiętywać deklarację posiadania karty oddzielnie dla sieci. Potwierdzenie karty nie aktywuje automatycznie wszystkich kuponów. Jeżeli oferta wymaga aktywacji konkretnego kuponu, użytkownik widzi ją osobno i potwierdza możliwość skorzystania przed włączeniem ceny.

### Okazje dla tego tygodnia

Domyślna propozycja jest gotowa bez przeglądania całego katalogu. Opcjonalny widok pozwala wybrać produkty, które mają być podstawą tygodnia, wykluczyć ofertę albo zobaczyć alternatywy.

Karta oferty zawiera produkt i wariant, sklep, gramaturę lub jednostkę sprzedaży, cenę zakupu, cenę jednostkową, termin i wymagania. Pokazuje minimalny wydatek konieczny do promocji, np. koszt dwóch opakowań, oraz źródło. Uzasadnienie „pasuje do trzech wybranych posiłków” pojawia się dopiero po policzeniu planu.

Gdy nie ma danych dla wybranego sklepu, aplikacja pozwala ułożyć zwykły jadłospis i jasno oznacza brak aktualnych promocji. Nie przełącza samodzielnie sieci ani daty zakupów.

### Propozycja tygodnia i koszt

Przy daniu pokazać czas, porcje, wykorzystaną okazję i powód dopasowania. U góry pozostaje podsumowanie koszyka: znana suma, kompletność cen, produkty z promocji i nadwyżki opakowań.

Przykład etykiety: „Znane ceny: 146 zł; 9 z 12 pozycji wycenionych”. Liczba pozycji nie jest procentem pokrycia wartości koszyka. Przy niepełnych danych nie używać komunikatu „całe zakupy za 146 zł”.

Koszt aktualizuje się w wersji roboczej. Akceptacja utrwala wybraną wersję dań i zakupów; nie służy do odblokowania pierwszego podglądu ceny. Odświeżenie promocji pokazuje zmianę, ale nie wymienia zaakceptowanych dań bez działania użytkownika.

## 6 Co oznacza dobra okazja

Najpierw sprawdzamy możliwość skorzystania: data zakupów, miejsce, kanał sprzedaży, warunki, limity, wiarygodność danych i zgodność produktu z ograniczeniami użytkownika. Niespełnienie tych wymagań wyłącza cenę z automatycznego doboru.

Następnie porównujemy dopuszczone plany według następujących zasad:

1. Dopasowanie do preferencji i wybranych przez użytkownika produktów.
2. Przydatność przecenionych składników w rzeczywistych porcjach tygodnia, po odjęciu zapasów.
3. Całkowity wydatek potrzebny do kupienia produktów, z uwzględnieniem opakowań i promocji wielosztukowych.
4. Ograniczenie niewykorzystanych ilości i dodatkowych wizyt w sklepach.
5. Różnorodność oraz czas przygotowania.

To kolejność zasad startowych. Wagi rankingu i kompromis między ceną a różnorodnością należy dobrać w pilotażu; nie przedstawiać arbitralnego wyniku 0–100 jako obiektywnej jakości okazji.

Rabat nie zwiększa wartości propozycji tylko dlatego, że trzeba kupić więcej. Jeżeli tydzień wykorzystuje 400 g, a promocja wymaga dwóch opakowań po 500 g, liczymy koszt zakupu 1 kg i pokazujemy pozostałe 600 g. Tańsza porcja przepisu nie jest równoznaczna z mniejszą kwotą przy kasie.

Oszczędność w złotych można policzyć tylko względem jawnego, porównywalnego wariantu: te same produkty, ilości, miejsce, data i możliwe do spełnienia warunki. Zamiana ryby na fasolę może obniżyć koszt alternatywnego planu, ale nie jest rabatem na ten sam koszyk.

W pilotażu wystarcza oznaczenie aktualnej oferty sklepu i jej warunków. Bez właściwej ceny referencyjnej nie generujemy własnego procentu obniżki. Zachowujemy semantykę ceny odniesienia ze źródła, w tym wyjątki opisane przez [UOKiK](https://prawakonsumenta.uokik.gov.pl/prawo-do-informacji/informacje-o-obnizkach-cen/).

Przed zebraniem cen pozostałych produktów oferujemy jadłospis oparty na promocjach z niepełną wyceną. Pełny katalog cen regularnych poprawia ocenę całego koszyka, ale nie musi blokować pierwszego użytecznego pilotażu.

## 7 Model danych i zmiany backendu

Rozbudować istniejący Spring Boot i PostgreSQL. Osobny mikroserwis ani zewnętrzna kolejka nie są warunkiem startu.

| Element | Minimalny zakres |
|---|---|
| Preferencje zakupowe | Sieci, opcjonalne placówki/regiony, liczba sklepów do odwiedzenia, karty, domyślna data względem początku planu, zgoda na powtórki |
| Produkt sklepowy | Identyfikator źródłowy, sieć, wariant, EAN jeśli dostępny, składnik kanoniczny, cechy produktu i sposób dopasowania |
| Oferta | Produkt, zakres miejsca i kanał, cena, waluta, okres, jednostka sprzedaży, warunki i stan weryfikacji |
| Cena referencyjna | Wartość, rodzaj odniesienia, okres i źródło; pole opcjonalne |
| Partia importu | Adapter i jego wersja, zakres/paginacja, czasy, liczby rekordów, błędy, dowody źródłowe i identyfikator powtórzenia |
| Powiązanie z planem | Migawka i wersja wykorzystanej oferty, zapotrzebowanie składnika oraz pozycje posiłków |
| Zadanie generowania | Plan, bazowa wersja, status, postęp, checkpoint, blokada z terminem i limit prób/kosztu |
| Podgląd poprawki | Bazowa wersja planu i pozycji, poprzednia i nowa migawka, różnice, walidacja i wycena |
| Wycena | Wersja planu, zapasów i danych ofertowych, data zakupów, znana suma, braki i termin aktualności |
| Pozycja zakupów | Źródło plan/posiłek/ręczny wpis, potrzebna i kupowana ilość, sklep, oferta, odhaczenie i nadwyżka |

Kwoty obliczać przez `BigDecimal`/`NUMERIC`, zachowując istniejące reguły jednostek. Model sprzedaży rozróżnia opakowanie, sztukę i wagę. Nie tworzyć sztucznego „opakowania 1 kg” z oferty sprzedawanej luzem. Krok ważenia i dodatkowe koszty uwzględniać tylko wtedy, gdy są znane.

Warunki oferty muszą rozróżniać zwykłą cenę, kartę, aktywację kuponu, minimum sztuk, pełne wielokrotności i zakres limitu. Indywidualne rabaty oraz nierozpoznane mechanizmy pozostają poza automatyczną wyceną. Proste wielosztuki z jednoznaczną ceną pojedynczego opakowania wykorzystują obecny silnik. Mieszanie różnych produktów w „najtańszy gratis” wymaga osobnego kalkulatora i testów przed włączeniem.

Cena zestawu, np. dwa opakowania za 7,99 zł, wymaga naliczenia kwoty całego zestawu. Nie rozdzielać jej na zaokrąglone ceny sztuk, które zmienią wynik przy kasie. Ilość ponad limit promocji można wycenić regularnie tylko przy znanej cenie poza limitem; inaczej pozostaje niepełna wycena. Limit jednej oferty rozliczać łącznie dla wszystkich dań i wierszy koszyka, z uwzględnieniem wspólnego limitu kilku wariantów, jeżeli występuje w danych.

Nie utożsamiać końca promocji z terminem przydatności produktu. Nieznana data przydatności pozostaje nieznana. Dopasowanie składnika nie może automatycznie uznawać produktów surowych i gotowanych albo zwykłych i specjalistycznych wariantów dietetycznych za równoważne.

### Migracja i zgodność

- Dodać nowe tabele i pola migracją Flyway; nie przepisywać historycznych planów ani usuwać starego katalogu.
- Wprowadzić odczyt dokumentów planu w schemacie 1 oraz nowego schematu z preferencjami promocji. Brak kwoty ma odrębne znaczenie od zera.
- Nowy kontrakt ustawień zawiera `planningMode=DEALS`, `budgetMode=NONE|SOFT`, opcjonalny `budget`, `shoppingDate`, `maxStores` i wybrane oferty. Starsze żądania z kwotą pozostają obsługiwane.
- Zaktualizować DTO, formularz, typy TypeScript, wycenę i prezentację stanu budżetu razem. Odpowiedź z pustym budżetem nie może zostać zinterpretowana przez stary klient jako darmowy koszyk. Przed włączeniem sprawdzić stary klient z nowym backendem; jeśli kontrakt odpowiedzi tego wymaga, wydzielić wersję kontraktu dla nowego trybu.
- Indeksy i identyfikatory źródłowe zapewniają idempotencję importu. Oryginalny URL i dostawca to osobne dane; nie usuwać obecnej walidacji źródeł tylko po to, by przyjąć dowolny adres.
- Autoryzację prywatnych planów, przepisów, podglądów i preferencji oprzeć na zalogowanym koncie.

### Podział odpowiedzialności

Adapter pobiera i normalizuje dane; `OfferEligibilityService` ustala możliwość skorzystania; katalog produktów i normalizator rozwiązują tożsamość składnika. Wydzielony kalkulator koszyka ma działać bez zapisywania i bez wymogu akceptacji planu. Ranking korzysta z tego kalkulatora i istniejącej agregacji zapasów.

`MealPlanGenerationService` rozszerzyć o dobór kandydatów i kontekst promocji. Osobny serwis poprawek tworzy podgląd, a `MealPlanService` zapisuje zaakceptowaną zmianę. Synchronizacja zakupów zachowuje wkłady źródeł, zamiast usuwać całą listę po każdej korekcie.

### Proponowane kontrakty API

Ścieżki są propozycją do implementacji; obecny endpoint wyceny pozostaje wspierany podczas migracji.

| Operacja | Kontrakt i wynik |
|---|---|
| Preferencje zakupowe | `GET/PUT /v2/shopping-preferences` |
| Dostępne sklepy | `GET /v2/stores`; pokazuje również brak aktualnego źródła |
| Katalog ofert | `GET /v2/offers` z siecią/placówką, datą i kategorią; jawna świeżość i warunki |
| Dobór okazji do ustawień | `POST /v2/deal-selections/preview`; wybór automatyczny lub wskazane identyfikatory |
| Ustawienia planu | Nowy kontrakt utworzenia oraz `PATCH /v2/meal-plans/{id}/settings`, z oczekiwaną wersją |
| Generowanie tygodnia | `POST /v2/meal-plans/{id}/generations`; `202` i identyfikator trwałego zadania |
| Postęp | `GET /v2/meal-plans/{id}/generations/{generationId}` |
| Podgląd kosztu | `POST /v2/meal-plans/{id}/quote-preview`; także dla wersji roboczej |
| Podgląd poprawki | `POST /v2/meal-plans/{id}/slots/{slotId}/revision-previews`; intencja, wskazany składnik, opcjonalny komentarz |
| Zastosowanie poprawki | `POST /v2/meal-plans/{id}/slots/{slotId}/apply-revision`; identyfikator podglądu i oczekiwane wersje |
| Cofnięcie poprawki | `POST /v2/meal-plans/{id}/slots/{slotId}/undo-revision`; tylko do zgodnej poprzedniej wersji |
| Aktualizacja listy | `POST /v2/meal-plans/{id}/shopping-list/sync`; idempotentne wkłady planu |

Mutacje mają identyfikator żądania i oczekiwaną wersję. Ponowienie nie zużywa drugi raz limitu AI i nie dodaje zakupów ponownie. Zmiana planu lub oferty podczas otwartego podglądu wymaga ponownej walidacji przed zastosowaniem, bez cichego nadpisania.

## 8 Dobór posiłków do okazji

1. Utworzyć migawkę ustawień i dostępnych ofert dla daty zakupów. Uwzględnić diety, wykluczenia, limit sklepów i zablokowane dania.
2. Wybrać istotne produkty promocyjne: pasujące do planowanych posiłków, z użyteczną ilością i zrozumiałymi warunkami. Wskazane produkty użytkownika mają pierwszeństwo, o ile są zgodne z ograniczeniami.
3. Pobrać kandydatów z publicznych przepisów dostępnych dla użytkownika i jego prywatnej biblioteki. Nie odczytywać cudzych prywatnych przepisów.
4. Odfiltrować kandydatów z niewłaściwą dietą, porcjami lub czasem. Obecny walidator tekstowy rozbudować o rozpoznane składniki i cechy produktów tam, gdzie potrzebna jest automatyczna zamiana. Nieznana tożsamość nie daje zgody na zamianę dietetyczną.
5. Generować przez AI tylko brakujących kandydatów. Przekazywać strukturalne dane produktów i wymagania, z ograniczoną liczbą propozycji i prób. Tekst gazetki jest treścią wejściową, nigdy instrukcją dla modelu.
6. Dla każdego kandydata policzyć przyrost zakupów w kontekście całego dotychczasowego tygodnia: porcje, wspólne opakowania, pozostałe zapasy i terminy posiłków.
7. Zachować niewielką pulę najlepszych planów częściowych. Rozmiar puli ustalić po pomiarze czasu i jakości; ograniczyć całkowitą liczbę wycen i wywołań AI.
8. Dla jednego odwiedzanego sklepu ocenić osobno plan możliwy w każdej wybranej sieci. Mieszany koszyk powstaje tylko przy dopuszczeniu dwóch sklepów. Nie oznaczać niepełnej wyceny jako tańszej od kompletnej.
9. Przeprowadzić ograniczoną poprawę tygodnia: wykorzystanie wspólnego składnika, mniejsza nadwyżka, większa różnorodność. Nie wymieniać zablokowanych dań.
10. Zapisać propozycję, wykorzystane wersje ofert, niepewności i wyjaśnienia. Dostępny częściowy wynik pozostaje zapisany po błędzie.

AI proponuje składniki i instrukcje. Backend potwierdza wykorzystanie promocji, ilości i ceny. Nie dodajemy odznaki promocji tylko na podstawie podobnej nazwy produktu w tekście przepisu.

W pierwszym wdrożeniu można użyć prostego wyboru najlepszego kolejnego dania i ograniczonych zamian. Rozszerzenie do wyszukiwania wielu planów częściowych wdrażać dopiero, gdy zestaw porównawczy pokaże istotną poprawę. Rozbudowany solver nie jest warunkiem pilotażu.

## 9 Poprawianie przepisów bez układania tygodnia od nowa

| Akcja | Zachowanie |
|---|---|
| Zamień składnik | Użytkownik wskazuje składnik i wybiera alternatywę; backend sprawdza dietę, ilości i rolę składnika, a instrukcje są dostosowane |
| Wykorzystaj inną okazję | Pokazanie alternatywy dostępnej w tym samym kontekście zakupów i skutków dla całego koszyka |
| Przygotuj szybciej | Nowa wersja dania mieszcząca się w wskazanym czasie, z zachowaniem możliwie wielu zaakceptowanych elementów |
| Uprość | Mniej etapów lub składników; zachowanie preferencji i liczby porcji |
| Zmień danie | Podanie krótkiego powodu: nie lubię, za długo, zbyt podobne, za dużo zakupów; opcjonalny komentarz |
| Popraw ręcznie | Edycja ilości, jednostek i instrukcji; porcje i proste korekty nie wymagają wywołania AI |

Przed zastosowaniem pokazać zmienione składniki i kroki oraz wpływ na listę zakupów. Jeśli oba koszyki są kompletne i porównywalne, pokazać różnicę całkowitego kosztu. W przeciwnym razie wskazać zmianę znanej części i brakujące ceny, bez obietnicy oszczędności.

Poprawka dotyczy migawki danego posiłku. Nie nadpisuje oryginalnego przepisu w bibliotece ani pozostałych dni. Można zapisać poprawioną wersję do biblioteki osobną akcją. Blokada dania chroni przed zmianą; użytkownik musi je odblokować albo jawnie rozpocząć edycję zgodnie z ustalonym zachowaniem UI.

Zachować poprzednią wersję do cofnięcia. Jeżeli w międzyczasie zaszły inne zmiany, cofnięcie tworzy ponowny podgląd i przeliczenie, zamiast przywracać całą starą listę zakupów. Preferencje jednorazowej korekty stają się stałymi ustawieniami konta tylko po jawnym wyborze.

## 10 Szybkość i odporność przepływu

Najpierw ograniczyć pracę: zapamiętane ustawienia, biblioteka sprawdzonych przepisów, gotowe dopasowania produktów oraz wycena z lokalnie zsynchronizowanego katalogu. Generowanie tygodnia nie powinno czekać na pobranie każdej strony sklepu.

Zadanie backendowe zapisuje postęp w PostgreSQL. Wyjście z ekranu nie zatrzymuje planowania, a powrót pokazuje aktualny stan. Po restarcie backend odzyskuje zadania z wygasłą blokadą i wznawia brakujące pozycje w granicach limitu prób. Użytkownik może zatrzymać kolejne prace.

Nie przyspieszać obecnego kodu samym `Promise.all`: plan ma jedną wersję i blokadę aktywnego generowania. Najpierw przenieść sterowanie do backendu i utrzymać sekwencyjne zapisy. Ewentualne równoległe wyliczanie kandydatów wymaga oddzielnych identyfikatorów pracy oraz kontrolowanego scalania, które nie nadpisuje nowszych edycji. Równoległość wywołań AI włączyć dopiero po testach konfliktów i pomiarze kosztu.

Wycenę ponawiać po zmianie istotnych danych, a nie po każdym renderze ekranu. Klucz cache obejmuje wersję planu, zapasów, ofert, datę i uprawnienia do rabatów. Wynik dla innego użytkownika lub innej karty nie może zostać użyty ponownie.

## 11 Lista zakupów i utrzymanie planu

Po akceptacji utworzyć listę według wybranego wariantu sklepów i kategorii. Pokazać osobno: potrzebne do dań, odjęte z domu, ilość do kupienia, liczbę opakowań, nadwyżkę, cenę i warunki promocji.

Zmiana jednego dania aktualizuje wyłącznie jego wkład. Ręczne pozycje i zakupy z innych planów pozostają. Odhaczenia zachowują się dla niezmienionego zapotrzebowania; dodatkowa wymagana ilość jest ponownie widoczna do kupienia. Wymaga to zgodności ze starszym endpointem zastępującym całą ręczną listę.

Zgłoszenie „nie ma produktu” lub „cena jest inna” pozwala wybrać alternatywę dla danego produktu, przeliczyć instrukcje jeśli potrzeba i pokazać różnicę. Pojedyncze zgłoszenie nie nadpisuje globalnej ceny dla wszystkich użytkowników.

Przed wyjściem na zakupy można odświeżyć aktualność. Jeśli promocja wygasła albo wymaga niespełnionego warunku, plan pozostaje zapisany; aplikacja pokazuje problem i proponuje zmianę. Zapisana historyczna cena nie jest aktualną gwarancją.

## 12 Kolejność wdrożenia i kryteria odbioru

Każdy etap jest pełnym zakresem od danych do widocznego zachowania. Prace nad interfejsem na fixture’ach mogą przebiegać równolegle z pozyskiwaniem źródła, lecz wdrożenie automatycznych okazji zależy od jego odbioru.

| Etap | Zakres | Warunek ukończenia |
|---|---|---|
| A Rozpoznanie źródeł | Próbki Lidla i Biedronki, karta jakości, porównanie własnego adaptera z dostawcą | Dla co najmniej jednej sieci wskazano rzeczywiste źródło, sposób aktualizacji i dopuszczalny zakres użycia; druga ma osobny status |
| B Ustawienia i zgodność | Tryb okazji, opcjonalna kwota, data zakupów, limit sklepów i zapis preferencji | Można utworzyć plan bez kwoty; stare plany i istniejący klient pozostają poprawnie obsłużone |
| C Katalog i obsługa ofert | Import, normalizacja, mapowanie, weryfikacja i panel operatora | Powtórny import bez duplikatów; błędny format nie publikuje cen; dostępne źródło rzeczywiście aktualizuje katalog |
| D Wybór okazji i podgląd koszyka | API ofert, automatyczny dobór, opcjonalne wskazanie produktów, wycena wersji roboczej | Widać ważne oferty i warunki, braki cen i rzeczywiste opakowania bez wcześniejszej akceptacji |
| E Tydzień z promocji | Zapisane przepisy, kontekst ofert dla AI, ranking całego planu i trwałe generowanie | Powstaje 7 dni z uzasadnionym wykorzystaniem ofert; można opuścić ekran i wrócić; awaria zachowuje poprawne dania |
| F Szybkie poprawki | Powody wymiany, zamiana składnika, uproszczenie, ręczna edycja, podgląd i cofnięcie | Zmiana jednego dania zachowuje resztę tygodnia i pokazuje aktualny wpływ na zakupy |
| G Zakupy i pilotaż | Synchronizacja wkładów, grupowanie, zgłoszenie problemu, analityka i testy rzeczywistego przepływu | Jedna pełna ścieżka na telefonie przechodzi przez rzeczywisty backend i aktualne dane; checklisty nie znikają po korektach |
| H Rozszerzenie jakości | Druga sieć, dodatkowe ceny regularne, ceny wagowe i porównanie sklepów, jeśli nie weszły wcześniej | Każde rozszerzenie przechodzi osobny odbiór danych i testy mechanizmu cenowego |

Sprzedaż wagowa trafia do pierwszej wersji, jeżeli próbka pokaże, że bez niej brakuje istotnych składników obiadowych i warzyw. Nie odkładać jej automatycznie tylko dlatego, że obecny model obsługuje opakowania. Zakres tej decyzji zapada na etapie A.

Najważniejsze są etapy A–G. Średni priorytet po pilotażu mają kopiowanie poprzedniego tygodnia, jawne gotowanie na dwa dni, dodatkowe typy posiłków oraz lepsze dopasowanie na podstawie zaakceptowanych poprawek. Złożone promocje i wiele dat zakupów wprowadzać dopiero, gdy są częstym powodem ręcznych zmian.

## 13 Proponowany podział na zmiany w repozytorium

| Zmiana | Zakres do przeglądu | Zależności |
|---|---|---|
| 01 | Specyfikacja próbki, przypadki ofert i wynik wyboru źródła | Brak |
| 02 | Opcjonalny budżet, nowy tryb ustawień, adapter starszych dokumentów i testy zgodności | Brak; stosować uzgodnienia produktu z tego planu |
| 03 | Model produktu/oferty/importu, pochodzenie danych, migracje i reguły kwalifikacji | 01 |
| 04 | Pierwszy rzeczywisty adapter, synchronizacja, monitoring i panel sprawdzenia | 03 |
| 05 | Wydzielenie kalkulatora dla wersji roboczej, braki cen i porównywalność wyników | 02, 03 |
| 06 | Widok okazji, data/placówka, zapamiętane ustawienia i ręczny wybór produktów | 02–05 |
| 07 | Dobór zapisanych przepisów, kontekst AI i ranking wspólnego koszyka | 03, 05 |
| 08 | Trwałe generowanie tygodnia, wznowienie i postęp w UI | 07; pierwsza wersja może zapisywać sekwencyjnie |
| 09 | Podgląd i zastosowanie poprawek, cofnięcie, wersjonowanie migawek | 05, 07 |
| 10 | Synchronizacja zakupów i zachowanie ręcznych pozycji oraz odhaczeń | 05, 09 |
| 11 | Zdarzenia produktu, przeglądarkowy scenariusz rzeczywistego backendu i pilotaż | 04, 06, 08–10 |
| 12 | Drugi adapter lub brakujące typy cen oraz poprawki po pilotażu | 01, 03–05, 11 |

Orientacyjny zakres organizacyjny, do ponownej oceny po etapie A: około 6–10 tygodni pracy jednej osoby full stack przy istniejącej bazie i sprawnym źródle danych. To założenie planistyczne, nie wycena. Oczekiwanie na dostęp, umowę lub próbki jest osobnym czasem. Pierwszą pionową wersję z jedną siecią można wydać wcześniej, zanim powstanie pełny zakres poprawek i drugiej integracji.

## 14 Testy i scenariusze odbiorowe

| Obszar | Wymagane przypadki |
|---|---|
| Daty i sklepy | Granice dnia w Europe/Warsaw, zakup przed rozpoczęciem promocji, zakup po jej końcu, inna placówka, oferta tylko dla formatu sklepu |
| Warunki | Brak karty, karta bez aktywacji kuponu, oferta indywidualna, minimum, wielokrotności, limit, różny zakres limitu, wspólny limit wariantów |
| Ilości i ceny | Opakowania, sztuki, waga, brak przelicznika, cena zestawu bez błędu zaokrąglenia, cena poza limitem, całe koszty, nadwyżka, znany koszt już przekraczający preferencję przy brakujących cenach |
| Import | Zmiana HTML/JSON, brak strony, niepełna paginacja, duplikaty, zmiana dat/ceny, wycofanie, awaria źródła i nieodnowienie weryfikacji |
| Mapowanie | Alias, niejednoznaczny składnik, surowe/gotowane, wariant dietetyczny, różne gramatury tego samego produktu |
| Ranking | Duży rabat z nadmiernym zakupem przegrywa z użytecznym wariantem; zapas nie jest używany dwa razy; brak cen nie daje przewagi kosztowej |
| Generowanie | Biblioteka przed AI, wymagane produkty, zablokowane dania, błąd częściowy, limit kosztu i prób, wyjście z ekranu, restart, spóźniony wynik |
| Poprawki | Zmiana tylko wskazanego dania, aktualizacja instrukcji po zamianie, nieznany składnik, nieaktualny podgląd, cofnięcie po późniejszej zmianie |
| Zakupy | Brak duplikatów, wkłady kilku dań i planów, ręczne pozycje, odhaczenia, wzrost ilości, stary klient zastępujący listę |
| Zgodność | Dokument schematu 1, brak budżetu, stary klient z nowym backendem, dotychczasowe endpointy i plany |
| Prywatność | Cudze prywatne przepisy i plany niedostępne; brak treści przepisów, diet, zakupów i komentarzy w analityce |
| Przeglądarka | Telefon PL i desktop EN: ustawienia → aktualne oferty → tydzień → poprawka → lista → powrót po odświeżeniu |

W CI używać utrwalonych, dozwolonych próbek źródłowych i kontrolowanych odpowiedzi AI. Test aktualnego źródła uruchamiać osobno; awaria sieci sklepu nie powinna czynić wszystkich testów kodu niestabilnymi. Przed wydaniem wykonać kontrolowany test rzeczywistego importera, backendu, bazy i generatora, a nie wyłącznie fixture’y przeglądarkowe.

Zestaw referencyjny obejmuje przynajmniej tydzień bez ofert, skromny katalog, jedną i dwie sieci, dietę z wykluczeniami, puste i częściowe zapasy, duże promocje wielosztukowe oraz poprawkę po akceptacji. Każdy przypadek porównać z prostym doborem bez promocji pod kątem przydatności, liczby poprawek i kompletności kosztów.

## 15 Mierniki i sposób wydania

Główny miernik to czas od rozpoczęcia planowania do zaakceptowanej listy zakupów oraz liczba poprawek potrzebnych po drodze. Obecne `durationMs` przy akceptacji mierzy czas samego żądania akceptacji, więc nie wystarcza do oceny tego celu.

| Miernik | Interpretacja |
|---|---|
| Mediana i 90. percentyl czasu całej ścieżki | Czy użytkownik szybciej kończy planowanie, razem z oczekiwaniem na AI |
| Poprawki przed akceptacją i ich powody | Czy przepisy od razu pasują i czy korekty pomagają |
| Akceptacja planu i utworzenie listy | Czy propozycja kończy się użytecznym rezultatem |
| Pokrycie pozycji cenami i warunkami | Czy koszt i promocje można wiarygodnie przedstawić; osobno dla sieci i kategorii |
| Błędne oferty, opóźnienie aktualizacji i rekordy do sprawdzenia | Czy integracja jest wystarczająco niezawodna w codziennym użyciu |
| Wywołania AI i koszt na zaakceptowany tydzień | Czy biblioteka i korekty ograniczają koszt generowania |
| Powrót do planera w następnym tygodniu | Czy funkcja pomaga regularnie |

Wstępny cel do sprawdzenia w pilotażu: mediana poniżej 3 minut dla powracającego użytkownika ze zapisanymi ustawieniami oraz najwyżej 1–2 poprawki przed akceptacją. To proponowany cel produktu, nie wynik researchu ani gwarantowany czas generowania. Najpierw zebrać punkt odniesienia obecnej wersji.

Rozszerzyć [kontrakt analityki](ANALITYKA_PLANERA.md) o wybór okazji, ukończenie generowania, rodzaj poprawki, utworzenie wyceny i zgłoszenie problemu. Zdarzenia mają kody i liczby; nie wysyłać treści komentarzy, nazw produktów, diet ani przepisów. Zachować istniejący wymóg zgody analitycznej.

Wydanie przebiega etapami: testy zespołu → mały pilotaż użytkowników → korekta źródła i rankingu → szerszy dostęp. Osobne przełączniki kontrolują sieć, adapter, nowy generator, korekty i nową synchronizację listy. Awaria jednej sieci nie wyłącza drugiej ani zwykłego planera. Wycofanie funkcji zachowuje zapisane plany i historię cen; unikać destrukcyjnego cofania migracji.

## 16 Decyzje i ryzyka

| Decyzja | Założenie do dalszej pracy | Moment rozstrzygnięcia |
|---|---|---|
| Liczba sklepów | Jeden domyślnie, dwa po jawnym wyborze | Przed finalizacją formularza i rankingu |
| Powtarzanie dań | Opcjonalne, początkowo wyłączone | Przed pierwszym doborem tygodnia |
| Dostawca i koszt danych | Najpierw próbka i porównanie; brak zobowiązań zakupowych | Po etapie A, przed umową lub płatną integracją |

| Ryzyko | Ograniczenie |
|---|---|
| Brak wiarygodnego feedu | Jedna sieć na start, ręczny pilotaż jako przejście, jawny status automatyzacji |
| Zbyt mało cen do pełnego koszyka | Dopuścić częściową wycenę, mierzyć pokrycie, osobno rozwijać ceny regularne |
| Kupowanie nadmiaru przez promocje | Liczyć cały wydatek i nadwyżki; nie maksymalizować liczby rabatów |
| Monotonne posiłki | Kontrolować powtórki i różnorodność; mierzyć powody wymiany |
| Długi i kosztowny generator | Biblioteka, trwały postęp, ograniczona liczba kandydatów i prób |
| Częste poprawki niszczą zakupy | Podgląd, wersjonowanie i synchronizacja wkładów zamiast usuwania listy |
| Złożony ekran | Szybki start z zapisanych ustawień; szczegóły ofert i kosztu rozwijane na żądanie |

Podstawa oceny obecnej aplikacji obejmuje odczyt kodu i dokumentacji oraz 10 testów komponentów planera/wyceny i 2 testy przygotowania ofert uruchomione podczas audytu w tej rozmowie. Produkcyjny backend, rzeczywiste odpowiedzi Gemini i pełny feed obu sieci pozostają do odbioru w etapach wdrożenia. Nie przyjęto oszczędności ani obietnic czasowych konkurencji jako wyników tej aplikacji.
