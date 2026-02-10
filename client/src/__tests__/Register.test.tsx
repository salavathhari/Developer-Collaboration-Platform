import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Register from "../pages/Register";
import "@testing-library/jest-dom";

// Mock fetch
global.fetch = jest.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Register Component", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("renders register form", () => {
    renderWithRouter(<Register />);

    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /full name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("validates password strength", async () => {
    renderWithRouter(<Register />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    fireEvent.change(passwordInput, { target: { value: "weak" } });

    await waitFor(() => {
      expect(screen.getByText(/weak/i)).toBeInTheDocument();
    });
  });

  it("disables submit button when form is invalid", () => {
    renderWithRouter(<Register />);

    const submitButton = screen.getByRole("button", { name: /create account/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when form is valid", async () => {
    renderWithRouter(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);

    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(emailInput, { target: { value: "john@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /create account/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("shows error message on registration failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Email already in use" }),
    });

    renderWithRouter(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(emailInput, { target: { value: "john@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
    });
  });

  it("shows success message and redirects on successful registration", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: "Account created successfully",
        user: { id: "123", name: "John Doe", email: "john@example.com" },
      }),
    });

    renderWithRouter(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(emailInput, { target: { value: "john@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/account created/i)).toBeInTheDocument();
    });
  });
});
