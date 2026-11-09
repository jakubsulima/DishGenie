# Prompt do wdrożenia tygodniowego jadłospisu i zakupów

Poniższy prompt jest przeznaczony dla modelu pracującego w tym repozytorium. Dokument planu jest częścią polecenia i musi być dostępny w jego kontekście. Prompt zleca implementację całego procesu, a nie ponowne przygotowanie planu.

Skopiuj zawartość bloku:

```text
Wdróż w tym repozytorium cały proces tygodniowego jadłospisu i zakupów zgodnie z:
docs/PLAN_CYKLU_JADLOSPISU_I_ZAKUPOW.md

Katalog projektu: /Users/jakub/Desktop/recipeai/recipeAi

Przeczytaj plan w całości, obowiązujące instrukcje repozytorium, CONTEXT.md oraz odpowiednie fragmenty dokumentacji obecnego planera. Następnie sprawdź git status i bieżący kod. Repozytorium zawiera wcześniejsze niezacommitowane zmiany oraz nowe pliki: zachowaj je i buduj na nich. Nie wykonuj resetu ani czyszczenia katalogu. Nie traktuj historycznych raportów testów jako weryfikacji obecnego wdrożenia.

CEL

Użytkownik ma przejść przez proces:
ustalenie tygodnia → opcjonalne sprawdzenie zapasów → propozycja posiłków → jedna lista na wizytę w sklepie → potwierdzone zakupy → gotowanie → zmiany z wykorzystaniem dostępnych składników → następny tydzień.

Wykonaj wszystkie etapy 0–8 z planu. Nie zatrzymuj się na propozycji architektury, makiecie, zmianie etykiet, pierwszym przyroście ani samym frontendzie. Stosuj istniejące komponenty, operacje magazynowe, agregację, wersjonowanie i trwałe zadania wszędzie, gdzie odpowiadają wymaganiom. Nowe funkcje muszą mieć działające API, trwały zapis i sprawdzony przepływ w interfejsie.

NAJWAŻNIEJSZE DECYZJE

1. Formularz kończy się jedną świadomą akcją „Zaplanuj tydzień”, która zapisuje plan i rozpoczyna generowanie. Błąd drugiego kroku pozwala wznowić istniejący plan. Dwuklik, timeout i przeładowanie nie tworzą duplikatów i nie uruchamiają ponownie płatnego zadania.
2. Stałe preferencje są zapamiętane. Wyjątki tygodnia obejmują pominięte posiłki i limit czasu danego slotu. Nie kopiuj wyjątków datowanych ani potwierdzeń kuponów do następnego tygodnia. Korzystaj z istniejącego profilu diet i wykluczeń.
3. Przegląd lodówki jest krótki i opcjonalny. Zapasy oraz produkty do wykorzystania wpływają na propozycje. Nieznana ilość wymaga sprawdzenia; nie wolno traktować jej jak potwierdzonego pokrycia.
4. Domyślne planowanie jest praktyczne i działa bez cen. Obecne wymuszanie PROMOTIONS_FIRST w nowym przepływie trzeba zmienić również na backendzie. Świadomie wybrany tryb promocji zachowuje własne warunki i błędy. Brak ceny nie oznacza zera, a budżet pozostaje miękką preferencją.
5. Jedno gotowanie może zasilić dwa dni. Wprowadź partię gotowania i przydział porcji; nie kopiuj przepisu do dwóch slotów w sposób podwajający zapotrzebowanie. Powtórzenie przepisu i jedzenie porcji z wcześniejszego gotowania są różnymi operacjami.
6. „Przejdź do zakupów” otwiera gotową listę bez dodatkowego ekranu akceptacji. Zwykłe otwarcie zakładki lub odczyt GET nie wykonuje mutacji. Częściowy plan również może mieć zakupy.
7. W sklepie jest jedna lista konkretnej wizyty, obejmująca składniki planu i wybrane produkty dodatkowe. Zachowaj pochodzenie pozycji, możliwość ręcznej listy bez planu oraz historię wizyt. Zmiana przepisu nie usuwa ręcznego detergentu ani faktu kupienia produktu.
8. Odhaczenie produktu nie jest operacją dodania do lodówki. Potwierdzenie zakupów zapisuje rzeczywiste ilości i pozwala wybrać żywność do importu. Import musi wykonać się najwyżej raz, także po utracie odpowiedzi i przeładowaniu. Obsłuż częściowe powodzenie.
9. Dodanie kupionego produktu do lodówki nie może spowodować jego podwójnego uwzględnienia jako zapasu i osobnego zakupu. Historyczny zakup jest dowodem; aktualna ilość dostępna wynika ze stanu zapasów i późniejszego zużycia.
10. Widok „Dzisiaj” pokazuje dzisiejsze gotowania i gotowe porcje. Oznaczenie partii jako ugotowanej stosuje uzgodnione zużycie raz. Zjedzenie porcji jutro nie odejmuje surowych składników drugi raz.
11. Zamiana po zakupach preferuje dostępne składniki. Przed zatwierdzeniem pokazuje dodatkowe braki, ilości do sprawdzenia i produkty, które zostaną niewykorzystane. Nieaktualny podgląd nie może być zastosowany do zmienionego planu lub lodówki. Nie nadpisuj ugotowanych partii i zakończonych wizyt.
12. Domyślnie jeden sklep. Dwie sieci oznaczają porównanie dwóch wariantów, a podział na sklepy wymaga osobnego wyboru. Karta lojalnościowa nie jest potwierdzeniem konkretnego kuponu. Niepełna wycena pozostaje czytelna.

SPOSÓB PRACY

- Rozpocznij od krótkiego potwierdzenia zakresu i rozpoznania różnic między planem a kodem. Nie pytaj ponownie o rutynowe decyzje już określone w planie.
- W etapie 0 zapisz krótki ADR dotyczący modeli, wersjonowania dokumentu i kontraktu v4. Dodaj zgodność ze starszymi planami oraz ochronę przed utratą nowych pól przez stare ścieżki zapisu, workery i rewizje. Migracje mają być addytywne; dobierz wolne numery na podstawie repozytorium.
- Wykonuj przyrosty A: etapy 0–2, B: etapy 3–5, C: etapy 6–8. Każdy obejmuje logikę backendu, interfejs i adekwatną weryfikację. Ukończenie przyrostu nie kończy całego zadania.
- Status prac zapisuj w osobnym raporcie docs/WDROZENIE_CYKLU_JADLOSPISU_I_ZAKUPOW.md, z etapem, wykonanymi zmianami, testami i pozostałymi zadaniami. Nie zmieniaj treści wymagań tylko po to, aby istniejąca implementacja wyglądała na kompletną.
- Podejmuj samodzielnie rutynowe decyzje implementacyjne zgodne z planem. Jeśli kod wymaga innego rozwiązania technicznego, zapisz powód i zachowaj zachowanie oraz kryteria odbioru. Nie usuwaj istotnej funkcji jako „uproszczenia”.
- Nie dodawaj nowych frameworków ani osobnej usługi bez konkretnej potrzeby. Unikaj dublowania normalizacji jednostek, agregacji i operacji lodówki. Obliczenia ilości oraz kontrole właściciela i wersji muszą być egzekwowane przez serwer.
- Komunikuj istotne ustalenia i postęp. Jeśli pojawi się blokada środowiska, wykonaj niezależne prace i opisz dokładnie, czego nie dało się potwierdzić. Nie deklaruj sukcesu testów niewykonanych lub pominiętych.
- Zachowaj prywatność danych, CSRF, limity AI, idempotencję, obsługę konfliktów, szkiców i opóźnionych odpowiedzi. Identyfikator intencji ma przetrwać utratę odpowiedzi i przeładowanie; sam React ref nie wystarczy.
- Uzupełnij teksty PL/EN i CONTEXT.md w zakresie rzeczywiście wdrożonych zmian. Nowa reguła jednej wizyty z zachowanym pochodzeniem pozycji zastępuje historyczny wymóg dwóch niezależnych widoków zakupów. Nie przepisuj historycznych wyników wcześniejszych wdrożeń.

WERYFIKACJA

Wykorzystaj pełne kryteria etapów oraz macierz z planu. Szczególnie sprawdź referencyjny bilans:
200 g ryżu w domu → partia na dwa dni potrzebuje 600 g → brak 400 g → zakup opakowania 500 g → 700 g w lodówce → jednorazowe gotowanie zużywa 600 g → pozostaje 100 g → zjedzenie porcji następnego dnia nie zmienia surowego ryżu → nowy przyszły posiłek wymagający 150 g daje brak 50 g.

Przetestuj dwuklik, timeout po zapisie, retry po przeładowaniu, dwie karty, zmienione zapasy po podglądzie, częściowy import, stare plany, nieznane ilości, brak ofert, limit AI, zajęty slot przy przeniesieniu i odrzucenie obcych identyfikatorów.

Sprawdź deklarowane Node 24 i Java 17. Uruchom frontendowe typecheck, lint, build oraz odpowiednie Vitest/Playwright. Rozszerz testy backendu dla agregacji, partii, wizyt, rewizji, idempotencji i zgodności danych. Wykonaj test migracji na PostgreSQL oraz rzeczywisty lokalny przepływ frontend → API → testowa baza, rozwijając istniejący BrowserPlannerSmokeIT. Polecenia i wymagania środowiska są w planie. Testy H2 i atrapy API nie zastępują weryfikacji PostgreSQL ani pełnego przepływu.

Sprawdź interfejs na 360/390/1440 px, obsługę klawiatury i fokusu, długie nazwy, stany puste i błędy. Do testów używaj izolowanych danych i kontrolowanych odpowiedzi AI. Nie wykonuj testowego zużycia na rzeczywistych zapasach użytkownika. Nie uruchamiaj płatnego AI tylko dla demonstracji. Wykonaj git diff --check dla własnych zmian.

ZAKOŃCZENIE

Pracuj do ukończenia pełnego zakresu. Nie publikuj produkcyjnie i nie wykonuj zmian w produkcyjnej bazie w ramach tego polecenia.

Na końcu podaj:
- wykonane etapy i rezultat widoczny dla użytkownika;
- najważniejsze zmiany danych/API i zasady zgodności;
- faktyczne wyniki testów oraz scenariusza referencyjnego;
- pozostałe blokady i ograniczenia, jeśli istnieją;
- link do raportu wdrożenia.

Nie oznaczaj całego zadania jako ukończonego, jeżeli brakuje któregoś przepływu z etapów 0–8, trwałego zapisu, rozliczenia ilości lub istotnej weryfikacji. Odróżnij ukończony kod lokalny od niewykonanej publikacji.
```
