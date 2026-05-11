import DropDownItem from "./DropDownItem";
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
  const getItemHref = (item: string) => {
    if (item === "Home") {
      return "/";
    }

    return `/${item}`;
  };

  return (
    <div className={className}>
      <div className="flex flex-col py-2">
        {dropdownItems.map((item, index) => {
          const isLogout = item === "Logout";

          if (isLogout) {
            return (
              <button
                key={index}
                type="button"
                className="mt-4 block w-full px-6 py-4 text-center text-[1.1rem] font-bold text-[#fefefe] transition-all duration-200 hover:bg-white/5 hover:text-accent focus:bg-white/5 focus:outline-none active:scale-[0.98]"
                onClick={() => {
                  handleLogout();
                  onItemClick?.();
                }}
              >
                {item}
              </button>
            );
          }

          return (
            <DropDownItem
              to={getItemHref(item)}
              key={index}
              className={`block w-full py-4 px-6 text-center text-[1.1rem] transition-all duration-200 focus:outline-none focus:bg-white/5 active:scale-[0.98] ${
                "font-medium text-[#fefefe] hover:text-accent hover:bg-white/5"
              }`}
              onClick={onItemClick}
            >
              {item}
            </DropDownItem>
          );
        })}
      </div>
    </div>
  );
};

export default DropDownMenu;
