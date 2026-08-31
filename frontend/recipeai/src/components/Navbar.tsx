import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DropDownButton } from "./DropDownButton";
import DropDownMenu from "./DropDownMenu";
import { useUser } from "../context/context";
import { useLanguage } from "../context/languageContext";

const getItemHref = (item: string) => (item === "Home" ? "/" : `/${item}`);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, isAdmin, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, t, toggleLocale } = useLanguage();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen((current) => !current);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleLogoClick = () => {
    setIsOpen(false);
  };

  const getNavItems = () => {
    const baseItems = ["Home", "Recipes"];

    if (loading) {
      return [...baseItems, "Login"];
    }

    if (user) {
      return [
        ...baseItems,
        "Fridge",
        "ShoppingList",
        "My Profile",
        isAdmin ? "Admin" : null,
      ].filter(Boolean) as string[];
    } else {
      return [...baseItems, "Login"];
    }
  };

  const navItems = getNavItems();

  return (
    <header className="fixed left-0 top-0 z-50 flex w-full bg-primary p-4 shadow-md">
      <nav className="container mx-auto">
        <ul className="flex w-full text-background justify-between items-center">
          {/* --- Left Side: Logo --- */}
          <li className="list-none text-lg font-bold transition-colors hover:text-accent">
            <Link
              to="/"
              onClick={handleLogoClick}
              className="flex items-center gap-2"
            >
              <img
                src="/favicon.png?v=5"
                alt="Dish Genie logo"
                width="36"
                height="36"
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span>Dish Genie</span>
            </Link>
          </li>

          {/* --- Right Side: Controls (Desktop) / Burger (Mobile) --- */}
          <li className="flex items-center space-x-3">
            {/* Desktop Nav Links */}
            <ul className="flex items-center space-x-3 max-sm:hidden">
              {loading ? (
                // Skeleton pills during auth loading — prevents Login→items flash
                <>
                  {["w-16", "w-20", "w-24"].map((w, i) => (
                    <li
                      key={i}
                      className={`${w} h-8 rounded-full bg-background/20 animate-pulse`}
                    />
                  ))}
                </>
              ) : (
                <>
                  {navItems.map((item, index) => (
                    <li key={index} className="list-none">
                      <Link
                        to={getItemHref(item)}
                        className="px-4 py-2 rounded-full text-background hover:text-accent inline-block border-none"
                      >
                        {t(item)}
                      </Link>
                    </li>
                  ))}
                  {user && (
                    <li className="list-none">
                      <button
                        className="px-2 py-1 rounded-full hover:text-accent font-semibold cursor-pointer"
                        onClick={handleLogout}
                      >
                        {t("Logout")}
                      </button>
                    </li>
                  )}
                </>
              )}
              <li>
                <button
                  type="button"
                  onClick={toggleLocale}
                  className="rounded-full border border-background/30 px-3 py-2 text-xs font-bold text-background transition-colors hover:border-accent hover:text-accent"
                  aria-label={
                    locale === "en"
                      ? "Przełącz język na polski"
                      : "Switch language to English"
                  }
                >
                  {locale === "en" ? "PL" : "EN"}
                </button>
              </li>
            </ul>

            {/* Mobile Burger Button */}
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-full border border-background/30 px-3 py-2 text-xs font-bold text-background sm:hidden"
              aria-label={
                locale === "en"
                  ? "Przełącz język na polski"
                  : "Switch language to English"
              }
            >
              {locale === "en" ? "PL" : "EN"}
            </button>
            <span className="flex items-center pr-1 sm:hidden">
              <DropDownButton
                onClick={toggleOpen}
                isOpen={isOpen}
                controlsId="mobile-navigation"
              />
            </span>
          </li>
        </ul>
        {isOpen && (
          <div
            id="mobile-navigation"
            className="absolute left-0 top-full -mt-px flex w-full flex-col overflow-hidden bg-[#111111] shadow-2xl sm:hidden"
          >
            <DropDownMenu
              className="flex w-full flex-col pb-4"
              dropdownItems={
                loading
                  ? navItems
                  : user
                    ? [...navItems, "Logout"].filter(
                        (item): item is string => !!item,
                      )
                    : navItems
              }
              handleLogout={handleLogout}
              onItemClick={() => setIsOpen(false)}
            />
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
