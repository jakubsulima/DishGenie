interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTime: string;
  category: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

const blogPosts: BlogPost[] = [
  {
    slug: "what-to-cook-when-you-have-ingredients-but-no-plan",
    title: "What to Cook When You Have Ingredients but No Plan",
    description:
      "A practical 3-option method for turning food at home into dinner ideas without browsing generic recipe lists.",
    publishedAt: "2026-06-08",
    readingTime: "4 min read",
    category: "Weeknight dinners",
    intro:
      "The hardest dinner problem is often not a lack of food. It is having ingredients at home, no clear plan, and too many possible recipes to sort through. A better approach is to compare a few realistic options by time, missing ingredients, and what needs using first.",
    sections: [
      {
        heading: "Start with the food you actually have",
        body: "Write the ingredients the way you would say them out loud: eggs, rice, spinach, leftover chicken, half an onion, or yogurt. You do not need a perfect pantry inventory. The goal is to give the decision enough context to avoid recipes that require a new shopping trip.",
      },
      {
        heading: "Ask for three dinner options",
        body: "One recipe can be too brittle, and a long feed creates more work. Three options are easier to compare: best overall, fastest, and use-it-up. That set gives you a practical choice instead of another page of inspiration.",
      },
      {
        heading: "Compare missing items before choosing",
        body: "A realistic dinner idea should tell you what it uses from your kitchen and what is missing. If the missing item is optional, you can cook without shopping. If it is essential, you can decide whether the recipe is worth the store run.",
      },
      {
        heading: "Let urgency decide the winner",
        body: "When an ingredient is close to expiring, make it the anchor. A spinach bowl, frittata, soup, pasta, or fried rice can absorb small amounts of food before they go bad while still feeling like a planned dinner.",
      },
    ],
  },
  {
    slug: "what-to-cook-with-random-ingredients",
    title: "What to Cook With Random Ingredients",
    description:
      "A practical way to turn a few fridge ingredients into realistic meal ideas without scrolling through hundreds of recipes.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "Meal planning",
    intro:
      "Most weeknight cooking starts with a constraint: a few ingredients that need to be used, a limited amount of time, and no appetite for a complicated plan. The fastest path is to decide the meal shape first, then let the ingredients fill it in.",
    sections: [
      {
        heading: "Start with a meal shape",
        body: "Before searching for a specific recipe, choose whether dinner should be a bowl, pasta, soup, salad, sandwich, tray bake, stir fry, or snack plate. That single choice narrows the decision and makes mismatched ingredients easier to combine.",
      },
      {
        heading: "Match ingredients by role",
        body: "Think in roles instead of exact recipe names: protein, vegetable, starch, sauce, crunch, and fresh finish. A meal can work even when one role is simple, such as toast for starch or yogurt for sauce.",
      },
      {
        heading: "Use AI for options, not commands",
        body: "A good recipe generator should give you a few realistic directions, then let you choose. Three options are usually enough to compare effort, ingredients, and mood without creating another endless feed.",
      },
    ],
  },
  {
    slug: "fridge-inventory-for-busy-cooks",
    title: "Fridge Inventory Tips for Busy Cooks",
    description:
      "Simple fridge tracking habits that make recipe ideas more useful without turning your kitchen into a spreadsheet project.",
    publishedAt: "2026-05-30",
    readingTime: "3 min read",
    category: "Kitchen organization",
    intro:
      "A fridge inventory only helps if it is easy to keep current. The goal is not perfect tracking; the goal is giving yourself enough context to make better cooking decisions before ingredients expire.",
    sections: [
      {
        heading: "Track flexible ingredients first",
        body: "Start with items that can become many meals: eggs, cooked grains, greens, cheese, beans, herbs, sauces, and leftovers. These ingredients change what you can cook much more than a single unopened condiment.",
      },
      {
        heading: "Keep names natural",
        body: "Use the words you would say out loud, such as spinach, cooked rice, chicken thighs, or half onion. Natural names work better when you are asking for recipe ideas and are easier to update quickly.",
      },
      {
        heading: "Review before shopping",
        body: "A short fridge check before grocery shopping can prevent duplicate purchases and turn almost-finished ingredients into dinner prompts. Even a partial list is useful when it keeps one item from being wasted.",
      },
    ],
  },
  {
    slug: "ai-recipe-generator-vs-recipe-search",
    title: "AI Recipe Generator vs. Recipe Search",
    description:
      "When to use an AI recipe generator, when to use classic recipe search, and how to get better cooking ideas from both.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "AI cooking",
    intro:
      "Recipe search and AI recipe generation solve different problems. Search is strongest when you already know the dish. Generation is strongest when you know the situation but not the exact meal.",
    sections: [
      {
        heading: "Use search for known dishes",
        body: "If you want carbonara, banana bread, or shakshuka, a tested recipe from a trusted cook is usually the best starting point. Specific dishes benefit from precision and proven technique.",
      },
      {
        heading: "Use generation for constraints",
        body: "If you have chickpeas, carrots, rice, and twenty minutes, generation can translate that situation into a few possible meals. It is especially useful when ingredients, time, and appetite all matter.",
      },
      {
        heading: "Save what worked",
        body: "The best cooking system gets smarter from your own habits. Save the recipes that fit your kitchen, then reuse those patterns the next time similar ingredients show up.",
      },
    ],
  },
  {
    slug: "recipe-generator-with-ingredients-you-have",
    title: "How to Use a Recipe Generator With Ingredients You Have",
    description:
      "A simple prompt structure for turning the food in your kitchen into useful recipe ideas.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "AI cooking",
    intro:
      "A recipe generator works best when it knows your constraints. Instead of asking for a generic dinner idea, give it the ingredients you want to use, the meal type, and the effort level you can handle.",
    sections: [
      {
        heading: "List the ingredients that matter",
        body: "Start with the items you want to use soon, then add pantry basics only if they change the meal. A prompt like chicken thighs, spinach, rice, and yogurt is more useful than a long inventory with every spice you own.",
      },
      {
        heading: "Add the real constraint",
        body: "Tell the generator whether you need a quick dinner, no extra shopping, low cleanup, high protein, or something kid-friendly. The constraint is often what turns a technically possible recipe into one you would actually cook.",
      },
      {
        heading: "Ask for options before details",
        body: "Start with three meal directions, then choose one before asking for steps. This keeps the decision small and prevents you from reading a full recipe that does not fit your appetite.",
      },
    ],
  },
  {
    slug: "quick-dinner-ideas-no-shopping",
    title: "Quick Dinner Ideas When You Do Not Want to Shop",
    description:
      "How to build fast dinners from fridge and pantry ingredients without making another grocery run.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "Weeknight dinners",
    intro:
      "No-shopping dinners are easier when you stop looking for a perfect recipe and start looking for a meal format that can absorb substitutions.",
    sections: [
      {
        heading: "Pick a flexible base",
        body: "Rice, pasta, toast, tortillas, potatoes, eggs, noodles, and salad greens can all turn small ingredients into a real meal. Choose the base first so the rest of the decision has a frame.",
      },
      {
        heading: "Use sauce to connect leftovers",
        body: "Yogurt sauce, vinaigrette, soy sauce, pesto, salsa, tahini, or a quick pan sauce can make unrelated ingredients feel intentional. A simple sauce often matters more than one missing vegetable.",
      },
      {
        heading: "Keep the recipe short",
        body: "If the goal is not shopping, avoid ideas with many dependencies. Look for meals with one pan, one base, and a small number of toppings or mix-ins.",
      },
    ],
  },
  {
    slug: "leftover-ingredient-recipe-ideas",
    title: "Leftover Ingredient Recipe Ideas That Do Not Feel Random",
    description:
      "A practical method for turning small leftovers into meals that feel planned instead of patched together.",
    publishedAt: "2026-05-30",
    readingTime: "3 min read",
    category: "Reduce food waste",
    intro:
      "Leftovers become easier to use when you give them a role. A small amount of cooked vegetables, sauce, grains, or protein can still anchor a meal if the format is forgiving.",
    sections: [
      {
        heading: "Turn leftovers into toppings",
        body: "Small portions often work better as toppings than as the whole meal. Add leftover vegetables to toast, eggs, rice bowls, noodles, wraps, or warm salads.",
      },
      {
        heading: "Combine by texture",
        body: "A leftover-heavy meal needs contrast. Add something crisp, creamy, acidic, or fresh so the dish feels intentional rather than reheated.",
      },
      {
        heading: "Let one ingredient lead",
        body: "Choose the ingredient most likely to expire first and build around it. Dish Genie can use that item as the anchor and suggest options that include the rest only where they make sense.",
      },
    ],
  },
  {
    slug: "meal-planning-without-a-spreadsheet",
    title: "Meal Planning Without a Spreadsheet",
    description:
      "A lighter way to plan meals when you want structure but do not want a rigid weekly schedule.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "Meal planning",
    intro:
      "Meal planning fails when it asks for too much certainty. A lighter system gives you a few reliable dinner directions without forcing every meal into a calendar.",
    sections: [
      {
        heading: "Plan categories, not recipes",
        body: "Choose broad categories like soup, bowl, pasta, tray bake, or breakfast-for-dinner. Categories leave room for cravings and ingredient changes while still reducing decision fatigue.",
      },
      {
        heading: "Keep a short backup list",
        body: "A good backup list has meals you can make from common ingredients. Eggs on toast, fried rice, chickpea bowls, pasta with vegetables, and loaded potatoes can rescue a weeknight quickly.",
      },
      {
        heading: "Use your fridge as the plan",
        body: "The most useful plan often starts with what is already available. When you track a few fridge items, recipe ideas can adapt to your kitchen instead of asking you to shop for a new one.",
      },
    ],
  },
  {
    slug: "shopping-list-from-recipe",
    title: "How to Turn a Recipe Into a Better Shopping List",
    description:
      "Make grocery shopping faster by separating what you already have from what a recipe actually needs.",
    publishedAt: "2026-05-30",
    readingTime: "3 min read",
    category: "Shopping list",
    intro:
      "A useful shopping list is not just a copied ingredient list. It should remove what you already have, group what is missing, and keep quantities clear enough for the store.",
    sections: [
      {
        heading: "Check the kitchen first",
        body: "Before adding every ingredient, scan your fridge and pantry. Removing duplicates saves money and keeps your kitchen from filling with half-used jars and repeat produce.",
      },
      {
        heading: "Group by store movement",
        body: "Produce, pantry, dairy, protein, frozen, and household groups make a list easier to use in the store. Even a small list is faster when similar items sit together.",
      },
      {
        heading: "Keep recipe context nearby",
        body: "When a list comes from a recipe, keep the meal attached. If something is unavailable, you can decide quickly whether to substitute it or choose a different dinner.",
      },
    ],
  },
  {
    slug: "use-up-vegetables-before-they-go-bad",
    title: "How to Use Up Vegetables Before They Go Bad",
    description:
      "Simple meal formats for using vegetables before they expire, from bowls and soups to quick tray bakes.",
    publishedAt: "2026-05-30",
    readingTime: "4 min read",
    category: "Reduce food waste",
    intro:
      "Vegetables are easier to save when you act before they need rescuing. The best approach is to choose a cooking format that can handle mixed vegetables without needing exact amounts.",
    sections: [
      {
        heading: "Sort by cooking time",
        body: "Hard vegetables like carrots, potatoes, and squash need more time than greens, tomatoes, or zucchini. Add sturdy vegetables first and delicate vegetables near the end.",
      },
      {
        heading: "Use forgiving formats",
        body: "Soups, fried rice, frittatas, pasta, curries, grain bowls, and tray bakes are built for substitutions. They let you use what is available without chasing an exact recipe.",
      },
      {
        heading: "Save fresh finishes for last",
        body: "Herbs, lemon, yogurt, pickles, hot sauce, or crunchy toppings can make a vegetable-heavy dinner feel finished. A small fresh element helps leftovers taste deliberate.",
      },
    ],
  },
];

