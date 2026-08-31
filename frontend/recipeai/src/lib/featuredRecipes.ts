interface FeaturedRecipeIngredient {
  name: string;
  amount: string | number;
  unit: string;
}

interface FeaturedRecipe {
  slug: string;
  name: string;
  description: string;
  timeToPrepare: string;
  ingredients: FeaturedRecipeIngredient[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  tags: string[];
}

export const featuredRecipes: FeaturedRecipe[] = [
  {
    slug: "miso-butter-chicken-rice-bowl",
    name: "Miso Butter Chicken Rice Bowl",
    description:
      "A glossy weeknight rice bowl with juicy chicken, spinach, and a salty-sweet miso butter sauce that tastes like more work than it is.",
    timeToPrepare: "28 min",
    tags: ["Best overall", "High protein", "Uses rice"],
    ingredients: [
      { name: "chicken thighs", amount: 300, unit: "g" },
      { name: "cooked rice", amount: 320, unit: "g" },
      { name: "spinach", amount: 90, unit: "g" },
      { name: "white miso", amount: 24, unit: "g" },
      { name: "butter", amount: 25, unit: "g" },
      { name: "soy sauce", amount: 15, unit: "ml" },
      { name: "rice vinegar", amount: 10, unit: "ml" },
      { name: "garlic", amount: 2, unit: "cloves" },
      { name: "spring onion", amount: 2, unit: "pieces" },
      { name: "sesame seeds", amount: 8, unit: "g" },
    ],
    instructions: [
      "Pat chicken dry, slice into bite-size pieces, and season lightly with salt.",
      "Whisk miso, soy sauce, rice vinegar, and 30 ml warm water until smooth.",
      "Sear chicken in a hot pan for 5-6 minutes until browned and cooked through.",
      "Lower the heat, add garlic and butter, and stir for 30 seconds until fragrant.",
      "Pour in the miso sauce and simmer for 1-2 minutes until glossy enough to coat the chicken.",
      "Fold in spinach until just wilted, keeping the leaves bright green.",
      "Warm the rice, spoon chicken and sauce over the top, then finish with spring onion and sesame.",
    ],
    nutrition: {
      calories: 690,
      protein: 42,
      carbs: 68,
      fats: 29,
    },
  },
  {
    slug: "crispy-chickpea-lemon-orzo",
    name: "Crispy Chickpea Lemon Orzo",
    description:
      "A fast pantry dinner with crispy chickpeas, lemony orzo, herbs, and yogurt sauce for a fresh bowl without a grocery run.",
    timeToPrepare: "24 min",
    tags: ["Fastest", "No shopping", "Vegetarian"],
    ingredients: [
      { name: "orzo", amount: 180, unit: "g" },
      { name: "canned chickpeas", amount: 240, unit: "g" },
      { name: "Greek yogurt", amount: 120, unit: "g" },
      { name: "lemon", amount: 1, unit: "piece" },
      { name: "cucumber", amount: 120, unit: "g" },
      { name: "parsley", amount: 12, unit: "g" },
      { name: "olive oil", amount: 30, unit: "ml" },
      { name: "garlic", amount: 1, unit: "clove" },
      { name: "smoked paprika", amount: 3, unit: "g" },
      { name: "feta", amount: 50, unit: "g" },
    ],
    instructions: [
      "Boil orzo in salted water until tender, then reserve 80 ml pasta water before draining.",
      "Dry chickpeas well and fry them in olive oil for 6-8 minutes until crisp at the edges.",
      "Season chickpeas with smoked paprika, salt, and black pepper while still hot.",
      "Mix yogurt with grated garlic, lemon zest, lemon juice, and a pinch of salt.",
      "Toss warm orzo with olive oil, a splash of pasta water, parsley, and crumbled feta.",
      "Fold in diced cucumber just before serving so it stays crunchy.",
      "Top with crispy chickpeas and yogurt sauce, then add extra lemon if the bowl tastes flat.",
    ],
    nutrition: {
      calories: 610,
      protein: 27,
      carbs: 82,
      fats: 21,
    },
  },
  {
    slug: "gochujang-turkey-lettuce-cups",
    name: "Gochujang Turkey Lettuce Cups",
    description:
      "A bold low-cleanup dinner with sticky turkey, crunchy lettuce, rice, and quick pickled carrots.",
    timeToPrepare: "26 min",
    tags: ["Low cleanup", "Bold flavor", "High protein"],
    ingredients: [
      { name: "minced turkey", amount: 320, unit: "g" },
      { name: "cooked rice", amount: 260, unit: "g" },
      { name: "lettuce leaves", amount: 8, unit: "pieces" },
      { name: "carrot", amount: 120, unit: "g" },
      { name: "gochujang", amount: 28, unit: "g" },
      { name: "soy sauce", amount: 20, unit: "ml" },
      { name: "honey", amount: 12, unit: "g" },
      { name: "rice vinegar", amount: 25, unit: "ml" },
      { name: "ginger", amount: 8, unit: "g" },
      { name: "sesame oil", amount: 8, unit: "ml" },
    ],
    instructions: [
      "Toss shredded carrot with rice vinegar, a pinch of salt, and honey; set aside to soften.",
      "Whisk gochujang, soy sauce, ginger, sesame oil, and 20 ml water into a smooth sauce.",
      "Brown turkey in a wide pan over medium-high heat for 6-7 minutes, breaking it into small crumbles.",
      "Add the sauce and simmer for 2-3 minutes until sticky and deeply red.",
      "Warm rice and separate lettuce leaves, choosing the cupped leaves for serving.",
      "Fill each lettuce leaf with rice, turkey, and quick pickled carrot.",
      "Spoon over any pan sauce and serve immediately while the lettuce is crisp.",
    ],
    nutrition: {
      calories: 560,
      protein: 39,
      carbs: 58,
      fats: 19,
    },
  },
  {
    slug: "roasted-vegetable-pesto-frittata",
    name: "Roasted Vegetable Pesto Frittata",
    description:
      "A flexible use-it-up dinner for leftover vegetables, eggs, and a spoon of pesto, finished with crisp edges and a creamy center.",
    timeToPrepare: "32 min",
    tags: ["Use-it-up", "Cheap dinner", "Low waste"],
    ingredients: [
      { name: "eggs", amount: 6, unit: "pieces" },
      { name: "mixed vegetables", amount: 300, unit: "g" },
      { name: "pesto", amount: 35, unit: "g" },
      { name: "milk", amount: 60, unit: "ml" },
      { name: "mozzarella", amount: 90, unit: "g" },
      { name: "onion", amount: 1, unit: "piece" },
      { name: "olive oil", amount: 20, unit: "ml" },
      { name: "cherry tomatoes", amount: 120, unit: "g" },
      { name: "basil", amount: 8, unit: "g" },
      { name: "lemon", amount: 0.5, unit: "piece" },
    ],
    instructions: [
      "Heat the oven to 220C and roast chopped vegetables with olive oil and salt for 14-16 minutes.",
      "Whisk eggs, milk, pesto, black pepper, and a small pinch of salt until evenly green.",
      "Soften sliced onion in an oven-safe pan for 4 minutes over medium heat.",
      "Add roasted vegetables and tomatoes to the pan, spreading them into an even layer.",
      "Pour in the egg mixture and cook undisturbed for 3 minutes until the edges begin to set.",
      "Scatter mozzarella on top and bake at 190C for 9-11 minutes until just set in the center.",
      "Rest for 5 minutes, then finish with basil and a squeeze of lemon.",
    ],
    nutrition: {
      calories: 520,
      protein: 31,
      carbs: 24,
      fats: 34,
    },
  },
];

export const getFeaturedRecipe = (slug: string | undefined) =>
  featuredRecipes.find((recipe) => recipe.slug === slug);
