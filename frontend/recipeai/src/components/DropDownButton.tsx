import { useLanguage } from "../context/languageContext";

interface Props {
  className?: string;
  isOpen: boolean;
  onClick: () => void;
  controlsId?: string;
}

export const DropDownButton = ({
  className = "",
  isOpen,
  onClick,
  controlsId,
}: Props) => {
  const { t } = useLanguage();
  return (
    <button
      className={`${className} flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md p-2 text-background transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      onClick={onClick}
      aria-label={t(isOpen ? "Close menu" : "Open menu")}
      aria-expanded={isOpen}
      aria-controls={controlsId}
    >
      <span
        className={`block h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-in-out ${
          isOpen ? "translate-y-2 rotate-45" : ""
        }`}
      />
      <span
        className={`block h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-in-out ${
          isOpen ? "opacity-0" : ""
        }`}
      />
      <span
        className={`block h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-in-out ${
          isOpen ? "-translate-y-2 -rotate-45" : ""
        }`}
      />
    </button>
  );
};
