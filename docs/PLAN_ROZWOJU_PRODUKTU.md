# Plan rozwoju Dish Genie: tygodniowe planowanie posiłków

## 1. Cel produktu

Głównym zadaniem Dish Genie ma być skrócenie drogi od pytania „co będziemy jeść w tym tygodniu?” do zaakceptowanego planu i gotowej listy zakupów. Produkt powinien wykorzystywać stan lodówki, ograniczenia dietetyczne i preferencje użytkownika, ale nie wymuszać gotowania wyłącznie z posiadanych produktów.

Najważniejsza ścieżka użytkownika:

1. Użytkownik wybiera dni, posiłki, liczbę osób i poziom wysiłku.
2. Otrzymuje propozycję planu na 7 dni.
3. Blokuje zaakceptowane pozycje i wymienia pojedyncze dania.
4. Akceptuje plan.
5. Otrzymuje zagregowaną listę zakupów pomniejszoną o stan lodówki.
6. Oznacza ugotowane dania, dzięki czemu aplikacja buduje historię i lepiej dopasowuje kolejne propozycje.

## 2. Założenia planu

- Przepisy są prywatne domyślnie i stają się publiczne dopiero po jawnej publikacji.
- Minimalizacja zakupów jest preferencją, a nie twardym ograniczeniem.
- Pierwsza wersja planera używa prostego widoku siedmiu dni, bez kalendarza miesięcznego i integracji z kalendarzem.
- Plan należy zapisać przed tworzeniem listy zakupów, aby operacja była powtarzalna i możliwa do odtworzenia.
- Ilości składników są przeliczane względem liczby porcji.
- Oznaczenie dania jako ugotowane nie zmniejsza automatycznie stanu lodówki bez potwierdzenia użytkownika.
- Funkcje współdzielenia gospodarstwa, ceny sklepowe i integracje zewnętrzne pozostają poza MVP.

## 3. Zweryfikowany stan obecny

| Obszar | Stan | Wniosek dla roadmapy |
|---|---|---|
| Prywatność przepisów | Brak pola widoczności; publiczne endpointy listy i szczegółu zwracają wszystkie przepisy | Prywatność musi wejść przed planerem i dalszym rozwojem katalogu |
| Generator | Backend posiada strukturalne pola polityki lodówki i zakupów, lecz frontend nadal wysyła starszy payload oparty głównie na tekście | Należy podłączyć prawdziwe preferencje strukturalne, a nie tylko rozbudowywać prompt |
| Składniki | Przepisy mają strukturalne składniki i ilości; porównanie z lodówką obsługuje proste nazwy oraz część konwersji jednostek | Potrzebna jest wspólna normalizacja nazw, aliasów i jednostek |
| Porcje | Pole istnieje w DTO i UI zapisuje wartość 2, ale encja oraz baza go nie przechowują | Trwałe porcje są blokadą dla poprawnej agregacji tygodnia |
| Lista zakupów | Jest zapisywana na koncie, synchronizowana i generowana z pojedynczego przepisu | Można ją rozszerzyć o źródło pozycji, agregację planu i informację „masz w lodówce” |
| Lodówka | Obsługuje ilość, jednostkę, datę ważności, edycję, scalanie, kod kreskowy i skan paragonu | Daty ważności i skanowanie należy włączyć do planera; nie trzeba budować ich od zera |
| Preferencje | Diety i nielubiane składniki są zapisane na koncie | Można użyć ich jako twardych ograniczeń planera |
| Historia gotowania | Brak modelu i przepływu | Nowy moduł po ustabilizowaniu planera |
| Analityka | PostHog i zdarzenia podstawowej ścieżki są obecne za zgodą użytkownika | Trzeba dodać lejek planera i mierniki jakości rekomendacji |
| Testy | Frontend: 44/44 testów przechodzi, typecheck przechodzi. Backend uruchomił 69 testów, 11 nie wystartowało przez niezgodność Byte Buddy z lokalną Javą 25 | CI i lokalne testy backendu powinny używać wspieranej Javy 17 albo zaktualizowanego stosu testowego |

## 4. Priorytety funkcjonalne

### Najważniejsze

