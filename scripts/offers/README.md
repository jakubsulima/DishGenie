# Import pełnej gazetki Lidla

## Integracja z aplikacją — 11 listopada 2026

Administrator może wyłączyć dostęp zwykłych użytkowników w panelu:
**Promocje z gazetek → Udostępniaj promocje użytkownikom**. Ustawienie jest
zapamiętywane w bazie; administratorzy zachowują dostęp do importera i promocji.
Backend blokuje też użycie zapisanych cen automatycznych przez zwykłe konta.
Podstawowy planer oraz prywatne ceny ręczne pozostają dostępne.

Przycisk **Lista zakupów → Pobierz promocje** uruchamia importer przez
`LidlLeafletImportService`. Odczytuje pełny PDF, porównuje jego SHA-256 i kotwice
cen z kompletnym przeglądem źródła i zapisuje sprawdzone oferty w katalogu
używanym przez wybór składników, propozycje dań i wycenę zakupów.
Ponowne pobranie aktualizuje stabilne identyfikatory bez dopisywania duplikatów.

Sprawdzone źródło: **gazetka 12.11.2026, 97 stron**. Rozstrzygnięto wszystkie
313 rekordów: 50 produktów do planera, 197 pominiętych (powtórzenia i pozycje
poza zakresem posiłków), 66 nieobsługiwanych z podanym powodem. Powstaje 85
wariantów cen, wliczając jawne ceny poza promocją. To przegląd wszystkich
znalezionych rekordów, nie gwarancja odczytu reklam procentowych i samych zdjęć.

Backend wykonuje `backendApi/src/main/resources/offers/import_lidl_leaflet.py`;
skrypt w tym katalogu jest jego punktem wejścia. Pełna kontrola i korekty pól są
w `backendApi/src/main/resources/offers/lidl-2026-11-12-review.json`. Surowy odczyt
pozostaje zachowany obok korekt. Zmieniony PDF wymaga nowego przeglądu; aplikacja
pokazuje ten stan i zachowuje wcześniejsze ważne ceny. Adres jest ustawieniem
źródła: obecnie nie ma samodzielnego wyszukiwania kolejnych wydań.

Konfiguracja backendu:

- `LIDL_PRICE_IMPORT_ENABLED=true` włącza pobieranie cen.
- `LIDL_LEAFLET_IMPORT_ENABLED=true` (domyślnie) wybiera gazetkę; `false` starszy adapter JSON.
- `LIDL_LEAFLET_PYTHON=/path/to/venv/bin/python` wskazuje Python z zależnościami
  z `backendApi/src/main/resources/offers/requirements.txt`.
- `LIDL_LEAFLET_URL` wskazuje oficjalny adres sprawdzonej gazetki; domyślnie 12.11.

Produkcyjny Dockerfile instaluje zależności i ustawia interpreter. Lokalnie bez
kontenera należy utworzyć venv i wskazać go zmienną powyżej. Klucze AI nie są
potrzebne. Import ma limit 90 sekund, limity rozmiarów i cache. Przycisk pokazuje
liczbę stron, produktów, powody pominięcia, czas i koszt płatnego API.
Na ARM64 Linux przypięto sprawdzoną wersję `cryptography` 46.0.7 po odtworzeniu
SIGILL w 50.0.2. Obraz wykonuje `import pdfplumber` już podczas budowania;
testy rzeczywistego przycisku przeszły również na tym obrazie jako użytkownik
bez uprawnień roota.

```bash
python scripts/offers/import_lidl_leaflet.py \
  --flyer-url 'https://www.lidl.pl/l/pl/gazetki/gazetka-12-11-czw-kw46/ar/0' \
  --output reports/lidl-leaflet-integrated-review --render-review \
  --publication-review backendApi/src/main/resources/offers/lidl-2026-11-12-review.json
```

Zestawy 1+1 używają dokładnej ceny dwóch sztuk (np. 4,99 zł), a nie dwukrotności
zaokrąglonej ceny efektywnej 2,49 zł. Limit trzech gratisów oznacza sześć sztuk
w zestawach. Aplikacja i potwierdzenie kuponu pozostają osobne. Daty ofert także
pozostają oddzielne, w tym mleko do 25.11. Brakujące masy i daty nie są wymyślane.

Test rzeczywistego przycisku na izolowanym backendzie:

```bash
cd frontend/recipeai
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 RECIPEAI_LEAFLET_BACKEND=1 \
  npx playwright test e2e/lidl-leaflet-backend.spec.ts --workers=1
```

Poniżej historyczny opis pierwotnego pilota i częściowej próby kontrolnej.

`import_lidl_leaflet.py` pobiera jedną oficjalną polską gazetkę i odczytuje
położenie tekstu, cen oraz kart produktów w całym PDF-ie. Nie korzysta z AI ani
OCR. Nie publikuje cen i nie łączy się z bazą aplikacji. To narzędzie pilotażowe,
nie produkcyjny importer kompletnego katalogu.

## Uruchomienie

Python 3.12+ w osobnym środowisku:

