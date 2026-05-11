import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

export const renderWithRouter = (
  ui: ReactElement,
  initialEntries: string[] = ["/"],
) => render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