const polishBlogCopy: Record<
  string,
  Pick<BlogPost, "title" | "description" | "readingTime" | "category" | "intro" | "sections">
> = {
  "what-to-cook-when-you-have-ingredients-but-no-plan": {
    title: "Co ugotować, gdy masz składniki, ale nie masz planu",
    description: "Praktyczna metoda trzech opcji, która zamienia domowe zapasy w konkretny plan na posiłek.",
    readingTime: "4 min czytania",
    category: "Szybkie obiady",
    intro: "Najtrudniejszym problemem często nie jest brak jedzenia, lecz nadmiar możliwości. Porównaj kilka realistycznych opcji według czasu, brakujących produktów i tego, co trzeba zużyć najpierw.",
    sections: [
      { heading: "Zacznij od tego, co naprawdę masz", body: "Zapisz składniki naturalnie: jajka, ryż, szpinak, resztka kurczaka czy pół cebuli. Nie potrzebujesz idealnego spisu — wystarczy kontekst, który pozwoli uniknąć niepotrzebnych zakupów." },
      { heading: "Poproś o trzy opcje", body: "Jeden przepis bywa zbyt ograniczający, a długa lista tworzy kolejną pracę. Porównaj najlepszą opcję, najszybszą i taką, która najlepiej wykorzysta zapasy." },
      { heading: "Sprawdź braki przed wyborem", body: "Dobry pomysł pokazuje, czego używa z Twojej kuchni i czego brakuje. Dzięki temu od razu wiesz, czy ugotujesz bez wychodzenia do sklepu." },
      { heading: "Niech pilność rozstrzygnie", body: "Jeśli składnik niedługo straci świeżość, zbuduj danie wokół niego. Miski, frittaty, zupy, makarony i smażony ryż łatwo wykorzystują małe ilości produktów." },
    ],
  },
  "what-to-cook-with-random-ingredients": {
    title: "Co ugotować z przypadkowych składników",
    description: "Jak zamienić kilka produktów z lodówki w realistyczne danie bez przeglądania setek przepisów.",
    readingTime: "4 min czytania",
    category: "Planowanie posiłków",
    intro: "Codzienne gotowanie zwykle zaczyna się od ograniczeń: kilku składników, małej ilości czasu i braku ochoty na skomplikowany plan. Najpierw wybierz formę dania, a potem dopasuj produkty.",
    sections: [
      { heading: "Wybierz formę posiłku", body: "Zdecyduj, czy ma to być miska, makaron, zupa, sałatka, kanapka, danie z blachy czy stir-fry. Jeden wybór mocno upraszcza dalszą decyzję." },
      { heading: "Dopasuj składniki według roli", body: "Myśl kategoriami: białko, warzywo, baza, sos, chrupiący dodatek i świeże wykończenie. Nie każda rola musi być wyszukana." },
      { heading: "Używaj AI do tworzenia opcji", body: "Dobry generator podaje kilka realistycznych kierunków i pozwala wybrać. Trzy propozycje wystarczą, aby porównać pracochłonność, składniki i nastrój." },
    ],
  },
  "fridge-inventory-for-busy-cooks": {
    title: "Lodówka pod kontrolą dla zabieganych",
    description: "Proste nawyki śledzenia zapasów bez zamieniania kuchni w arkusz kalkulacyjny.",
    readingTime: "3 min czytania",
    category: "Organizacja kuchni",
    intro: "Spis lodówki pomaga tylko wtedy, gdy łatwo go aktualizować. Nie chodzi o perfekcję, lecz o kontekst potrzebny do lepszych decyzji przed zepsuciem produktów.",
    sections: [
      { heading: "Najpierw śledź elastyczne składniki", body: "Zacznij od jajek, ugotowanych zbóż, liści, sera, fasoli, ziół, sosów i resztek. To one najmocniej zmieniają dostępne możliwości." },
      { heading: "Używaj naturalnych nazw", body: "Wpisuj produkty tak, jak o nich mówisz: szpinak, ugotowany ryż, udka z kurczaka czy pół cebuli. Taką listę łatwiej aktualizować i wykorzystywać." },
      { heading: "Sprawdź lodówkę przed zakupami", body: "Krótki przegląd zapobiega podwójnym zakupom i zamienia kończące się produkty w pomysły na posiłek. Nawet niepełna lista może ograniczyć marnowanie." },
    ],
  },
  "ai-recipe-generator-vs-recipe-search": {
    title: "Generator przepisów AI czy tradycyjne wyszukiwanie?",
    description: "Kiedy warto generować przepis, a kiedy lepiej sięgnąć po sprawdzoną recepturę.",
    readingTime: "4 min czytania",
    category: "AI w kuchni",
    intro: "Wyszukiwanie i generowanie rozwiązują inne problemy. Wyszukiwarka wygrywa, gdy znasz danie; generator — gdy znasz sytuację, ale nie masz konkretnego pomysłu.",
    sections: [
      { heading: "Szukaj znanych dań", body: "Jeśli chcesz carbonarę, chleb bananowy lub szakszukę, zacznij od sprawdzonego przepisu z wiarygodnego źródła. Konkretne dania wymagają precyzji." },
      { heading: "Generuj według ograniczeń", body: "Gdy masz ciecierzycę, marchew, ryż i dwadzieścia minut, generator może przełożyć tę sytuację na kilka możliwych posiłków." },
      { heading: "Zapisuj to, co się sprawdziło", body: "Dobry system korzysta z Twoich nawyków. Zachowaj przepisy pasujące do kuchni i wracaj do nich, gdy pojawią się podobne składniki." },
    ],
  },
  "recipe-generator-with-ingredients-you-have": {
    title: "Jak używać generatora przepisów z własnymi składnikami",
    description: "Prosta konstrukcja zapytania, która zamienia zapasy w użyteczne pomysły.",
    readingTime: "4 min czytania",
    category: "AI w kuchni",
    intro: "Generator działa najlepiej, gdy zna ograniczenia. Podaj składniki do wykorzystania, rodzaj posiłku i poziom wysiłku, na który masz dziś przestrzeń.",
    sections: [
      { heading: "Wymień ważne składniki", body: "Zacznij od produktów, które trzeba szybko wykorzystać. Krótka lista istotnych składników jest lepsza niż pełny spis każdej przyprawy." },
      { heading: "Dodaj prawdziwe ograniczenie", body: "Określ, czy potrzebujesz szybkiego obiadu, gotowania bez zakupów, małej ilości sprzątania, dużej ilości białka lub dania dla dzieci." },
      { heading: "Najpierw poproś o opcje", body: "Zacznij od trzech kierunków i dopiero potem wybierz szczegóły. Nie musisz czytać pełnego przepisu, który nie pasuje do apetytu." },
    ],
  },
  "quick-dinner-ideas-no-shopping": {
    title: "Szybki obiad bez dodatkowych zakupów",
    description: "Jak budować szybkie posiłki z lodówki i spiżarni bez kolejnej wizyty w sklepie.",
    readingTime: "4 min czytania",
    category: "Szybkie obiady",
    intro: "Obiad bez zakupów staje się prostszy, gdy zamiast idealnego przepisu wybierzesz elastyczną formę dania, która dobrze znosi zamiany.",
    sections: [
      { heading: "Wybierz elastyczną bazę", body: "Ryż, makaron, pieczywo, tortille, ziemniaki, jajka lub sałata potrafią zamienić kilka dodatków w pełny posiłek." },
      { heading: "Połącz resztki sosem", body: "Sos jogurtowy, winegret, sos sojowy, pesto, salsa czy tahini sprawią, że przypadkowe produkty zaczną tworzyć spójną całość." },
      { heading: "Nie komplikuj", body: "Wybieraj pomysły z jedną patelnią, jedną bazą i niewielką liczbą dodatków. Mniej zależności to większa szansa na obiad bez sklepu." },
    ],
  },
  "leftover-ingredient-recipe-ideas": {
    title: "Pomysły na resztki, które nie wyglądają przypadkowo",
    description: "Metoda zamiany małych pozostałości w posiłek, który wygląda na zaplanowany.",
    readingTime: "3 min czytania",
    category: "Mniej marnowania",
    intro: "Resztki łatwiej wykorzystać, gdy przypiszesz im rolę. Nawet mała ilość warzyw, sosu, zboża czy białka może stać się podstawą elastycznego dania.",
    sections: [
      { heading: "Zamień resztki w dodatki", body: "Małe porcje lepiej działają jako dodatki do tostów, jajek, misek ryżowych, makaronu, wrapów lub ciepłych sałatek." },
      { heading: "Łącz przez kontrast tekstur", body: "Dodaj coś chrupiącego, kremowego, kwaśnego lub świeżego, aby danie wyglądało na świadomie skomponowane." },
      { heading: "Niech jeden składnik prowadzi", body: "Wybierz produkt, który najszybciej straci świeżość, i zbuduj wokół niego danie. Pozostałe dodawaj tylko tam, gdzie mają sens." },
    ],
  },
  "meal-planning-without-a-spreadsheet": {
    title: "Planowanie posiłków bez arkusza kalkulacyjnego",
    description: "Lżejszy system planowania, który daje strukturę bez sztywnego harmonogramu.",
    readingTime: "4 min czytania",
    category: "Planowanie posiłków",
    intro: "Planowanie zawodzi, gdy wymaga zbyt dużej pewności. Lżejszy system daje kilka niezawodnych kierunków bez przypisywania każdego posiłku do kalendarza.",
    sections: [
      { heading: "Planuj kategorie, nie przepisy", body: "Wybierz szerokie kategorie: zupa, miska, makaron, danie z blachy czy śniadanie na obiad. Zostawiają miejsce na apetyt i zmiany składników." },
      { heading: "Miej krótką listę awaryjną", body: "Jajka na toście, smażony ryż, miska z ciecierzycą, makaron z warzywami i pieczone ziemniaki szybko ratują wieczór." },
      { heading: "Niech lodówka będzie planem", body: "Najbardziej użyteczny plan często zaczyna się od tego, co już masz. Kilka zapisanych produktów wystarczy, by pomysły dopasowały się do kuchni." },
    ],
  },
  "shopping-list-from-recipe": {
    title: "Jak zamienić przepis w lepszą listę zakupów",
    description: "Oddziel produkty, które już masz, od tych naprawdę potrzebnych do przepisu.",
    readingTime: "3 min czytania",
    category: "Lista zakupów",
    intro: "Dobra lista zakupów nie jest kopią składników. Powinna usuwać zapasy, grupować braki i zachowywać ilości czytelne podczas zakupów.",
    sections: [
      { heading: "Najpierw sprawdź kuchnię", body: "Przejrzyj lodówkę i spiżarnię przed dodaniem każdego składnika. Usunięcie duplikatów oszczędza pieniądze i ogranicza zalegające produkty." },
      { heading: "Grupuj według sklepu", body: "Warzywa, spiżarnia, nabiał, mięso, mrożonki i domowe środki przyspieszają przejście przez sklep, nawet przy krótkiej liście." },
      { heading: "Zachowaj kontekst przepisu", body: "Jeśli produktu nie ma, kontekst dania pozwala szybko zdecydować o zamienniku lub wybrać inny obiad." },
    ],
  },
  "use-up-vegetables-before-they-go-bad": {
    title: "Jak wykorzystać warzywa, zanim się zepsują",
    description: "Elastyczne formy posiłków, które pomagają zużyć warzywa na czas.",
    readingTime: "4 min czytania",
    category: "Mniej marnowania",
    intro: "Warzywa łatwiej uratować, gdy działasz zawczasu. Wybierz sposób gotowania, który przyjmie różne warzywa bez potrzeby dokładnych ilości.",
    sections: [
      { heading: "Sortuj według czasu gotowania", body: "Marchew, ziemniaki i dynia potrzebują więcej czasu niż liście, pomidory czy cukinia. Twarde warzywa dodaj najpierw, delikatne pod koniec." },
      { heading: "Wybieraj wyrozumiałe dania", body: "Zupy, smażony ryż, frittaty, makarony, curry, miski i dania z blachy dobrze znoszą zamiany i nie wymagają dokładnej receptury." },
      { heading: "Świeże dodatki zostaw na koniec", body: "Zioła, cytryna, jogurt, pikle, ostry sos lub chrupiąca posypka sprawią, że warzywny obiad będzie kompletny i świeży." },
    ],
  },
};

export const getBlogPosts = (locale: "en" | "pl") =>
  locale === "pl"
    ? blogPosts.map((post) => ({ ...post, ...polishBlogCopy[post.slug] }))
    : blogPosts;

export const getBlogPost = (slug: string | undefined, locale: "en" | "pl" = "en") =>
  getBlogPosts(locale).find((post) => post.slug === slug);
