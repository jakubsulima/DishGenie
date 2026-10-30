# Oferty sklepowe i wycena planu — pilotaż

Stan lokalnej implementacji: 29 października 2026. Planer oblicza zapotrzebowanie, a moduł wyceny porównuje koszt całych opakowań w Lidlu, Biedronce i obu sklepach. Katalog cen jest zasilany przez administratora po weryfikacji. Automatyczny feed, optymalizacja jadłospisu według cen i wdrożenie produkcyjne nie są częścią tego przyrostu.

## Dane dopuszczone do wyceny

Przyjmujemy wyłącznie produkty ze stałą wielkością opakowania, ceną w PLN i potwierdzoną dostępnością oferty w całej Polsce. Produkt jest przypisany do istniejącego `ingredientId`; cena pomidorów nie zastępuje ceny przecieru, a wariant dietetyczny nie jest domyślnym zamiennikiem zwykłego produktu. Dopasowanie wykorzystuje istniejący katalog składników i aliasy; niejednoznaczne rozpoznanie pozostawia brak ceny.

Cena dotyczy **jednego opakowania** przy spełnieniu zapisanych warunków. Przykładowo dla oferty wymagającej dwóch opakowań po 3,99 zł, `packagePrice=3.99`, `minimumPackages=2`. Jeżeli promocja dotyczy wyłącznie pełnych par, dodatkowo `packageMultiple=2`. Limit liczby opakowań zapisuje `maximumPackages`; przekroczenie wyłącza ofertę z danego koszyka, zamiast domyślnie naliczać nieznaną cenę regularną. Obsługa mieszanych produktów, „drugi produkt 50% taniej” z różnymi cenami, wydatku minimalnego na cały paragon i kuponów indywidualnych pozostaje poza pilotem.

Cena za kilogram produktu sprzedawanego luzem nie jest opakowaniem 1 kg. Nie publikować jej w tym modelu. Podobnie nie publikować oferty lokalnej jako ogólnopolskiej. `conditionsVerified` potwierdza, że wszystkie warunki dają się wyrazić polami pilotażu, a ich opis znajduje się w `conditions`.

## API administratora

Wszystkie operacje wymagają istniejącej roli `ADMIN`. Mutacje korzystają z dotychczasowej ochrony CSRF i sesji aplikacji.

| Operacja | Znaczenie |
|---|---|
| `GET /admin/store-offers` | Ostatnie 100 zapisanych ofert, z wersją i statusem aktywności |
| `PUT /admin/store-offers/{uuid}` | Zapis nowej lub aktualizacja istniejącej oferty |
| `POST /admin/store-offers/{uuid}/withdraw` | Wycofanie oferty; body `{ "version": aktualnaWersja }` |

Pola body publikacji:

| Pole | Wymaganie |
|---|---|
| `version` | `0` dla nowej oferty; dla edycji aktualna zewnętrzna `version` z odpowiedzi GET/PUT |
| `store` | `LIDL` albo `BIEDRONKA` |
| `ingredientId` | Istniejący identyfikator składnika dopasowanego przez administratora |
| `productName` | Nazwa faktycznego produktu, do 200 znaków |
| `packageAmount`, `unit` | Dodatnia ilość w jednym opakowaniu; jednostka `g`, `ml` lub `pcs`; sztuki całkowite |
| `packagePrice` | Dodatnia cena jednego opakowania w PLN, maksymalnie dwa miejsca dziesiętne |
| `minimumPackages`, `packageMultiple` | Dodatnie liczby całkowite; zwykłe opakowanie ma `1`, `1` |
| `maximumPackages` | Dodatnia liczba całkowita albo `null`, tylko jeśli źródło nie podaje limitu |
| `loyaltyRequired` | Czy konieczna jest karta/aplikacja i ewentualna aktywacja kuponu |
| `validFrom`, `validTo` | Włączne daty `YYYY-MM-DD` dostępności oferty w sklepie, po sprawdzeniu okresu ceny |
| `sourceUrl` | Oficjalny adres HTTPS `www.lidl.pl` albo `www.biedronka.pl`, zgodny z siecią |
| `conditions` | Zwięzły opis wszystkich warunków pokazany użytkownikowi, do 1000 znaków |
| `verifiedAt` | Rzeczywisty czas sprawdzenia źródła jako ISO Instant; nie przyszły i nie starszy niż 48 godzin |
| `nationwide`, `fixedPackage`, `conditionsVerified` | Każde musi być `true` po faktycznym potwierdzeniu |

API waliduje format, zakres, źródłową domenę, mapowanie i zgodność limitów. Nie pobiera adresu URL ani nie potwierdza prawdziwości treści za administratora. Aktualizacja wymaga wersji; równoległa zmiana powoduje konflikt. Wycofanie usuwa ofertę z kolejnych wycen. Istniejące wyceny mają krótki termin ważności i wymagają ponownego sprawdzenia przed zakupami.

Nie ma jeszcze formularza zarządzania ofertami w panelu administratora ani importu masowego. Powyższe API jest pierwszym interfejsem zasilania katalogu. Nie dodano przykładowych cen do migracji ani produkcyjnej bazy.