| Kolejność | Zmiana | Co jest potrzebne | Efekt dla użytkownika | Ryzyka |
|---:|---|---|---|---|
| 1 | Prywatne przepisy i publikowanie | Widoczność w bazie, autoryzacja odczytu, osobne zapytania publiczne, akcja publikacji i wycofania | Kontrola nad własną treścią i większe zaufanie | Migracja obecnych publicznych adresów i SEO |
| 2 | Porcje, nazwy i jednostki składników | Trwałe porcje, kanoniczne jednostki, aliasy nazw, deterministyczne przeliczenia | Poprawne ilości w planie i zakupach | Błędne automatyczne łączenie podobnych składników |
| 3 | Strukturalny generator | Frontend wysyłający polityki, walidowany wynik z pokryciem lodówki i brakami, deterministyczna weryfikacja po AI | Jasne wyjaśnienie, co użytkownik już ma i co musi dokupić | Koszt AI, czas odpowiedzi i niepoprawne dane modelu |
| 4 | MVP planera 7 dni | Model planu i pozycji, generator tygodnia, blokowanie, wymiana, zapis wersji roboczej i akceptacja | Szybki wybór dań na cały tydzień | Zbyt długi czas generowania i przeładowany ekran mobilny |
| 5 | Lista zakupów z planu | Agregacja ilości, przeliczenie porcji, odjęcie lodówki, pochodzenie pozycji, idempotentne odświeżanie | Jedna gotowa lista bez duplikatów | Utrata ręcznych pozycji przy ponownym generowaniu |
| 6 | Historia ugotowanych dań | Zdarzenie wykonania, historia, prosty feedback i opcjonalna korekta lodówki | Lepsze rekomendacje i pamięć posiłków | Zbieranie danych bez widocznej wartości lub zbyt wiele pytań |

### Średnia ważność

| Zmiana | Warunek wejścia | Zakres pierwszej wersji | Ryzyka |
|---|---|---|---|
| Produkty z krótką datą | Stabilne dopasowanie składników | Wynik „użyj najpierw” oraz uzasadnienie rekomendacji | Daty często nie będą uzupełnione |
| Resztki i większe porcje | Trwałe porcje i historia gotowania | Powiązanie ugotowanego dania z lunchem następnego dnia | Trudne oszacowanie rzeczywistej ilości resztek |
| Różny czas i wysiłek w dniach | Stabilny model pozycji planu | Prosty limit czasu i poziom wysiłku na dzień | Więcej ustawień może obniżyć ukończenie formularza |
| Meal prep | Resztki oraz wiarygodne ilości | Oznaczenie wspólnej bazy lub większej partii | Plan może stać się zbyt złożony dla zwykłego użytkownika |
| Kategorie zakupów | Stabilna normalizacja składników | Kategorie podstawowe i ręczna korekta | Błędy klasyfikacji produktów z paragonów |
| Powody wymiany | Działający swap pojedynczego dania | Krótka lista powodów i opcjonalny komentarz | Zbyt częste pytanie przy każdej wymianie |
| Budżet orientacyjny | Dane o składnikach i zaobserwowane zapotrzebowanie | Poziomy „oszczędny / standardowy”, bez obietnicy dokładnej ceny | Wrażenie dokładności bez lokalnych cen |

### Później lub warunkowo

| Zmiana | Kiedy warto ją rozpocząć | Dlaczego nie teraz |
|---|---|---|
| Wspólne gospodarstwo domowe | Gdy znacząca część aktywnych użytkowników wraca co tydzień do planera | Uprawnienia, konflikty edycji i zaproszenia znacznie zwiększają zakres |
| Powiadomienia | Gdy historia pokaże, które przypomnienia rzeczywiście pomagają | Ryzyko zmęczenia powiadomieniami |
| Integracja z kalendarzem | Gdy użytkownicy próbują przenosić zaakceptowany plan do innych narzędzi | Nie waliduje podstawowej wartości planera |
| Dokładne ceny i integracje sklepowe | Po walidacji potrzeby budżetowej i wyborze rynku | Zależność od dostawców, lokalizacji i jakości danych |
| Cele żywieniowe | Po ustaleniu odpowiedzialności za dokładność danych | Ryzyko zdrowotne i konieczność jasnego komunikowania szacunków |
| Import z linków i social mediów | Gdy własna biblioteka przepisów stanie się ograniczeniem planera | Kruchy scraping, prawa do treści i utrzymanie integracji |

## 5. Plan wdrożenia etapami

Każdy etap powinien zostać wydany jako mała, mierzalna wersja. Kolejny etap zaczyna się dopiero po spełnieniu bramy jakości poprzedniego.

Szczegółowy plan wykonawczy dla Etapów 0–3 znajduje się w [PLAN_WDROZENIA_ETAPOW_0_3.md](PLAN_WDROZENIA_ETAPOW_0_3.md).

