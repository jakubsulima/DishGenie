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

export const blogPosts: BlogPost[] = [
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

export const getBlogPost = (slug: string | undefined) =>
  blogPosts.find((post) => post.slug === slug);
