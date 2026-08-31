import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from "react-router-dom";
import { Suspense, lazy, type ReactElement } from "react";
import "./App.css";
import Layout from "./pages/Layout";
const HomePage = lazy(() => import("./pages/HomePage"));
const UserRecipes = lazy(() => import("./pages/UserRecipes.tsx"));
const Fridge = lazy(() =>
  import("./pages/Fridge.tsx").then((module) => ({ default: module.Fridge })),
);
const Login = lazy(() => import("./pages/Login"));
const RecipePage = lazy(() => import("./pages/RecipePage"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPasswordPage = lazy(() =>
  import("./pages/PasswordRecoveryPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/PasswordRecoveryPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const MePage = lazy(() => import("./pages/UserPreferencesPage.tsx"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ShoppingList = lazy(() => import("./pages/ShoppingList"));
const BlogIndexPage = lazy(() =>
  import("./pages/BlogPage").then((module) => ({
    default: module.BlogIndexPage,
  })),
);
const BlogPostPage = lazy(() =>
  import("./pages/BlogPage").then((module) => ({
    default: module.BlogPostPage,
  })),
);
const FeaturedRecipePage = lazy(() => import("./pages/FeaturedRecipePage"));
const PrivacyPolicyPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.PrivacyPolicyPage,
  })),
);
const TermsOfServicePage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.TermsOfServicePage,
  })),
);
import { AuthProvider } from "./context/context";
import { AnalyticsConsentProvider } from "./context/analyticsConsentContext";
import { FridgeProvider } from "./context/fridgeContext.tsx";
import { GuestRoute, ProtectedRoute } from "./components/RouteGuards";
import ErrorPage from "./pages/ErrorPage";
import { RouteShell } from "./components/RouteShell";
import AnalyticsIdentitySync from "./components/AnalyticsIdentitySync";

const withSuspense = (element: ReactElement) => (
  <Suspense fallback={<RouteShell />}>{element}</Suspense>
);

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Layout />} errorElement={<ErrorPage />}>
        <Route index element={withSuspense(<HomePage />)} />
        <Route path="/Recipes" element={withSuspense(<UserRecipes />)} />
        <Route path="/recipes" element={<Navigate to="/Recipes" replace />} />
        <Route
          path="/Fridge"
          element={withSuspense(
            <ProtectedRoute>
              <Fridge />
            </ProtectedRoute>,
          )}
        />
        <Route
          path="/login"
          element={withSuspense(
            <GuestRoute>
              <Login />
            </GuestRoute>,
          )}
        />
        <Route path="/Login" element={<Navigate to="/login" replace />} />
        <Route
          path="/register"
          element={withSuspense(
            <GuestRoute>
              <Register />
            </GuestRoute>,
          )}
        />
        <Route path="/forgot-password" element={withSuspense(<ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPasswordPage />)} />
        <Route
          path="/My Profile"
          element={withSuspense(
            <ProtectedRoute>
              <MePage />
            </ProtectedRoute>,
          )}
        />
        <Route
          path="/My Preferences"
          element={<Navigate to="/My Profile" replace />}
        />
        <Route
          path="/ShoppingList"
          element={withSuspense(
            <ProtectedRoute>
              <ShoppingList />
            </ProtectedRoute>,
          )}
        />
        <Route
          path="/Recipe"
          element={withSuspense(
            <ProtectedRoute>
              <RecipePage />
            </ProtectedRoute>,
          )}
        />
        <Route path="/Recipe/:id" element={withSuspense(<RecipePage />)} />
        <Route path="/myRecipes" element={<Navigate to="/Recipes" replace />} />
        <Route path="/privacy" element={withSuspense(<PrivacyPolicyPage />)} />
        <Route path="/terms" element={withSuspense(<TermsOfServicePage />)} />
        <Route path="/blog" element={withSuspense(<BlogIndexPage />)} />
        <Route path="/blog/:slug" element={withSuspense(<BlogPostPage />)} />
        <Route
          path="/featured-recipes/:slug"
          element={withSuspense(<FeaturedRecipePage />)}
        />
        <Route
          path="/admin"
          element={withSuspense(
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>,
          )}
        />
        <Route path="/Homepage" element={<Navigate to="/" replace />} />
        <Route
          path="*"
          element={
            <ErrorPage
              title="Page not found"
              subtitle="The page you requested does not exist."
            />
          }
        />
      </Route>,
    ),
  );

  return (
    <AuthProvider>
      <AnalyticsConsentProvider>
        <FridgeProvider>
          <AnalyticsIdentitySync />
          <RouterProvider router={router} />
        </FridgeProvider>
      </AnalyticsConsentProvider>
    </AuthProvider>
  );
}

export default App;