### Etap 0 — pomiar i stabilna baza jakości

**Cel:** móc bezpiecznie oceniać kolejne zmiany.

Zakres:

- Ujednolicić środowisko backendu z Javą 17 używaną przez projekt albo zaktualizować narzędzia testowe do lokalnej Javy.
- Dodać definicje lejka: wejście do planera, wygenerowanie planu, pierwsza wymiana, akceptacja, utworzenie listy i oznaczenie dania jako ugotowane.
- Ustalić anonimowe identyfikatory planu i generacji, bez wysyłania nazw składników do analityki.
- Zapisać kontrakty API jako testy integracyjne przed tworzeniem nowych endpointów.

Brama ukończenia:

- Backend i frontend przechodzą testy w docelowym środowisku CI.
- Zdarzenia analityczne nie zawierają listy składników, diet ani tekstu promptu.
- Jest opisany jeden główny miernik: odsetek użytkowników, którzy zaakceptowali plan i utworzyli listę zakupów.

### Etap 1 — prywatność przepisów i jawne publikowanie

**Cel:** żaden nowy przepis użytkownika nie jest publiczny bez jego działania.

Model danych i backend:

- Dodać `visibility` (`PRIVATE`, `PUBLIC`) albo `published_at`; rekomendowane jest `visibility` z domyślnym `PRIVATE`.
- Odfiltrować prywatne przepisy z publicznej listy, wyszukiwarki, szczegółu, adresu po nazwie i sitemap.
- Pozwolić właścicielowi oraz administratorowi czytać prywatny przepis.
- Dodać osobne operacje publikacji i wycofania publikacji zamiast zmiany widoczności w ogólnym formularzu edycji.
- Zdefiniować niezmienny publiczny identyfikator/slug, aby zmiana nazwy nie psuła linku.

Frontend:

- W bibliotece użytkownika pokazywać status „Prywatny” lub „Publiczny”.
- Dodać jednoznaczną akcję „Opublikuj” z potwierdzeniem tego, co stanie się widoczne.
- Dla cudzych prywatnych przepisów pokazywać 404, nie 403, aby nie ujawniać ich istnienia.

Migracja:

- Rekomendacja: istniejące przepisy użytkowników ustawić jako prywatne, a przepisy promowane/kuratorowane opublikować jawnie przez administratora.
- Przed migracją przygotować listę obecnych publicznych URL-i i zdecydować, które mają pozostać dostępne.

Testy akceptacyjne:

- Nowo zapisany przepis nie pojawia się publicznie.
- Gość nie może odczytać prywatnego przepisu po ID, slugu, nazwie ani przez wyszukiwarkę.
- Właściciel może opublikować i wycofać przepis.
- Sitemap zawiera wyłącznie publiczne przepisy.

### Etap 2 — trwałe porcje i wspólny język składników

**Cel:** stworzyć wiarygodną podstawę do agregacji tygodnia.

Model danych:

- Zapisywać `servings` w encji i tabeli przepisu; istniejące rekordy uzupełnić wartością 2.
- Wprowadzić wspólną reprezentację jednostek masy, objętości i sztuk oraz tabelę bezpiecznych konwersji.
- Dodać `canonical_name` lub osobny słownik składników z aliasami językowymi.
- Zachować nazwę wyświetlaną użytkownikowi; normalizacja nie może niszczyć treści przepisu.
- Oznaczyć produkty podstawowe, np. sól, olej i pieprz, aby można je było pomijać na liście na życzenie użytkownika.

Logika:

- Stworzyć jeden serwis normalizacji używany przez lodówkę, przepisy, paragony, generator i listę zakupów.
- Agregować tylko składniki o zgodnych wymiarach; nie sumować np. „2 szt.” i „300 g” bez jawnego przelicznika dla danego produktu.
- Przy niepewnym dopasowaniu zachować dwie pozycje i pozwolić użytkownikowi je scalić.

Testy akceptacyjne:

- Zmiana liczby porcji przelicza składniki i listę zakupów, ale nie zmienia zapisanego oryginału bez polecenia.
- `1 kg` i `500 g` agregują się do poprawnej wartości.
- Składniki o niezgodnych jednostkach nie są łączone po cichu.
- Alias jest dopasowany do lodówki, ale UI nadal używa czytelnej nazwy.

### Etap 3 — strukturalny generator i ocena wykorzystania lodówki

**Cel:** otrzymywać przewidywalne propozycje, które można porównywać i wykorzystać w planerze.

Kontrakt wejściowy:

