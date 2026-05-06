import { useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const handleClick = (item: string) => {
    if (item === "Logout") {
      handleLogout();
    } else if (item === "Home") {
      navigate("/");
    } else {
      navigate("/" + item);
    }
    if (onItemClick) onItemClick();
  };

  return (
    <div className={className}>
      <div className="flex flex-col py-2">
        {dropdownItems.map((item, index) => {
          const isLogout = item === "Logout";
          return (
            <DropDownItem
              to={isLogout ? "#" : item === "Home" ? "/" : "/" + item}
              key={index}
              className={`block w-full py-4 px-6 text-center text-[1.1rem] transition-all duration-200 focus:outline-none focus:bg-white/5 active:scale-[0.98] ${
                isLogout
                  ? "mt-4 font-bold text-[#fefefe] hover:text-accent hover:bg-white/5"
                  : "font-medium text-[#fefefe] hover:text-accent hover:bg-white/5"
              }`}
              onClick={() => handleClick(item)}
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