```bash
python3 -m venv /tmp/recipeai-leaflet-venv
/tmp/recipeai-leaflet-venv/bin/pip install -r scripts/offers/requirements-leaflet.txt
/tmp/recipeai-leaflet-venv/bin/python scripts/offers/import_lidl_leaflet.py \
  --flyer-url 'https://www.lidl.pl/l/pl/gazetki/gazetka-12-11-czw-kw46/ar/0?_ab=1' \
  --output reports/lidl-leaflet-pilot \
  --cache-dir reports/leaflet-cache \
  --render-review
```

Adres jest konkretną gazetką pilota z 12 listopada 2026, nie dynamicznym adresem
zawsze najnowszej gazetki. Odczyt źródła jest zapamiętywany na sześć godzin;
`--refresh` ponownie pobiera metadane i PDF. Wynik parsowania jest buforowany
według SHA-256 PDF-u, metadanych i kodu parsera. Zmiana parsera unieważnia cache.
Obrazy dowodowe są rozdzielone według identyfikatora treści PDF-u.

Przebieg offline na zachowanych plikach:

```bash
python scripts/offers/import_lidl_leaflet.py \
  --metadata /path/to/flyer.json --pdf /path/to/leaflet.pdf \
  --output reports/lidl-leaflet-pilot --render-review
```

Zapisane publiczne metadane mają postać odpowiedzi `flyer` z usługi oficjalnej
przeglądarki gazetek. PDF ma limit 60 MB i 200 stron. Niekompletna liczba stron
lub brak natywnych cen kończy przebieg błędem; skanowane gazetki wymagają osobnej
ścieżki OCR. Transport dopuszcza tylko znane oficjalne domeny i odrzuca przekierowania.

## Wyniki i sprawdzanie poprawności

- `offers.json`: kandydaci, współrzędne dowodów, tekst, ceny, ilości, daty,
  warunki, powody niepewności i pomiary czasu. Kategorie są heurystyczne.
- `review.html` + `pages/`: przeszukiwalny widok porównania z obrazem strony.
- `verified-offers.json`: powstaje tylko z `--audit`; zawiera wyłącznie odczyty
  zgodne z niezależnymi adnotacjami źródłowymi. Nadal nie jest formatem publikacji.

`STRUCTURE_OK_UNAUDITED` oznacza kompletność rozpoznanej struktury, a nie pewność
poprawności. `NEEDS_REVIEW` zachowuje problemy, w tym cenę efektywną przy gratisie,
różne okresy na stronie, nieznaną masę opakowania, regionalność i brak daty końca.
Masa 1 kg przy surowym mięsie jest podstawą ceny, nie wymyślonym opakowaniem 1 kg.
Jawna data końca nie jest zastępowana datą całej gazetki. Nieznana data pozostaje pusta.

Do odtworzenia audytu konkretnego PDF-u:

```bash
python scripts/offers/import_lidl_leaflet.py \
  --metadata /path/to/flyer.json --pdf /path/to/leaflet.pdf \
  --output reports/lidl-leaflet-pilot --render-review \
  --audit scripts/offers/fixtures/lidl-2026-11-12-audit.json
```

Adnotacje są związane z SHA-256 źródła. Obejmują 42 wybrane wystąpienia i
12 pól: nazwę, cenę, ilość, jednostkę, znaczenie ilości, obie daty, minimum,
wielokrotność, aplikację, kupon i limit. Sprawdzono je na renderowanych obrazach,
nie przez uznanie deklarowanej pewności parsera. Jest to próba dogodna do
kontroli i jeden trudny przypadek 1+1; nie losowa próba, pomiar recall ani
gwarancja poprawności pozostałych rekordów. Część stron wykorzystano również
podczas rozwijania parsera, więc nie jest to niezależny benchmark generalizacji.

W pilocie znaleziono 313 kandydatów; audyt potwierdził 41 wystąpień odpowiadających
37 różnym pozycjom według nazwy i ilości. Rodzina smaków/wariantów liczy się jako
jedna pozycja, nie jako kilka SKU. Jeden sprawdzony przypadek 1+1 pozostał błędnie
przypisany do sąsiedniej nazwy; ma flagi przeglądu i nie trafia do potwierdzonego
eksportu. Reszta nie jest uznana za zweryfikowaną.

## Koszt

Program zapisuje osobno czas odczytu, CPU, pamięć, transfer, żądania źródła,
renderowanie dowodów oraz trafienie w cache. Płatne wywołania modeli i ich koszt
wynoszą zero. Czas pracy programisty, ręcznej kontroli, hostingu i energii nie
jest wliczony w tę kwotę. Cache dokumentu nie oznacza jeszcze selektywnego OCR
zmienionych stron; OCR nie jest częścią tego pilota.

## Testy

```bash
python -m unittest discover -s scripts/offers -p 'test_*.py' -v
```

Testy logiki wykorzystują zredukowane pozycje słów z rzeczywistych stron 9, 37,
55 i 83 oraz niezależne adnotacje. Nie wymagają sieci ani płatnych kluczy.
