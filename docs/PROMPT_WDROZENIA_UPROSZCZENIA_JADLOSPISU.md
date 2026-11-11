# Prompt do modelu wdrażającego uproszczenie jadłospisu

Skopiuj poniższą treść do modelu pracującego w tym repozytorium:

```text
Wdróż uproszczenie zakładki Jadłospis w projekcie Dish Genie zgodnie z dokumentem:
docs/PLAN_UPROSZCZENIA_JADLOSPISU.md

Przeczytaj cały plan, obowiązujące instrukcje repozytorium i CONTEXT.md, następnie sprawdź aktualny kod oraz git status. Repozytorium może zawierać niezacommitowane zmiany użytkownika: zachowaj je i dopasuj wdrożenie do aktualnego stanu. Plan opisuje stan z 6 listopada 2026 r.; zweryfikuj różnice przed edycją.

Wykonaj implementację wszystkich czterech etapów. Nie zatrzymuj się na kolejnym planie ani samej propozycji wyglądu.

Cel: znacznie lżejszy ekran, szczególnie na telefonie. Dania mają być widoczne od razu, a codzienne czynności wymagać niewielu decyzji.

Najważniejsze wymagania:
1. Dwa widoki: Posiłki i Zakupy. Domyślnie cały tydzień jako lista dni.
2. Krótki nagłówek z zakresem dat i podsumowaniem; historia oraz Nowy plan dostępne z nagłówka/menu.
3. Posiłki bez paneli ofert i porównania cen nad nimi.
4. Kompaktowa karta: typ posiłku, nazwa, czas, porcje, Zamień i menu. Szczegóły przepisu oraz edycja w osobnym panelu. Puste miejsce jako „+ Dodaj danie”.
5. Krótki formularz startowy; reszta pod Dostosuj, z widocznym podsumowaniem sklepu i daty zakupów.
6. Jedna główna akcja zależna od stanu planu. Zachowaj świadomą akceptację i możliwość zakupów z częściowego planu.
7. Automatyczny wybór właściwego zapisanego planu przy zwykłym wejściu; jawny odnośnik do planu ma pierwszeństwo, a Nowy plan musi pozostać niezależną ścieżką.
8. Zakupy zaczynają się od checklisty; wycena krótka, oferty i porównania rozwijane. Niepełne ceny opisane bez otwierania szczegółów.
9. Jeden komunikat postępu generowania, krótsze teksty PL/EN i spokojniejszy wygląd spójny z aplikacją.

Szczegóły, zależności, reguły domenowe i kryteria odbioru są w planie i obowiązują w całości. Zachowaj istniejące API, jeśli pozwala zrealizować wymagania. Nie upraszczaj przez usunięcie działających funkcji ani zmianę znaczenia budżetu, kuponów, blokad dań, wycen lub checklisty.

Szczególnie pilnuj wersjonowania planu, konfliktów, idempotencji, działania generowania w tle oraz zachowania szkiców i odhaczeń. Wejście w widok Zakupy nie może samo akceptować planu. Uzupełnianie braków nie może zastępować gotowych dań.

Wprowadzaj zmiany etapami i komunikuj istotne ustalenia. Rutynowe decyzje implementacyjne podejmuj samodzielnie w granicach planu. Nie rozszerzaj zakresu o nowy kalendarz, integracje ani dodatkowe funkcje biznesowe.

Dostosuj istniejące testy zachowań, uruchom adekwatne testy, typecheck i lint. Sprawdź działający interfejs na telefonie i desktopie, w tym menu, fokus, długie nazwy, puste miejsca, częściowy plan, postęp i błędy. Nie uruchamiaj płatnego generowania ani operacji na rzeczywistych danych tylko dla demonstracji; do takich scenariuszy użyj istniejącego środowiska testowego i fixture'ów.

Na końcu podsumuj wykonane zmiany, wyniki weryfikacji oraz ewentualne konkretne ograniczenia. Nie deklaruj ukończenia etapów ani testów, których nie wykonano.
```
