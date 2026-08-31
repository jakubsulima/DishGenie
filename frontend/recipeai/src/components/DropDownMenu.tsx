import DropDownItem from "./DropDownItem";
import { useLanguage } from "../context/languageContext";
interface Props {
  dropdownItems: string[];
  className: string;
  handleLogout: () => void;
  onItemClick?: () => void;
}

const DropDownMenu = ({
  dropdownItems,
  className,
  handleLogout,
  onItemClick,
}: Props) => {
  const { t } = useLanguage();
  const getItemHref = (item: string) => {
    if (item === "Home") {
      return "/";
    }

    return `/${item}`;
  };

  return (
    <div className={className}>
      <ul className="flex flex-col py-2">
        {dropdownItems.map((item, index) => {
          const isLogout = item === "Logout";

          if (isLogout) {
            return (
              <li key={item}>
                <button
                  type="button"
                  className="mt-4 block w-full px-6 py-4 text-center text-[1.1rem] font-bold text-[#fefefe] transition-all duration-200 hover:bg-white/5 hover:text-accent focus:bg-white/5 focus:outline-none active:scale-[0.98]"
                  onClick={() => {
                    handleLogout();
                    onItemClick?.();
                  }}
                >
                  {t(item)}
                </button>
              </li>
            );
          }

          return (
            <li key={`${item}-${index}`}>
              <DropDownItem
                to={getItemHref(item)}
                className="block w-full px-6 py-4 text-center text-[1.1rem] font-medium text-[#fefefe] transition-all duration-200 hover:bg-white/5 hover:text-accent focus:bg-white/5 focus:outline-none active:scale-[0.98]"
                onClick={onItemClick}
              >
                {t(item)}
              </DropDownItem>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DropDownMenu;
