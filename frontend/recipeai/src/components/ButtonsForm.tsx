interface ButtonsFormProps {
  options: string[];
  onButtonClick: (button: string) => void;
  selectedButton: string | null;
  title: string;
}
const ButtonsForm = ({
  options,
  onButtonClick,
  selectedButton,
  title,
}: ButtonsFormProps) => {
  const selectedIndex = selectedButton ? options.indexOf(selectedButton) : -1;

  return (
    <section className="flex w-full flex-col items-center">
      <h2 className="mb-2 text-sm font-medium text-text/60 md:text-base">
        {title}
      </h2>
      <article className="relative flex w-full flex-row justify-between overflow-hidden rounded-[2rem] border border-primary/5 bg-secondary/50 p-1.5 shadow-inner backdrop-blur-sm">
        <div className="absolute inset-y-1.5 left-1.5 right-1.5 pointer-events-none z-0">
          <div
            className="absolute bottom-0 top-0 transition-transform duration-300 ease-out"
            style={{
              width: `${100 / options.length}%`,
              transform: `translateX(${selectedIndex === -1 ? 0 : selectedIndex * 100}%)`,
              opacity: selectedIndex === -1 ? 0 : 1,
            }}
          >
            <div className="h-full w-full rounded-[1.75rem] bg-accent shadow-[0_4px_16px_color-mix(in_srgb,var(--color-accent)_40%,transparent)] ring-1 ring-primary/5 transition-opacity duration-300" />
          </div>
        </div>

        {options.map((button) => (
          <button
            key={button}
            aria-pressed={selectedButton === button}
            className={`relative z-10 flex min-w-0 flex-1 basis-0 items-center justify-center rounded-[1.75rem] px-0 py-3 text-[10px] font-semibold sm:px-1 sm:text-sm transition-colors duration-[250ms] ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 hover:text-text active:scale-[0.97] ${
              selectedButton === button
                ? "text-text"
                : "text-text/70 hover:bg-white/30"
            }`}
            onClick={() => onButtonClick(button)}
          >
            <span className="whitespace-normal leading-tight">{button}</span>
          </button>
        ))}
      </article>
    </section>
  );
};

export default ButtonsForm;