## Przygotowanie próbek Lidla

Skrypt działa na zapisanym HTML oficjalnej strony [żywności i napojów](https://www.lidl.pl/c/zywnosc-i-napoje/s10068374):

```text
python3 scripts/offers/prepare_lidl_candidates.py saved-page.html candidates.json
python3 -m unittest discover -s scripts/offers -p 'test_*.py'
```

Odczytuje osadzony JSON Nuxt bez uruchamiania JavaScript i bez żądań sieciowych. Zachowuje źródłowe ceny, daty, regiony, warunki oraz URL produktu w pliku oznaczonym `NEEDS_REVIEW`. Nie zgaduje wielkości opakowań, składnika ani zakresu geograficznego. Czas przygotowania pliku nie jest czasem weryfikacji ceny. Format wyjściowy celowo nie odpowiada body publikacji. Brak spodziewanej struktury kończy się błędem, bez publikacji pustego katalogu.

W próbce z 29 października rozpoznano 12 produktów z pierwszej partii strony; nie jest to pełny katalog. Ceny mogą mieć inne daty niż dostępność sklepu, więc należy sprawdzić oba okresy. Dla Biedronki punktem wejścia jest [oficjalna oferta](https://www.biedronka.pl/pl/nowa-oferta), wymagająca także ustalenia placówki dla danych lokalnych. Automatyczny parser Biedronki pozostaje do wdrożenia.

## Wycena użytkownika

`POST /v2/meal-plans/{id}/quote` przyjmuje `version`, `shoppingDate` i `loyaltyStores` (tablica nazw sieci, pusta bez rabatów lojalnościowych). Weryfikuje właściciela, wersję planu i zaakceptowaną listę. Data zakupów musi przypadać od dzisiaj do siedmiu dni wprzód, nie później niż pierwszy zaplanowany posiłek. Daty sklepu interpretowane są w strefie Europe/Warsaw.

Dla każdej pozycji wybiera najmniejszy **całkowity koszt zakupu** spośród dopuszczonych ofert, po zaokrągleniu ilości do opakowań, minimum i wielokrotności. Oferta przeterminowana, nieaktualizowana od ponad 48 godzin, wycofana lub wymagająca niepotwierdzonej karty jest pomijana. Niezgodne jednostki i niepewne ilości nie są arbitralnie przeliczane. Gdy zmiana aliasów katalogu mogłaby naliczyć ten sam limit promocji dla kilku wierszy, wymagane jest ponowne sprawdzenie ilości.

Odpowiedź zawiera datę i termin ważności, wersję planu, budżet oraz koszyki. Każdy koszyk zawiera sumę wycenionych pozycji, liczbę braków, liczbę opakowań, ilość do kupienia, nadwyżkę oraz źródło i warunki każdej wybranej oferty. Wynik zachowuje migawkę użytych danych. Status:

- `WITHIN_BUDGET`: wszystkie wymagane zakupy wycenione, suma nie przekracza budżetu.
- `OVER_BUDGET`: już znana suma przekracza budżet, również przy brakujących cenach.
- `INCOMPLETE`: brakuje co najmniej jednej ceny lub pewnej ilości; budżet niepotwierdzony.

Pozycje w pełni pokryte pewnym zapasem lodówki nie wymagają zakupu. Odhaczenia nie zmieniają kosztu całego planu. Brak wszystkich cen daje „brak zweryfikowanych cen”, nigdy komunikat o darmowym koszyku. Wycena wygasa po maksymalnie 15 minutach, wcześniej jeśli źródło przekroczy limit świeżości lub zmieni się dzień. Nie jest rezerwacją towaru. Nie obejmuje dojazdu i nie gwarantuje terminu przydatności kupionego produktu do końca jadłospisu.

## Weryfikacja przepływu

Ścieżka: zaakceptowany jadłospis → data i rabaty → API wyceny → zapisane oferty → porównanie kosztów i braków.

| Granica | Dowód |
|---|---|
| Formularz i wynik | Testy komponentu `MealPlanPricing`, w tym zmiana uprawnień, brak ceny, błąd i wygaśnięcie |
| Klient → kontrakt API | Testy Chromium telefonu PL i desktopu EN z kontrolowanym API |
| API → baza → odpowiedź | `MealPlanIntegrationTest`: publikacja, uprawnienia, oferta w koszyku, ilość opakowań, wycofanie, własność i wersja |
| Obliczenia | `MealPlanPricingServiceTest`: pełne opakowania, minimum, wielokrotności, limity, rabaty, daty, niepewność i brak cen |
| PostgreSQL | `DatabaseMigrationIT`: migracje i walidacja encji, w tym `meal_plan` oraz `store_offer` |
| Źródło | Parser próbki HTML Lidla i testy zachowania danych oraz odmowy przy zmianie formatu |

Testy przeglądarkowe i integracyjne obejmują odrębne warstwy; nie uruchomiono sesji przeglądarki przeciw produkcyjnemu backendowi, rzeczywistemu Gemini ani automatycznemu feedowi obu sieci.