- `mealType`, `servings`, `maxMinutes`, `effort`.
- `fridgePolicy=PRIORITIZE` jako domyślne zachowanie planera.
- `shoppingPolicy=MINIMIZE` jako preferencja, nigdy automatycznie `NONE`.
- Diety i nielubiane składniki pobierane po stronie serwera jako twarde ograniczenia.
- Identyfikatory produktów, które trzeba wykorzystać, tylko gdy użytkownik wskaże je jawnie.

Kontrakt wyniku:

- Strukturalny przepis.
- Lista dopasowanych produktów z lodówki.
- Deterministycznie wyliczone brakujące składniki i ilości.
- Wynik pokrycia lodówki oraz krótkie uzasadnienie rekomendacji.
- Deklarowany czas, wysiłek i liczba porcji.

Zasada odpowiedzialności:

- AI proponuje przepisy i uzasadnienie.
- Kod aplikacji ponownie oblicza pokrycie lodówki, braki, konwersje oraz zgodność twardych ograniczeń.
- Wynik niespełniający diety lub schematu jest odrzucany albo regenerowany z ograniczoną liczbą prób.

Frontend:

- Pokazywać „Masz”, „Brakuje” i „Dlaczego pasuje”.
- Zmienić „Bez zakupów” na preferencję „Minimalizuj zakupy”; twardy tryb bez zakupów może pozostać tylko jako jawna, zaawansowana opcja.
- Przekazywać strukturalne pola zamiast budować wszystkie preferencje w jednym tekście.

Brama ukończenia:

- Dla zestawu referencyjnych przypadków generator przestrzega diet i nielubianych składników.
- Braki wyliczone po stronie serwera są stabilne dla tego samego przepisu i stanu lodówki.
- UI rozróżnia preferencję minimalnych zakupów od twardego zakazu.

### Etap 4 — MVP tygodniowego planera

**Cel:** zweryfikować, czy użytkownik chce wybrać posiłki na cały tydzień.

Minimalny model:

- `meal_plan`: właściciel, tydzień rozpoczynający, status `DRAFT`/`ACCEPTED`, domyślna liczba osób, wersja.
- `meal_plan_slot`: dzień, typ lub nazwa posiłku, liczba porcji, poziom wysiłku, stan `EMPTY`/`PLANNED`/`COOKED`/`SKIPPED`, blokada pozycji.
- Pozycja planu wskazuje zapisany przepis lub przechowuje wersjonowaną migawkę propozycji. Rekomendowana jest migawka, aby późniejsza edycja przepisu nie zmieniała zaakceptowanego planu.

Przepływ UI:

1. Wybór dni tygodnia.
2. Wybór liczby posiłków i osób.
3. Jeden domyślny poziom wysiłku; opcjonalna korekta dla wybranego dnia.
4. Generowanie propozycji w prostych kolumnach/kartach siedmiu dni.
5. Blokowanie pozycji.
6. Wymiana pojedynczego dania bez zmiany reszty planu.
7. Akceptacja planu.

Regeneracja i odporność:

- Wymiana wysyła wyłącznie kontekst danego slotu, listę zablokowanych pozycji i dotychczas odrzucone propozycje.
- Zabezpieczyć operację kluczem idempotencji, aby podwójne kliknięcie nie tworzyło dwóch planów.
- Zapisywać wersję roboczą po każdej zmianie.
- W razie błędu jednego slotu zachować pozostałe wyniki i umożliwić ponowienie tylko brakującej pozycji.

Poza MVP:

- Przeciąganie między dniami.
- Kalendarz miesięczny.
- Współdzielenie planu.
- Automatyczne meal prep i rozbudowane bilansowanie odżywcze.

Testy akceptacyjne:

- Odświeżenie strony nie usuwa wersji roboczej.
- Wymiana jednego dania nie zmienia zablokowanych pozycji.
- Plan zawsze respektuje zapisane diety i nielubiane składniki.
- Użytkownik może oznaczyć dzień jako „poza domem”, „resztki” lub „bez planu”.
- Plan można zaakceptować mimo części pustych slotów.

### Etap 5 — automatyczna lista zakupów z planu

**Cel:** po akceptacji planu utworzyć jedną wiarygodną listę zakupów.

Logika agregacji:

1. Przeliczyć każdy przepis do liczby porcji danego slotu.
2. Znormalizować nazwy oraz jednostki.
3. Zsumować zgodne składniki.
4. Odjąć zgodne ilości z lodówki.
5. Oddzielić „do kupienia” od „już masz”.
6. Przypisać kategorię sklepową.

