import FoodLoadingScreen from "../components/FoodLoadingScreen";
import {
  AdminDashboardSkeleton,
  AuthPageSkeleton,
  FridgePageSkeleton,
  HomePageSkeleton,
  PageLayoutSkeleton,
  PreferencesPageSkeleton,
  RecipePageSkeleton,
  RecipesPageSkeleton,
  ShoppingListPageSkeleton,
} from "../components/Skeleton";

type RouteShellState = Record<string, unknown> | null | undefined;

interface RouteShellOptions {
  pathname: string;
  routeState?: RouteShellState;
  authResolved?: boolean;
  isAuthenticated?: boolean;
}

const normalizePathname = (pathname: string) =>
  decodeURIComponent(pathname).trim().toLowerCase();

const getRouteState = (routeState?: RouteShellState) =>
  routeState && typeof routeState === "object"
    ? (routeState as Record<string, unknown>)
    : null;

export const renderRouteShell = ({
  pathname,
  routeState,
  authResolved = false,
  isAuthenticated = false,
}: RouteShellOptions) => {
  const normalizedPath = normalizePathname(pathname);
  const state = getRouteState(routeState);

  if (normalizedPath === "/" || normalizedPath === "/homepage") {
    return <HomePageSkeleton showGuestCta={authResolved && !isAuthenticated} />;
  }

  if (
    normalizedPath === "/recipe" &&
    typeof state?.search === "string" &&
    state.search.trim().length > 0
  ) {
    return (
      <FoodLoadingScreen
        title="Generating your recipe..."
        subtitle="Mixing ingredients, matching flavors, and adding a spicy twist"
        variant="generating"
      />
    );
  }

  if (normalizedPath === "/recipe" || normalizedPath.startsWith("/recipe/")) {
    return <RecipePageSkeleton />;
  }

  if (normalizedPath === "/recipes" || normalizedPath === "/myrecipes") {
    return (
      <RecipesPageSkeleton
        showSearch={isAuthenticated}
        showGuestBanner={authResolved && !isAuthenticated}
      />
    );
  }

  if (normalizedPath === "/fridge") {
    return <FridgePageSkeleton />;
  }

  if (normalizedPath === "/shoppinglist") {
    return <ShoppingListPageSkeleton />;
  }

  if (
    normalizedPath === "/my profile" ||
    normalizedPath === "/my preferences"
  ) {
    return <PreferencesPageSkeleton />;
  }

  if (normalizedPath === "/admin") {
    return <AdminDashboardSkeleton />;
  }

  if (normalizedPath === "/login" || normalizedPath === "/register") {
    return (
      <AuthPageSkeleton
        variant={normalizedPath === "/register" ? "register" : "login"}
      />
    );
  }

  return <PageLayoutSkeleton />;
};
