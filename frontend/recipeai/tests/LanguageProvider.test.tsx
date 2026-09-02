import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  LanguageProvider,
  useLanguage,
} from "../src/context/languageContext";

const LanguageProbe = () => {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div>
      <p>{t("Home")}</p>
      <p>{t("Polish recipe")}</p>
      <button type="button" onClick={() => setLocale("pl")}>
        Polski
      </button>
      <output>{locale}</output>
    </div>
  );
};

describe("LanguageProvider", () => {
  test("switches the interface to Polish and remembers the choice", () => {
    render(
      <LanguageProvider initialLocale="en">
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Polski" }));

    expect(screen.getByText("Strona główna")).toBeInTheDocument();
    expect(screen.getByText("pl")).toBeInTheDocument();
    expect(localStorage.getItem("dishGenie.locale")).toBe("pl");
    expect(document.documentElement.lang).toBe("pl");
    expect(screen.getByText("Przepis po polsku")).toBeInTheDocument();
  });
});
