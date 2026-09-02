import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Locale = "en" | "pl";

const STORAGE_KEY = "dishGenie.locale";

const polishTranslations: Record<string, string> = {
  Home: "Strona główna",
  Recipes: "Przepisy",
  Fridge: "Lodówka",
  "Shopping List": "Lista zakupów",
  ShoppingList: "Lista zakupów",
  "My Profile": "Mój profil",
  Admin: "Administracja",
  Login: "Zaloguj się",
  Logout: "Wyloguj się",
  "Open menu": "Otwórz menu",
  "Close menu": "Zamknij menu",
  Privacy: "Prywatność",
  Terms: "Regulamin",
  Blog: "Blog",
  "Powered by Gemini AI": "Wspierane przez Gemini AI",
  "All rights reserved.": "Wszelkie prawa zastrzeżone.",
  "What should we cook next?": "Co dziś ugotujemy?",
  "What can I cook with these ingredients?":
    "Co mogę ugotować z tych składników?",
  "Start with ingredients, pick a mode, and get a practical dinner idea from what you already know.":
    "Zacznij od składników, wybierz tryb i otrzymaj praktyczny pomysł na obiad.",
  "Type what you have at home and Dish Genie gives you 3 realistic dinner ideas for tonight: best overall, fastest, and use-it-up.":
    "Wpisz, co masz w domu, a Dish Genie poda 3 realistyczne pomysły na dziś: najlepszy, najszybszy i wykorzystujący zapasy.",
  "Ingredients you have": "Składniki, które masz",
  "eggs, rice, spinach, chicken": "jajka, ryż, szpinak, kurczak",
  "Clear search": "Wyczyść wyszukiwanie",
  "Try eggs, rice, spinach, chicken, leftovers, or the ingredients you need to use before they go bad.":
    "Wpisz np. jajka, ryż, szpinak, kurczaka, resztki lub produkty, które trzeba szybko wykorzystać.",
  Mode: "Tryb",
  "Tired weeknight": "Męczący dzień",
  "Use leftovers": "Wykorzystaj resztki",
  "Healthy-ish": "W miarę zdrowo",
  "Cheap dinner": "Tani obiad",
  "Craving comfort": "Coś na poprawę humoru",
  Tradeoffs: "Priorytety",
  Time: "Czas",
  Quick: "Szybko",
  Relaxed: "Bez pośpiechu",
  Effort: "Wysiłek",
  "Low effort": "Mało pracy",
  Involved: "Bardziej wymagające",
  Mood: "Nastrój",
  Comfort: "Domowo",
  Fresh: "Lekko",
  "Pantry fit": "Dopasowanie do zapasów",
  "Use mine": "Użyj moich",
  "Can shop": "Mogę dokupić",
  "Flavor intensity": "Intensywność smaku",
  Mild: "Łagodnie",
  Spicy: "Pikantnie",
  Balanced: "Pośrodku",
  "Selected: {value}": "Wybrano: {value}",
  People: "Osoby",
  "Stackable needs": "Dodatkowe wymagania",
  "Use soon": "Zużyj szybko",
  Cheap: "Tanio",
  "Kid-friendly": "Dla dzieci",
  Meal: "Posiłek",
  Dinner: "Obiad",
  Lunch: "Lunch",
  Breakfast: "Śniadanie",
  Snack: "Przekąska",
  "Get my 3 dinner ideas": "Pokaż 3 pomysły na obiad",
  "Show me 3 ideas": "Pokaż 3 pomysły",
  "Generating...": "Generowanie…",
  "Tune details": "Dostosuj szczegóły",
  "Hide details": "Ukryj szczegóły",
  "Quick setup": "Szybki start",
  "Your home screen is now the cooking workflow.":
    "Strona główna prowadzi teraz przez cały proces gotowania.",
  "1. Add what you have in the input.": "1. Wpisz składniki, które masz.",
  "2. Pick a dinner mode or tune details.":
    "2. Wybierz tryb posiłku lub dostosuj szczegóły.",
  "3. Use fridge items and saved recipes below.":
    "3. Skorzystaj z lodówki i zapisanych przepisów poniżej.",
  "Got it": "Rozumiem",
  "Saved fridge": "Zapisana lodówka",
  "Recent dinners": "Ostatnie dania",
  "How it works": "Jak to działa",
  "Browse latest public recipes": "Przeglądaj najnowsze publiczne przepisy",
  "Ingredients ready to use": "Składniki gotowe do użycia",
  Manage: "Zarządzaj",
  "Add a few staples to make future dinner ideas more useful.":
    "Dodaj kilka podstawowych produktów, aby kolejne pomysły były trafniejsze.",
  "Add fridge items": "Dodaj produkty do lodówki",
  "Saved recipes": "Zapisane przepisy",
  "View all": "Zobacz wszystkie",
  "Practical AI recipes": "Praktyczne przepisy AI",
  "Not another weird AI recipe generator":
    "To nie kolejny generator dziwnych przepisów AI",
  "Dish Genie is designed for practical dinner decisions, not novelty recipes. It should be obvious why each suggestion belongs on your table tonight.":
    "Dish Genie pomaga podjąć praktyczną decyzję o posiłku, zamiast tworzyć przypadkowe receptury. Od razu wiesz, dlaczego dana propozycja pasuje na dziś.",
  "Each suggestion makes clear:": "Każda propozycja jasno pokazuje:",
  "which ingredients from your kitchen it uses":
    "które składniki z Twojej kuchni wykorzystuje",
  "what is missing before you start cooking":
    "czego brakuje przed rozpoczęciem gotowania",
  "whether dinner works without shopping": "czy obejdzie się bez zakupów",
  "why the option fits your time, effort, and mood":
    "dlaczego pasuje do Twojego czasu, energii i nastroju",
  "which idea is fastest, best overall, or best for using food up":
    "który pomysł jest najszybszy, najlepszy lub zużywa zapasy",
  "Food at home, no plan": "Jedzenie jest, planu brak",
  "What to cook when you have ingredients but no dinner idea":
    "Co ugotować, gdy masz składniki, ale brakuje pomysłu",
  "Instead of forcing you into one recipe, Dish Genie turns your ingredient list into a small decision set you can compare by time, missing items, and food that needs using.":
    "Zamiast narzucać jeden przepis, Dish Genie tworzy kilka opcji, które porównasz według czasu, brakujących produktów i zapasów do wykorzystania.",
  "Featured recipes": "Polecane przepisy",
  "Realistic ideas worth clicking": "Realistyczne pomysły warte sprawdzenia",
  "These examples use the same recipe shape Dish Genie creates: a practical title, cooking time, ingredients, nutrition, and clear steps.":
    "Te przykłady mają taki sam układ jak przepisy Dish Genie: praktyczną nazwę, czas, składniki, wartości odżywcze i jasne kroki.",
  "Common questions": "Najczęstsze pytania",
  "Cooking from what you already have": "Gotowanie z tego, co już masz",
  "Fewer choices, faster dinner": "Mniej wyborów, szybszy obiad",
  "Dish Genie is built for the kitchen moment before you order takeout.":
    "Dish Genie powstało na ten moment w kuchni, tuż zanim zamówisz jedzenie.",
  "How Dish Genie helps after you choose": "Jak Dish Genie pomaga po wyborze",
  "Get 3 realistic options": "Otrzymaj 3 realistyczne opcje",
  "Type what is in the kitchen and compare a small dinner set.":
    "Wpisz, co masz w kuchni, i porównaj kilka propozycji.",
  "Choose dinner, then act": "Wybierz danie i działaj",
  "Cook the best idea, save it, or add useful missing items.":
    "Ugotuj najlepszą propozycję, zapisz ją lub dodaj brakujące produkty.",
  "Add only optional extras": "Dodaj tylko opcjonalne produkty",
  "The shopping list starts from the recipe you chose, not a manual chore.":
    "Lista zakupów powstaje z wybranego przepisu — bez ręcznego przepisywania.",
  "Scan groceries fast": "Szybko skanuj zakupy",
  "Add products by barcode when you restock the fridge.":
    "Dodawaj produkty kodem kreskowym podczas uzupełniania lodówki.",
  "Use what is already there": "Wykorzystuj to, co już masz",
  "Fridge ingredients can make future ideas more practical.":
    "Składniki z lodówki sprawiają, że kolejne pomysły są bardziej praktyczne.",
  "Three options, not a feed": "Trzy opcje zamiast niekończącej się listy",
  "Compare the best overall dinner, the fastest option, and the best use-it-up idea.":
    "Porównaj najlepsze danie, najszybszą opcję i pomysł najlepiej wykorzystujący zapasy.",
  "Ingredients first": "Najpierw składniki",
  "Start with eggs, rice, spinach, chicken, or whatever is already in the kitchen.":
    "Zacznij od jajek, ryżu, szpinaku, kurczaka lub tego, co już masz w kuchni.",
  "Not weird AI recipes": "Bez dziwnych przepisów AI",
  "Each idea explains what it uses, what is missing, and why it makes sense.":
    "Każdy pomysł wyjaśnia, czego używa, czego brakuje i dlaczego ma sens.",
  "What can I cook with ingredients I already have?":
    "Co mogę ugotować ze składników, które już mam?",
  "Type the ingredients into Dish Genie to compare three realistic dinner ideas: best overall, fastest, and use-it-up.":
    "Wpisz składniki w Dish Genie, aby porównać trzy realistyczne pomysły: najlepszy, najszybszy i wykorzystujący zapasy.",
  "Can I find dinner ideas without shopping?":
    "Czy znajdę pomysł na obiad bez zakupów?",
  "Yes. Choose the no-shopping mode so suggestions prioritize ingredients you already have and show any missing items clearly.":
    "Tak. Wybierz tryb bez zakupów, aby propozycje korzystały przede wszystkim z tego, co masz, i jasno wskazywały braki.",
  "How does Dish Genie avoid weird AI recipes?":
    "Jak Dish Genie unika dziwnych przepisów AI?",
  "Dish Genie focuses on practical dinner decisions by showing what each idea uses, what is missing, and why that option makes sense.":
    "Dish Genie skupia się na praktycznych decyzjach: pokazuje, czego używa pomysł, czego brakuje i dlaczego dana opcja ma sens.",
  "Chicken, rice, and spinach skillet": "Patelnia z kurczakiem, ryżem i szpinakiem",
  "Balanced for flavor, effort, and pantry fit when you want the most reliable dinner.":
    "Najlepszy kompromis między smakiem, wysiłkiem i wykorzystaniem zapasów.",
  "Egg fried rice with spinach": "Smażony ryż z jajkiem i szpinakiem",
  "The shortest route from ingredients to food when time and cleanup matter most.":
    "Najkrótsza droga od składników do posiłku, gdy liczy się czas i mało sprzątania.",
  "Spinach chicken rice bowls": "Miska ryżu z kurczakiem i szpinakiem",
  "Prioritizes ingredients that should be used soon so less food gets wasted.":
    "Najpierw wykorzystuje produkty, które trzeba szybko zużyć, ograniczając marnowanie.",
  "what can I cook with eggs and rice": "co ugotować z jajek i ryżu",
  "dinner ideas with ingredients I have": "pomysły z produktów, które mam",
  "what can I cook without shopping": "co ugotować bez zakupów",
  "recipes from ingredients at home": "przepisy ze składników w domu",
  "Welcome back": "Witaj ponownie",
  "Your saved recipes, fridge, and dinner ideas are waiting.":
    "Czekają na Ciebie zapisane przepisy, lodówka i pomysły na posiłki.",
  Email: "E-mail",
  Password: "Hasło",
  "Sign in": "Zaloguj się",
  "Signing in...": "Logowanie…",
  "Forgot password?": "Nie pamiętasz hasła?",
  "Reset password": "Zresetuj hasło",
  "Enter your email and we will send a secure reset link.":
    "Podaj adres e-mail, a wyślemy bezpieczny link do zmiany hasła.",
  "If an eligible account exists, a password reset link has been sent.":
    "Jeśli istnieje odpowiednie konto, wysłaliśmy link do zmiany hasła.",
  "Could not request a password reset. Please try again.":
    "Nie udało się wysłać prośby. Spróbuj ponownie.",
  "Send reset link": "Wyślij link do zmiany hasła",
  "Sending...": "Wysyłanie…",
  "Back to sign in": "Wróć do logowania",
  "Choose a new password": "Ustaw nowe hasło",
  "New password": "Nowe hasło",
  "Save new password": "Zapisz nowe hasło",
  "This password reset link is invalid.": "Link do zmiany hasła jest nieprawidłowy.",
  "This password reset link is invalid or expired.":
    "Link do zmiany hasła jest nieprawidłowy lub wygasł.",
  "Use at least 8 characters with uppercase, lowercase, number, and special character.":
    "Użyj co najmniej 8 znaków, w tym wielkiej i małej litery, cyfry oraz znaku specjalnego.",
  "Passwords must match": "Hasła muszą być takie same",
  "Your password has been updated.": "Hasło zostało zmienione.",
  "New to Dish Genie?": "Nie masz jeszcze konta?",
  "Create one": "Załóż konto",
  "Create account": "Załóż konto",
  "Save recipes, build your fridge, and get better dinner ideas.":
    "Zapisuj przepisy, uzupełniaj lodówkę i otrzymuj lepsze pomysły na posiłki.",
  "Confirm password": "Powtórz hasło",
  "Confirm Password": "Powtórz hasło",
  "Create my account": "Załóż moje konto",
  "Creating account...": "Tworzenie konta…",
  "Already have an account?": "Masz już konto?",
  "Privacy Policy": "Politykę prywatności",
  or: "lub",
  "Continue with Google": "Kontynuuj z Google",
  "My Recipes": "Moje przepisy",
  "Latest Recipes": "Najnowsze przepisy",
  "Your personal recipe collection": "Twoja osobista kolekcja przepisów",
  "Discover 10 newest community recipes and unlock full features after login":
    "Poznaj 10 najnowszych przepisów społeczności i odblokuj wszystkie funkcje po zalogowaniu.",
  "Search recipes": "Szukaj przepisów",
  Search: "Szukaj",
  "Error searching recipes": "Nie udało się wyszukać przepisów",
  "Search recipes by name...": "Szukaj przepisów po nazwie…",
  "Error fetching recipes": "Nie udało się pobrać przepisów",
  "Try again": "Spróbuj ponownie",
  "No recipes found.": "Nie znaleziono przepisów.",
  "My Fridge": "Moja lodówka",
  "{count} item": "{count} produkt",
  "{count} items": "{count} produktów",
  "No ingredients in your inventory": "Brak składników w lodówce",
  "Add your first ingredient to start tracking what you have at home":
    "Dodaj pierwszy składnik, aby śledzić domowe zapasy",
  "Add to Fridge": "Dodaj do lodówki",
  "Hide the quick add form": "Ukryj formularz szybkiego dodawania",
  "Open the quick add form": "Otwórz formularz szybkiego dodawania",
  Hide: "Ukryj",
  Open: "Otwórz",
  "Item name": "Nazwa produktu",
  "e.g., Tomatoes": "np. pomidory",
  "Expiration date": "Data ważności",
  "(optional)": "(opcjonalnie)",
  Amount: "Ilość",
  "Please enter a valid positive number": "Wpisz prawidłową liczbę dodatnią",
  "Adding...": "Dodawanie…",
  "Add Item": "Dodaj produkt",
  "No amount": "Brak ilości",
  "Exp:": "Ważne do:",
  "Edit {name}": "Edytuj: {name}",
  "Remove {name}": "Usuń: {name}",
  "Edit item": "Edytuj produkt",
  "Remove item": "Usuń produkt",
  Name: "Nazwa",
  Optional: "Opcjonalnie",
  Expiration: "Data ważności",
  "Saving 0 will remove this item.": "Zapisanie wartości 0 usunie ten produkt.",
  "Name is required.": "Nazwa jest wymagana.",
  "Enter a valid positive amount.": "Wpisz prawidłową ilość dodatnią.",
  "Could not save changes. Try again.": "Nie udało się zapisać zmian. Spróbuj ponownie.",
  Saving: "Zapisywanie",
  Cancel: "Anuluj",
  "Unit (optional)": "Jednostka (opcjonalnie)",
  Unit: "Jednostka",
  Selected: "Wybrano",
  Previous: "Wstecz",
  "Show fewer options": "Pokaż mniej opcji",
  "Show {count} more options": "Pokaż jeszcze {count} opcji",
  None: "Brak",
  "Select...": "Wybierz…",
  Save: "Zapisz",
  "Expired ingredients detected": "Wykryto przeterminowane składniki",
  "Review these items before they affect your next recipe:":
    "Sprawdź te produkty przed przygotowaniem kolejnego przepisu:",
  Dismiss: "Zamknij",
  "Quick Add Options": "Szybkie dodawanie",
  "Choose how you want to add products to your fridge.":
    "Wybierz sposób dodawania produktów do lodówki.",
  "Use your camera": "Użyj aparatu",
  "Coming soon": "Wkrótce",
  "Use Expiring Soon": "Wykorzystaj produkty z krótką datą",
  "Generate zero-waste recipe": "Wygeneruj przepis bez marnowania",
  "Generating your recipe...": "Tworzenie przepisu…",
  "Mixing ingredients, matching flavors, and adding a spicy twist":
    "Łączymy składniki, dopasowujemy smaki i dopracowujemy przepis",
  "No recipe data available": "Brak danych przepisu",
  "Try generating a new recipe from the homepage.":
    "Spróbuj wygenerować nowy przepis na stronie głównej.",
  "Retry Generation": "Spróbuj ponownie",
  "Back to Home": "Wróć na stronę główną",
  "Dish Genie Recipe": "Przepis Dish Genie",
  Servings: "Porcje",
  "Base recipe: {count}": "Bazowo: {count}",
  "Decrease servings": "Zmniejsz liczbę porcji",
  "Increase servings": "Zwiększ liczbę porcji",
  "To check": "Do sprawdzenia",
  "Fridge coverage: {percent}%": "Pokrycie lodówki: {percent}%",
  "{count} ingredients": "Składniki: {count}",
  "{count} steps": "Kroki: {count}",
  "Choose One Of {count} Different Recipes":
    "Wybierz jeden z {count} różnych przepisów",
  "Generated in one request with intentionally different cuisine, technique, and core ingredients.":
    "Wygenerowane jednocześnie, ale celowo różnią się kuchnią, techniką i głównymi składnikami.",
  "Option {number}": "Opcja {number}",
  "Fastest option": "Najszybsza opcja",
  "Fewest ingredients": "Najmniej składników",
  "Most protein": "Najwięcej białka",
  "Lightest plate": "Najlżejsze danie",
  "Balanced pick": "Zrównoważony wybór",
  "Nutrition (estimated)": "Wartości odżywcze (szacunkowe)",
  Calories: "Kalorie",
  Protein: "Białko",
  Carbs: "Węglowodany",
  Fats: "Tłuszcze",
  Ingredients: "Składniki",
  Instructions: "Instrukcje",
  "Generating Shopping List": "Tworzenie listy zakupów",
  "Generate Shopping List": "Utwórz listę zakupów",
  "Log In to Generate Shopping List": "Zaloguj się, aby utworzyć listę zakupów",
  "Saving...": "Zapisywanie…",
  "Saved ✓": "Zapisano ✓",
  "Save Recipe": "Zapisz przepis",
  Private: "Prywatny",
  Public: "Publiczny",
  "Polish recipe": "Przepis po polsku",
  "English recipe": "Przepis po angielsku",
  "Publish Recipe": "Opublikuj przepis",
  "Unpublish Recipe": "Wycofaj publikację",
  "Confirm Publish": "Potwierdź publikację",
  "Confirming will make this recipe visible to everyone.":
    "Potwierdzenie sprawi, że ten przepis będzie widoczny dla wszystkich.",
  "Could not update recipe visibility. Please try again.":
    "Nie udało się zmienić widoczności przepisu. Spróbuj ponownie.",
  "You have": "Masz",
  "Missing": "Brakuje",
  "Why it fits": "Dlaczego pasuje",
  "Nothing from your fridge is needed": "Nie potrzeba niczego z Twojej lodówki",
  "Nothing — shopping is optional": "Nic — zakupy są opcjonalne",
  "Click Again to Confirm Delete": "Kliknij ponownie, aby potwierdzić usunięcie",
  "Delete Recipe": "Usuń przepis",
  "Recipe not found": "Nie znaleziono przepisu",
  "This featured Dish Genie recipe does not exist or has moved.":
    "Ten polecany przepis Dish Genie nie istnieje lub został przeniesiony.",
  "Back to home": "Wróć na stronę główną",
  "Make this fit your kitchen": "Dopasuj ten pomysł do swojej kuchni",
  "Dish Genie can create this kind of recipe from the ingredients, time, and effort level you actually have tonight.":
    "Dish Genie może stworzyć podobny przepis z uwzględnieniem składników, czasu i energii, które masz dziś wieczorem.",
  "Generate my own recipe": "Wygeneruj własny przepis",
  "Best overall": "Najlepszy wybór",
  Fastest: "Najszybszy",
  "No shopping": "Bez zakupów",
  Vegetarian: "Wegetariański",
  "Low cleanup": "Mało sprzątania",
  "Bold flavor": "Wyrazisty smak",
  "High protein": "Dużo białka",
  "Use-it-up": "Wykorzystaj zapasy",
  "Low waste": "Mniej marnowania",
  "Uses rice": "Z ryżem",
  "Miso Butter Chicken Rice Bowl": "Miska ryżu z kurczakiem w maśle miso",
  "A glossy weeknight rice bowl with juicy chicken, spinach, and a salty-sweet miso butter sauce that tastes like more work than it is.":
    "Szybka miska ryżu z soczystym kurczakiem, szpinakiem i słono-słodkim sosem z masła miso, która smakuje jak danie wymagające znacznie więcej pracy.",
  "Crispy Chickpea Lemon Orzo": "Cytrynowe orzo z chrupiącą ciecierzycą",
  "A fast pantry dinner with crispy chickpeas, lemony orzo, herbs, and yogurt sauce for a fresh bowl without a grocery run.":
    "Szybki obiad z zapasów: chrupiąca ciecierzyca, cytrynowe orzo, zioła i sos jogurtowy — bez wyprawy do sklepu.",
  "Gochujang Turkey Lettuce Cups": "Sałatowe łódeczki z indykiem gochujang",
  "A bold low-cleanup dinner with sticky turkey, crunchy lettuce, rice, and quick pickled carrots.":
    "Wyrazisty obiad z małą ilością sprzątania: kleisty indyk, chrupiąca sałata, ryż i szybko marynowana marchew.",
  "Roasted Vegetable Pesto Frittata": "Frittata z pieczonymi warzywami i pesto",
  "A flexible use-it-up dinner for leftover vegetables, eggs, and a spoon of pesto, finished with crisp edges and a creamy center.":
    "Elastyczny obiad wykorzystujący resztki warzyw, jajka i łyżkę pesto, z chrupiącymi brzegami i kremowym środkiem.",
  "chicken thighs": "udka z kurczaka",
  "cooked rice": "ugotowany ryż",
  spinach: "szpinak",
  "white miso": "jasne miso",
  butter: "masło",
  "soy sauce": "sos sojowy",
  "rice vinegar": "ocet ryżowy",
  garlic: "czosnek",
  "spring onion": "dymka",
  "sesame seeds": "sezam",
  orzo: "orzo",
  "canned chickpeas": "ciecierzyca z puszki",
  "Greek yogurt": "jogurt grecki",
  lemon: "cytryna",
  cucumber: "ogórek",
  parsley: "pietruszka",
  "olive oil": "oliwa",
  "smoked paprika": "wędzona papryka",
  feta: "feta",
  "minced turkey": "mielony indyk",
  "lettuce leaves": "liście sałaty",
  carrot: "marchew",
  gochujang: "gochujang",
  honey: "miód",
  ginger: "imbir",
  "sesame oil": "olej sezamowy",
  eggs: "jajka",
  "mixed vegetables": "mieszane warzywa",
  pesto: "pesto",
  milk: "mleko",
  mozzarella: "mozzarella",
  onion: "cebula",
  "cherry tomatoes": "pomidorki koktajlowe",
  basil: "bazylia",
  "Pat chicken dry, slice into bite-size pieces, and season lightly with salt.":
    "Osusz kurczaka, pokrój na kawałki wielkości kęsa i lekko posól.",
  "Whisk miso, soy sauce, rice vinegar, and 30 ml warm water until smooth.":
    "Wymieszaj miso, sos sojowy, ocet ryżowy i 30 ml ciepłej wody na gładki sos.",
  "Sear chicken in a hot pan for 5-6 minutes until browned and cooked through.":
    "Smaż kurczaka na gorącej patelni 5–6 minut, aż się zrumieni i będzie gotowy w środku.",
  "Lower the heat, add garlic and butter, and stir for 30 seconds until fragrant.":
    "Zmniejsz ogień, dodaj czosnek i masło, a następnie mieszaj przez 30 sekund.",
  "Pour in the miso sauce and simmer for 1-2 minutes until glossy enough to coat the chicken.":
    "Wlej sos miso i gotuj 1–2 minuty, aż zgęstnieje i oblepi kurczaka.",
  "Fold in spinach until just wilted, keeping the leaves bright green.":
    "Dodaj szpinak i mieszaj tylko do zwiędnięcia, aby zachował intensywny kolor.",
  "Warm the rice, spoon chicken and sauce over the top, then finish with spring onion and sesame.":
    "Podgrzej ryż, wyłóż na niego kurczaka z sosem i posyp dymką oraz sezamem.",
  "Boil orzo in salted water until tender, then reserve 80 ml pasta water before draining.":
    "Ugotuj orzo w osolonej wodzie, zachowując przed odcedzeniem 80 ml wody z gotowania.",
  "Dry chickpeas well and fry them in olive oil for 6-8 minutes until crisp at the edges.":
    "Dokładnie osusz ciecierzycę i smaż ją na oliwie 6–8 minut, aż brzegi będą chrupiące.",
  "Season chickpeas with smoked paprika, salt, and black pepper while still hot.":
    "Gorącą ciecierzycę dopraw wędzoną papryką, solą i czarnym pieprzem.",
  "Mix yogurt with grated garlic, lemon zest, lemon juice, and a pinch of salt.":
    "Wymieszaj jogurt ze startym czosnkiem, skórką i sokiem z cytryny oraz szczyptą soli.",
  "Toss warm orzo with olive oil, a splash of pasta water, parsley, and crumbled feta.":
    "Wymieszaj ciepłe orzo z oliwą, odrobiną wody z gotowania, pietruszką i pokruszoną fetą.",
  "Fold in diced cucumber just before serving so it stays crunchy.":
    "Tuż przed podaniem dodaj pokrojonego ogórka, aby pozostał chrupiący.",
  "Top with crispy chickpeas and yogurt sauce, then add extra lemon if the bowl tastes flat.":
    "Dodaj chrupiącą ciecierzycę i sos jogurtowy; w razie potrzeby dopraw cytryną.",
  "Toss shredded carrot with rice vinegar, a pinch of salt, and honey; set aside to soften.":
    "Wymieszaj startą marchew z octem ryżowym, szczyptą soli i miodem; odstaw do zmięknięcia.",
  "Whisk gochujang, soy sauce, ginger, sesame oil, and 20 ml water into a smooth sauce.":
    "Wymieszaj gochujang, sos sojowy, imbir, olej sezamowy i 20 ml wody na gładki sos.",
  "Brown turkey in a wide pan over medium-high heat for 6-7 minutes, breaking it into small crumbles.":
    "Smaż indyka na szerokiej patelni 6–7 minut, rozdrabniając go na małe kawałki.",
  "Add the sauce and simmer for 2-3 minutes until sticky and deeply red.":
    "Dodaj sos i gotuj 2–3 minuty, aż stanie się kleisty i ciemnoczerwony.",
  "Warm rice and separate lettuce leaves, choosing the cupped leaves for serving.":
    "Podgrzej ryż i oddziel liście sałaty, wybierając te o kształcie łódeczek.",
  "Fill each lettuce leaf with rice, turkey, and quick pickled carrot.":
    "Napełnij liście sałaty ryżem, indykiem i szybko marynowaną marchewką.",
  "Spoon over any pan sauce and serve immediately while the lettuce is crisp.":
    "Polej sosem z patelni i podawaj od razu, gdy sałata jest jeszcze chrupiąca.",
  "Heat the oven to 220C and roast chopped vegetables with olive oil and salt for 14-16 minutes.":
    "Rozgrzej piekarnik do 220°C i piecz pokrojone warzywa z oliwą oraz solą przez 14–16 minut.",
  "Whisk eggs, milk, pesto, black pepper, and a small pinch of salt until evenly green.":
    "Wymieszaj jajka, mleko, pesto, czarny pieprz i odrobinę soli na jednolitą masę.",
  "Soften sliced onion in an oven-safe pan for 4 minutes over medium heat.":
    "Zmiękczaj pokrojoną cebulę przez 4 minuty na patelni nadającej się do piekarnika.",
  "Add roasted vegetables and tomatoes to the pan, spreading them into an even layer.":
    "Dodaj pieczone warzywa i pomidory, rozkładając je równą warstwą.",
  "Pour in the egg mixture and cook undisturbed for 3 minutes until the edges begin to set.":
    "Wlej masę jajeczną i smaż bez mieszania przez 3 minuty, aż brzegi zaczną się ścinać.",
  "Scatter mozzarella on top and bake at 190C for 9-11 minutes until just set in the center.":
    "Posyp mozzarellą i piecz w 190°C przez 9–11 minut, aż środek ledwo się zetnie.",
  "Rest for 5 minutes, then finish with basil and a squeeze of lemon.":
    "Odstaw na 5 minut, a następnie dodaj bazylię i skrop sokiem z cytryny.",
  "Shopping list": "Lista zakupów",
  "Keep your next recipe run organized and check items as you shop.":
    "Uporządkuj zakupy do kolejnego przepisu i odznaczaj produkty w sklepie.",
  "{count} left": "Pozostało: {count}",
  "{count} completed": "Ukończono: {count}",
  "Syncing...": "Synchronizacja…",
  Synced: "Zsynchronizowano",
  "Add item manually": "Dodaj produkt ręcznie",
  "e.g. Tomatoes": "np. pomidory",
  Add: "Dodaj",
  "Your shopping list is empty.": "Lista zakupów jest pusta.",
  "Add items above or generate a list from a recipe.":
    "Dodaj produkty powyżej lub utwórz listę na podstawie przepisu.",
  "Check all items": "Zaznacz wszystkie produkty",
  "Check all": "Zaznacz wszystko",
  "Clear Checked": "Usuń zaznaczone",
  Remove: "Usuń",
  "Dietary Plan": "Sposób odżywiania",
  "One place to tune your diet and ingredient dislikes.":
    "Jedno miejsce do ustawienia diety i nielubianych składników.",
  "Plan:": "Plan:",
  "Diet:": "Dieta:",
  "Requests:": "Zapytania:",
  "{count} disliked ingredient": "{count} nielubiany składnik",
  "{count} disliked ingredients": "Nielubiane składniki: {count}",
  "Generation Request Limit": "Limit generowania",
  "Your account plan controls how many recipe generation requests you can make per day.":
    "Plan konta określa liczbę przepisów, które możesz wygenerować w ciągu dnia.",
  "Current plan": "Aktualny plan",
  "Generation request limit": "Dzienny limit generowania",
  Unlimited: "Bez limitu",
  "Remaining today": "Pozostało na dziś",
  "You reached your daily request limit. Try again tomorrow or upgrade your plan.":
    "Osiągnięto dzienny limit. Spróbuj jutro lub zmień plan.",
  "Disliked Ingredients": "Nielubiane składniki",
  "Keep this list short and specific for better recipe matches.":
    "Krótka i konkretna lista zapewnia trafniejsze przepisy.",
  "Disliked ingredient": "Nielubiany składnik",
  "e.g., Olives": "np. oliwki",
  "No disliked ingredients added.": "Nie dodano nielubianych składników.",
  "Loading...": "Ładowanie…",
  "Combine styles and restrictions. Your choices sync instantly.":
    "Łącz style i ograniczenia. Zmiany synchronizują się automatycznie.",
  "Dietary plan options": "Opcje sposobu odżywiania",
  "Saving diet preferences...": "Zapisywanie preferencji żywieniowych…",
  "Diet styles": "Style odżywiania",
  "General eating patterns and preferred food styles.":
    "Ogólne sposoby odżywiania i preferowane style kuchni.",
  Restrictions: "Ograniczenia",
  "Foods your body cannot tolerate or you want to avoid.":
    "Produkty, których organizm nie toleruje lub których chcesz unikać.",
  "Nutrition goals": "Cele żywieniowe",
  "Macro-focused preferences for training or satiety.":
    "Preferencje dotyczące makroskładników, treningu i sytości.",
  "No specific diet": "Bez określonej diety",
  "Balanced recipe mix with no diet restrictions.":
    "Zróżnicowane przepisy bez ograniczeń dietetycznych.",
  "No meat or fish. Includes eggs and dairy.":
    "Bez mięsa i ryb. Dopuszcza jajka i nabiał.",
  Vegan: "Wegańska",
  "Plant-based only. No meat, fish, dairy, eggs, or honey.":
    "Wyłącznie roślinna. Bez mięsa, ryb, nabiału, jajek i miodu.",
  "Gluten-free": "Bezglutenowa",
  "Excludes wheat, barley, and rye ingredients.":
    "Wyklucza pszenicę, jęczmień i żyto.",
  "Dairy-free": "Bez nabiału",
  "No milk, cheese, butter, cream, or yogurt.":
    "Bez mleka, sera, masła, śmietany i jogurtu.",
  Keto: "Keto",
  "Very low carb and high fat meals.": "Bardzo mało węglowodanów i dużo tłuszczu.",
  Paleo: "Paleo",
  "Whole-food focus with no grains, legumes, or dairy.":
    "Naturalne produkty, bez zbóż, roślin strączkowych i nabiału.",
  Mediterranean: "Śródziemnomorska",
  "Vegetables, legumes, whole grains, fish, and olive oil.":
    "Warzywa, strączki, pełne ziarna, ryby i oliwa.",
  "Low carb": "Niskowęglowodanowa",
  "Reduced carbohydrates with higher protein and fats.":
    "Mniej węglowodanów, więcej białka i tłuszczów.",
  "Protein-forward meals to support satiety and recovery.":
    "Posiłki bogate w białko wspierające sytość i regenerację.",
  Other: "Inna",
  "Custom or mixed dietary approach.": "Własny lub mieszany sposób odżywiania.",
  "Not set": "Nie ustawiono",
  "{count} requests today • unlimited": "Dziś: {count} • bez limitu",
  "{used}/{limit} requests today": "Dziś: {used}/{limit}",
  "Account created successfully.": "Konto zostało utworzone.",
  "Choose your diet and disliked ingredients now to get better recipe suggestions from the start.":
    "Ustaw dietę i nielubiane składniki, aby od początku otrzymywać trafniejsze propozycje.",
  "Ingredient added": "Dodano składnik",
  "Ingredient removed": "Usunięto składnik",
  "Enter an ingredient to add.": "Wpisz składnik do dodania.",
  "This ingredient is already in your disliked list.":
    "Ten składnik jest już na liście nielubianych.",
  "Application error": "Błąd aplikacji",
  "We hit an unexpected issue. Please refresh and try again.":
    "Wystąpił nieoczekiwany problem. Odśwież stronę i spróbuj ponownie.",
  "Page not found": "Nie znaleziono strony",
  "Something went wrong": "Coś poszło nie tak",
  "An unexpected error occurred. Please try again.":
    "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
  "The page you requested does not exist.": "Żądana strona nie istnieje.",
  "Previous page": "Poprzednia strona",
  "Next page": "Następna strona",
  Prev: "Wstecz",
  Next: "Dalej",
  "Page {current} of {total}": "Strona {current} z {total}",
  "Analytics settings": "Ustawienia analityki",
  "Dish Genie uses PostHog analytics through a first-party proxy domain to measure product usage and improve key flows. Analytics stays off until you opt in.":
    "Dish Genie używa analityki PostHog przez własną domenę proxy, aby mierzyć korzystanie z produktu i ulepszać najważniejsze ścieżki. Analityka pozostaje wyłączona do czasu wyrażenia zgody.",
  Close: "Zamknij",
  "Reject analytics": "Odrzuć analitykę",
  "Accept analytics": "Akceptuj analitykę",
  "Analytics: on": "Analityka: włączona",
  "Analytics: off": "Analityka: wyłączona",
  "Privacy settings": "Ustawienia prywatności",
  "Scan Barcode": "Skanuj kod kreskowy",
  "Place the barcode inside the frame for fast detection.":
    "Umieść kod kreskowy w ramce, aby szybko go odczytać.",
  "Supports EAN and UPC formats": "Obsługuje formaty EAN i UPC",
  "Starting camera...": "Uruchamianie aparatu…",
  "Enter barcode manually": "Wpisz kod kreskowy ręcznie",
  "Use Code": "Użyj kodu",
  "Your browser does not support camera access.":
    "Twoja przeglądarka nie obsługuje dostępu do aparatu.",
  "Camera access was blocked. Allow camera permission and try again.":
    "Dostęp do aparatu został zablokowany. Zezwól na dostęp i spróbuj ponownie.",
  "No camera was found on this device.": "Nie znaleziono aparatu na tym urządzeniu.",
  "Camera is already in use by another app. Close it and retry.":
    "Aparat jest używany przez inną aplikację. Zamknij ją i spróbuj ponownie.",
  "Could not start camera scanner. Please allow camera access or enter barcode manually.":
    "Nie udało się uruchomić skanera. Zezwól na dostęp do aparatu lub wpisz kod ręcznie.",
  "Scanner is active but cannot read this barcode yet. Try better lighting or enter the code manually.":
    "Skaner działa, ale nie może odczytać kodu. Popraw oświetlenie lub wpisz kod ręcznie.",
  "Scan Receipt": "Skanuj paragon",
  "Upload a photo and review detected ingredients before adding.":
    "Prześlij zdjęcie i sprawdź wykryte składniki przed dodaniem.",
  "Upload receipt image": "Prześlij zdjęcie paragonu",
  "Scanning...": "Skanowanie…",
  "Selected file: {name}": "Wybrany plik: {name}",
  "Detected ingredients ({count})": "Wykryte składniki ({count})",
  optional: "opcjonalnie",
  none: "brak",
  pcs: "szt.",
  "Add Selected To Inventory": "Dodaj wybrane do lodówki",
  "Select a receipt image first.": "Najpierw wybierz zdjęcie paragonu.",
  "No food ingredients were detected on this receipt. Try another photo with better lighting.":
    "Na paragonie nie wykryto produktów spożywczych. Spróbuj zrobić wyraźniejsze zdjęcie.",
  "Failed to scan receipt image.": "Nie udało się zeskanować zdjęcia paragonu.",
  'Invalid amount for "{name}". Use a positive number.':
    'Nieprawidłowa ilość dla „{name}”. Wpisz liczbę dodatnią.',
  "Select at least one valid item to add.":
    "Wybierz co najmniej jeden prawidłowy produkt.",
  "Could not add scanned items.": "Nie udało się dodać zeskanowanych produktów.",
  "Failed to load recipe. Please try again.":
    "Nie udało się wczytać przepisu. Spróbuj ponownie.",
  "Something went wrong while generating the recipe. Please try again.":
    "Wystąpił błąd podczas generowania przepisu. Spróbuj ponownie.",
  "No search term or recipe ID provided":
    "Nie podano zapytania ani identyfikatora przepisu",
  "Recipe data is incomplete and cannot be saved.":
    "Dane przepisu są niepełne i nie można ich zapisać.",
  "You must be logged in to save a recipe.":
    "Musisz się zalogować, aby zapisać przepis.",
  "This recipe is already saved in your collection.":
    "Ten przepis jest już zapisany w Twojej kolekcji.",
  "You reached your current recipe limit. Remove one saved recipe or switch to a paid plan.":
    "Osiągnięto limit zapisanych przepisów. Usuń jeden przepis lub przejdź na płatny plan.",
  "Failed to save recipe. Please try again.":
    "Nie udało się zapisać przepisu. Spróbuj ponownie.",
  "No ingredients available to generate shopping list.":
    "Brak składników potrzebnych do utworzenia listy zakupów.",
  "Failed to generate shopping list. Please try again.":
    "Nie udało się utworzyć listy zakupów. Spróbuj ponownie.",
  "Failed to delete recipe.": "Nie udało się usunąć przepisu.",
  Show: "Pokaż",
  "Dish Genie screen showing three generated recipe options":
    "Ekran Dish Genie z trzema wygenerowanymi przepisami",
  "Dish Genie recipe screen with shopping list and save recipe buttons":
    "Ekran przepisu Dish Genie z listą zakupów i przyciskiem zapisu",
  "Dish Genie shopping list screen with ingredients to check off":
    "Lista zakupów Dish Genie ze składnikami do odznaczenia",
  "Dish Genie barcode scanning screen recording":
    "Nagranie ekranu skanowania kodu kreskowego w Dish Genie",
  "Dish Genie fridge screen with quick add options and saved ingredients":
    "Ekran lodówki Dish Genie z szybkim dodawaniem i zapisanymi składnikami",
  "Saved dinners will show here after you keep a recipe.":
    "Zapisane dania pojawią się tutaj po zachowaniu przepisu.",
  "Practical cooking ideas for busy kitchens":
    "Praktyczne pomysły kulinarne dla zabieganych",
  "Short guides on recipe generation, fridge organization, meal planning, and turning the food you already have into realistic meals.":
    "Krótkie poradniki o generowaniu przepisów, organizacji lodówki, planowaniu i zamienianiu domowych zapasów w realistyczne posiłki.",
  "Blog post not found": "Nie znaleziono wpisu",
  "The article you opened does not exist or has moved.":
    "Otwarty artykuł nie istnieje lub został przeniesiony.",
  "Back to blog": "Wróć do bloga",
  "Turn your ingredients into dinner": "Zamień składniki w posiłek",
  "Dish Genie can turn a craving, a few fridge items, or a no-shopping constraint into three realistic recipe ideas.":
    "Dish Genie zamieni ochotę, kilka produktów z lodówki lub brak możliwości zakupów w trzy realistyczne pomysły.",
  "Get recipe ideas": "Znajdź pomysły na przepisy",
  "Browse recipes": "Przeglądaj przepisy",
  "Access denied. You must be an admin to view this page.":
    "Brak dostępu. Tę stronę może otworzyć tylko administrator.",
  "Admin Dashboard": "Panel administratora",
  "Manage users, permissions, plans, and recipes.":
    "Zarządzaj użytkownikami, uprawnieniami, planami i przepisami.",
  "Signed in as": "Zalogowano jako",
  "Total users": "Wszyscy użytkownicy",
  "Visible admins": "Widoczni administratorzy",
  "Visible paid plans": "Widoczne plany płatne",
  "Visible free plans": "Widoczne plany bezpłatne",
  "Users & Permissions": "Użytkownicy i uprawnienia",
  "Roles are enforced by the backend. The API blocks deleting or demoting the final admin.":
    "Role są egzekwowane przez backend. API blokuje usunięcie lub degradację ostatniego administratora.",
  Refresh: "Odśwież",
  "No users found.": "Nie znaleziono użytkowników.",
  Role: "Rola",
  Plan: "Plan",
  Permissions: "Uprawnienia",
  Actions: "Działania",
  "Use another admin account to change your own role":
    "Użyj innego konta administratora, aby zmienić własną rolę",
  "Change user role": "Zmień rolę użytkownika",
  Delete: "Usuń",
  "Delete {email}? Their account and owned data will be removed.":
    "Usunąć konto {email}? Konto i należące do niego dane zostaną usunięte.",
  "Remove admin permissions from {email}?":
    "Odebrać uprawnienia administratora użytkownikowi {email}?",
  "Create and manage own recipes": "Tworzenie i zarządzanie własnymi przepisami",
  "Generate recipes within plan limits": "Generowanie przepisów w limitach planu",
  "Manage own preferences": "Zarządzanie własnymi preferencjami",
  "All user permissions": "Wszystkie uprawnienia użytkownika",
  "Manage users, roles, and plans": "Zarządzanie użytkownikami, rolami i planami",
  "View, edit, and delete recipes": "Wyświetlanie, edycja i usuwanie przepisów",
  "Bypass daily recipe generation limits": "Pomijanie dziennych limitów generowania",
  "Unable to load users": "Nie udało się wczytać użytkowników",
  "An unknown error occurred while deleting user":
    "Wystąpił nieznany błąd podczas usuwania użytkownika",
  "An unknown error occurred while updating the user plan":
    "Wystąpił nieznany błąd podczas zmiany planu użytkownika",
  "An unknown error occurred while updating the user role":
    "Wystąpił nieznany błąd podczas zmiany roli użytkownika",
  "Recipe Management": "Zarządzanie przepisami",
  "Search, inspect, edit, or remove recipes. Fridge and shopping list data stay outside this admin view.":
    "Wyszukuj, przeglądaj, edytuj i usuwaj przepisy. Dane lodówki i list zakupów nie są tu wyświetlane.",
  "{count} recipes in this view": "Przepisy w tym widoku: {count}",
  "Search recipes by name or ingredient": "Szukaj po nazwie lub składniku",
  Clear: "Wyczyść",
  "Showing recipes for {email}": "Przepisy użytkownika {email}",
  "Show all": "Pokaż wszystkie",
  Title: "Tytuł",
  Contents: "Zawartość",
  "Open details": "Otwórz szczegóły",
  View: "Wyświetl",
  Edit: "Edytuj",
  "No time set": "Brak czasu przygotowania",
  "Edit Recipe": "Edytuj przepis",
  "Time to prepare": "Czas przygotowania",
  Description: "Opis",
  'Delete recipe "{name}"?': 'Usunąć przepis „{name}”?',
  "Recipe name is required.": "Nazwa przepisu jest wymagana.",
  "At least one ingredient is required.": "Wymagany jest co najmniej jeden składnik.",
  "An unknown error occurred while fetching recipes":
    "Wystąpił nieznany błąd podczas pobierania przepisów",
  "An unknown error occurred while loading recipe details":
    "Wystąpił nieznany błąd podczas wczytywania szczegółów przepisu",
  "An unknown error occurred while deleting recipe":
    "Wystąpił nieznany błąd podczas usuwania przepisu",
  "An unknown error occurred while updating recipe":
    "Wystąpił nieznany błąd podczas aktualizacji przepisu",
  "Email is required": "Adres e-mail jest wymagany",
  "Password is required": "Hasło jest wymagane",
  "Invalid email format": "Nieprawidłowy format adresu e-mail",
  "Password must be at least 8 characters": "Hasło musi mieć co najmniej 8 znaków",
  "Must contain at least one number": "Hasło musi zawierać co najmniej jedną cyfrę",
  "Must contain at least one lowercase letter": "Hasło musi zawierać małą literę",
  "Must contain at least one uppercase letter": "Hasło musi zawierać wielką literę",
  "Must contain at least one special character": "Hasło musi zawierać znak specjalny",
  "Confirm Password is required": "Powtórzenie hasła jest wymagane",
  "Google sign-in failed. Please try again.": "Logowanie przez Google nie powiodło się. Spróbuj ponownie.",
  "Google sign-up failed. Please try again.": "Rejestracja przez Google nie powiodła się. Spróbuj ponownie.",
  "Login failed": "Logowanie nie powiodło się",
  "Registration failed": "Rejestracja nie powiodła się",
  'Searching for: "{term}"': 'Wyniki dla: „{term}”',
  "You are browsing as a guest. Create an account to generate AI recipes, save favorites, and unlock your Virtual Fridge.":
    "Przeglądasz jako gość. Załóż konto, aby generować przepisy AI, zapisywać ulubione i korzystać z wirtualnej lodówki.",
  "Log In": "Zaloguj się",
  "Sign Up Free": "Załóż darmowe konto",
  'No recipes found for "{term}"': 'Nie znaleziono przepisów dla „{term}”',
  "No public recipes available yet.": "Nie ma jeszcze publicznych przepisów.",
  "Try searching with different keywords": "Spróbuj użyć innych słów kluczowych",
  "Sign in to generate your own recipes and start saving favorites.":
    "Zaloguj się, aby generować własne przepisy i zapisywać ulubione.",
  "Start creating your first recipe!": "Utwórz swój pierwszy przepis!",
  "Clear Search": "Wyczyść wyszukiwanie",
  piece: "szt.",
  pieces: "szt.",
  clove: "ząbek",
  cloves: "ząbki",
  "Please wait a moment": "Poczekaj chwilę",
  "Marinating ideas": "Doprawiamy pomysły",
  "Balancing flavors": "Równoważymy smaki",
  "Plating the result": "Układamy danie",
  "Failed to add disliked ingredient": "Nie udało się dodać niechcianego składnika",
  "Failed to remove disliked ingredient": "Nie udało się usunąć niechcianego składnika",
  "Real app screens, shown as a simple flow: choose, cook, shop, scan, then reuse what is already in the fridge.":
    "Prawdziwe ekrany aplikacji pokazują prosty proces: wybierz, ugotuj, zrób zakupy, zeskanuj i ponownie wykorzystaj zapasy.",
  "Dish Genie app icon with a chef hat, steam, and a cooking pot":
    "Ikona Dish Genie z czapką kucharską, parą i garnkiem",
  "Your dinner idea is saved.": "Twój pomysł na posiłek został zapisany.",
  "Sign in and Dish Genie will generate it without asking you to type or choose everything again.":
    "Zaloguj się, a Dish Genie wygeneruje go bez ponownego wpisywania i wybierania ustawień.",
  "Create your account and Dish Genie will generate it without asking you to type or choose everything again.":
    "Załóż konto, a Dish Genie wygeneruje go bez ponownego wpisywania i wybierania ustawień.",
  "If this creates a new account, you agree to the":
    "Jeśli utworzy to nowe konto, akceptujesz",
  "By creating an account or continuing with Google, you agree to the":
    "Tworząc konto lub kontynuując przez Google, akceptujesz",
  "and acknowledge the": "i potwierdzasz zapoznanie się z",
  "Terms of Service": "Regulamin",
  "Unknown user": "Nieznany użytkownik",
  "Invalid password": "Nieprawidłowe hasło",
  "User already exists": "Użytkownik już istnieje",
  "Invalid or expired password reset link.":
    "Link do zmiany hasła jest nieprawidłowy lub wygasł.",
  "Too many password reset requests. Please try again later.":
    "Zbyt wiele próśb o zmianę hasła. Spróbuj ponownie później.",
  "Too many password reset attempts. Please try again later.":
    "Zbyt wiele prób zmiany hasła. Spróbuj ponownie później.",
  "Too many recipe generation requests. Please try again in a minute.":
    "Zbyt wiele prób generowania. Spróbuj ponownie za minutę.",
  "AI provider quota/rate limit reached. Please try again in a minute.":
    "Osiągnięto limit dostawcy AI. Spróbuj ponownie za minutę.",
  "Recipe generation service is temporarily unavailable. Please try again later.":
    "Generator przepisów jest chwilowo niedostępny. Spróbuj ponownie później.",
  "Receipt image is required.": "Zdjęcie paragonu jest wymagane.",
  "Receipt image too large. Max size is 5MB.":
    "Zdjęcie paragonu jest za duże. Maksymalny rozmiar to 5 MB.",
  "Only JPEG, PNG or WEBP images are supported for receipt scanning.":
    "Skanowanie paragonu obsługuje tylko obrazy JPEG, PNG i WEBP.",
  "Uploaded file is not a valid image.": "Przesłany plik nie jest prawidłowym obrazem.",
  "Receipt image dimensions are too large.": "Wymiary zdjęcia paragonu są za duże.",
  "Could not sync list with server. Using local data for now.":
    "Nie udało się zsynchronizować listy. Na razie używamy danych lokalnych.",
  "Could not sync latest changes. They are still saved locally.":
    "Nie udało się zsynchronizować ostatnich zmian. Nadal są zapisane lokalnie.",
};

type TranslationValues = Record<string, string | number>;

const interpolate = (text: string, values?: TranslationValues) => {
  if (!values) {
    return text;
  }

  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result.split(`{${key}}`).join(String(value)),
    text,
  );
};

const detectLocale = (): Locale => {
  const savedLocale = localStorage.getItem(STORAGE_KEY);
  if (savedLocale === "en" || savedLocale === "pl") {
    return savedLocale;
  }

  return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
};

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (englishText: string, values?: TranslationValues) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

const defaultLanguageContext: LanguageContextValue = {
  locale: "en",
  setLocale: () => undefined,
  toggleLocale: () => undefined,
  t: (englishText, values) => interpolate(englishText, values),
};

interface LanguageProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export const LanguageProvider = ({
  children,
  initialLocale,
}: LanguageProviderProps) => {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? detectLocale(),
  );

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === "en" ? "pl" : "en"),
      t: (englishText, values) =>
        interpolate(
          locale === "pl"
            ? (polishTranslations[englishText] ?? englishText)
            : englishText,
          values,
        ),
    }),
    [locale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  return context ?? defaultLanguageContext;
};
