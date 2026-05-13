import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DropDownButton } from "./DropDownButton";
import DropDownMenu from "./DropDownMenu";
import { useUser } from "../context/context";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, isAdmin, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
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
    <div className="flex bg-primary p-4 fixed top-0 left-0 w-full z-50 shadow-md">
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
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span>DishGenie</span>
            </Link>
          </li>

          {/* --- Right Side: Controls (Desktop) / Burger (Mobile) --- */}
          <div className="flex items-center space-x-3">
            {/* Desktop Nav Links */}
            <div className="flex items-center space-x-3 max-sm:hidden">
              {loading ? (
                // Skeleton pills during auth loading — prevents Login→items flash
                <>
                  {["w-16", "w-20", "w-24"].map((w, i) => (
                    <div
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
                        to={item === "Home" ? "/" : "/" + item}
                        className="px-4 py-2 rounded-full text-background hover:text-accent inline-block border-none"
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                  {user && (
                    <li className="list-none">
                      <button
                        className="px-2 py-1 rounded-full hover:text-accent font-semibold cursor-pointer"
                        onClick={handleLogout}
                      >
                        Logout
                      </button>
                    </li>
                  )}
                </>
              )}
            </div>

            {/* Mobile Burger Button */}
            <li className="sm:hidden flex items-center pr-1">
              <DropDownButton onClick={toggleOpen} isOpen={isOpen} />
            </li>
          </div>
        </ul>
        <div
          className={`
            absolute left-0 top-full -mt-[1px] flex w-full flex-col bg-[#111111]
            shadow-2xl transition-all duration-400 ease-in-out sm:hidden overflow-hidden
            ${
              isOpen
                ? "max-h-[500px] opacity-100"
                : "max-h-0 opacity-0 pointer-events-none"
            }
          `}
        >
          <DropDownMenu
            className={`w-full flex flex-col pb-4 transition-opacity duration-300 ${
              isOpen ? "opacity-100 delay-100" : "opacity-0"
            }`}
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
      </nav>
    </div>
  );
};

export default Navbar;