Model i synchronizacja:

- Dodać źródło pozycji: ręczne, przepis lub zaakceptowany plan.
- Zachować powiązanie z planem i slotami, które wymagają produktu.
- Nie usuwać ręcznych pozycji podczas ponownego generowania listy.
- Ponowne wygenerowanie dla tej samej wersji planu powinno aktualizować jego pozycje zamiast je duplikować.
- Pokazywać datę stanu lodówki użytego do obliczeń i umożliwić ponowne przeliczenie.

Frontend:

- Sekcje „Do kupienia” i „Masz w domu”.
- Kategorie zakupów z możliwością ręcznej zmiany.
- Informacja, do których dań potrzebny jest składnik.
- Ostrzeżenie, jeśli stan lodówki zmienił się po utworzeniu listy.

Brama ukończenia:

- Lista z kilku przepisów nie ma nieuzasadnionych duplikatów.
- Ręcznie dodana pozycja przetrwa ponowne generowanie.
- Zmiana liczby porcji lub slotu aktualizuje wyłącznie pozycje pochodzące z planu.

### Etap 6 — ugotowane dania i historia preferencji

**Cel:** zamknąć pętlę planowania i zebrać sygnały do ulepszania rekomendacji.

Zakres:

- Akcja „Ugotowane” na pozycji planu.
- Historia: data, przepis/migawka, plan, liczba porcji i opcjonalna ocena.
- Krótkie sygnały: „chcę ponownie”, „nie dla mnie”, „za trudne”, „za długo”, „za drogie”.
- Osobna akcja „Pomiń” dla posiłku, którego użytkownik nie ugotował.
- Po oznaczeniu ugotowania zaproponować korektę lodówki z podglądem odejmowanych ilości; użytkownik zatwierdza zmianę.

Uczenie preferencji — kolejność:

1. Najpierw proste reguły, np. nie proponuj ostatnio odrzuconego dania i zwiększaj różnorodność.
2. Następnie personalizacja rankingu na podstawie zaakceptowanych, wymienionych i ugotowanych dań.
3. Nie zmieniać twardych ograniczeń dietetycznych na podstawie zachowania.

Brama ukończenia:

- Użytkownik rozumie różnicę między zaplanowanym, pominiętym i ugotowanym daniem.
- Historia nie znika po edycji lub usunięciu oryginalnego przepisu.
- Korekta lodówki nigdy nie następuje bez widocznego potwierdzenia.

### Etap 7 — daty ważności, resztki i meal prep

**Cel:** ograniczyć marnowanie żywności i liczbę sesji gotowania.

Wersja 7A — użyj najpierw:

- Dodać wskaźnik pilności na podstawie daty ważności.
- Podnieść ranking przepisów używających produktów z krótką datą, ale nie łamać diety ani spójności kulinarnej.
- Wyjaśniać: „wykorzystuje szpinak, którego termin kończy się jutro”.

Wersja 7B — resztki:

- Przy gotowaniu pozwolić wskazać liczbę pozostałych porcji.
- Utworzyć pozycję resztek z datą przygotowania i sugerowanym terminem użycia.
- Pozwolić przypisać resztki do kolejnego slotu planu.

Wersja 7C — prosty meal prep:

- Tryb „ugotuj więcej” dla wybranego przepisu.
- Oznaczenie wspólnej bazy, np. ryżu lub pieczonych warzyw, dopiero po walidacji przepływu resztek.
- Lista przygotowań zbiorczych bez budowania osobnego kalendarza.

Ryzyko do kontrolowania:

- Aplikacja nie powinna przedstawiać terminu przydatności domowych resztek jako gwarancji bezpieczeństwa. Komunikaty mają być ostrożne, a użytkownik zachowuje decyzję.

### Etap 8 — budżet, elastyczność dnia i lepsze wymiany

**Cel:** zwiększyć dopasowanie planu bez obciążania podstawowego formularza.

Zakres:

- Opcjonalny tryb budżetu: oszczędny lub standardowy, bez deklarowania dokładnej ceny.
- Limit czasu i wysiłku na konkretny dzień.
- Powody wymiany dania z możliwością pominięcia pytania.
- Sugerowane zamienniki brakujących składników dostępne w lodówce.
- Tryby slotu: poza domem, resztki, własne danie, bez planu.

Walidacja:

- Ustawienia zaawansowane pozostają zwinięte domyślnie.
- Powód wymiany realnie wpływa na następną propozycję.
- Mierzyć, czy dodatkowe ustawienia zwiększają akceptację planu, czy tylko wydłużają konfigurację.

### Etap 9 — rozwój warunkowy

Uruchamiać wyłącznie na podstawie zachowań i zgłoszeń użytkowników:

- Wspólne gospodarstwo i współdzielona lista.
- Powiadomienia o przygotowaniu, rozmrażaniu i produktach z krótką datą.
- Integracja zaakceptowanego planu z kalendarzem.
- Sezonowość i lokalna dostępność.
- Dokładniejsze ceny i wybrani partnerzy sklepów.
- Import z linku lub zdjęcia.
- Cele żywieniowe z jasnym oznaczeniem, że wartości są szacunkowe.

## 6. Plan walidacji produktu

### Główny miernik

Odsetek aktywnych użytkowników planera, którzy w danym tygodniu:

1. wygenerowali plan,
2. zaakceptowali go,
3. utworzyli z niego listę zakupów.

### Mierniki pomocnicze

- Czas od wejścia do planera do zaakceptowania planu.
- Odsetek wygenerowanych planów zaakceptowanych bez pełnej regeneracji.
- Liczba wymian na zaakceptowany plan i rozkład powodów wymiany.
- Odsetek zablokowanych pozycji zachowanych po wymianach.
- Odsetek zaplanowanych dań oznaczonych jako ugotowane lub pominięte.
- Udział składników planu pokryty przez lodówkę.
- Liczba produktów z krótką datą wykorzystanych w zaakceptowanych planach.
- Odsetek list wymagających ręcznego rozdzielenia albo scalenia pozycji.
- Koszt i czas generowania jednego zaakceptowanego planu.

### Pierwsze testy z użytkownikami

1. Czy użytkownik rozumie różnicę między „minimalizuj zakupy” i „bez zakupów”?
2. Czy potrafi w mniej niż kilka minut ułożyć, poprawić i zaakceptować tydzień?
3. Czy rozumie, skąd wzięła się każda pozycja listy zakupów?
4. Czy woli ustawiać wysiłek raz dla tygodnia, czy osobno dla dni?
5. Czy akcja „Ugotowane” jest wystarczająco wartościowa, aby wracać do planu?

## 7. Plan testów dla każdego etapu

Każdy etap powinien obejmować:

- Testy migracji Flyway na pustej i istniejącej bazie.
- Testy uprawnień: właściciel, inny użytkownik, administrator i gość.
- Testy serwisów dla reguł domenowych i przeliczeń jednostek.
- Testy kontraktowe JSON dla generatora AI.
- Testy komponentów dla pustych, częściowych, błędnych i wczytujących się stanów.
- Testy E2E głównej ścieżki mobilnej oraz desktopowej.
- Testy idempotencji generowania planu i listy.
- Kontrolę kosztu, czasu odpowiedzi i zachowania po częściowej awarii AI.
- Sprawdzenie polskiej i angielskiej wersji interfejsu.

## 8. Najważniejsze decyzje przed rozpoczęciem

1. **Migracja obecnych przepisów:** rekomendacja to ustawić wszystkie przepisy użytkowników jako prywatne i jawnie zachować publiczność wyłącznie kuratorowanych treści. Alternatywa „pozostaw wszystko publiczne” jest sprzeczna z nową obietnicą prywatności.
2. **Model posiłków:** rekomendacja to elastyczne sloty z opcjonalnym typem `BREAKFAST`/`LUNCH`/`DINNER`/`SNACK`, zamiast sztywnej liczby posiłków na każdy dzień.
3. **Zmiana lodówki po gotowaniu:** rekomendacja to podgląd i jedno potwierdzenie odejmowanych produktów, a nie cicha automatyzacja.

## 9. Pierwsze trzy przekroje implementacyjne

Jeżeli prace mają zacząć się od razu, pierwsze trzy samodzielne zakresy to:

1. **Prywatny zapis przepisu:** migracja widoczności, filtrowanie wszystkich publicznych odczytów, status w bibliotece i publikacja/wycofanie wraz z testami uprawnień.
2. **Porcje i konwersje:** trwałe `servings`, wspólny serwis jednostek, przeliczanie składników i testy agregacji.
3. **Jedna strukturalna rekomendacja:** nowy payload frontendu, `PRIORITIZE` + `MINIMIZE`, deterministyczne „masz/brakuje” i wyjaśnienie w UI. Dopiero po jakości tego przekroju należy generować pełne siedem dni.
