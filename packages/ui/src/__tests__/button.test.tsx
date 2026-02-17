import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/ui/button";

describe("Button", () => {
    it("renders with text content", () => {
        render(<Button>Click me</Button>);

        expect(screen.getByRole("button")).toHaveTextContent("Click me");
    });

    it("handles click events", () => {
        let clicked = false;
        render(<Button onClick={() => { clicked = true; }}>Click</Button>);

        fireEvent.click(screen.getByRole("button"));

        expect(clicked).toBe(true);
    });

    it("renders as disabled", () => {
        render(<Button disabled>Disabled</Button>);

        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("applies variant classes", () => {
        const { container } = render(<Button variant="destructive">Delete</Button>);

        expect(container.firstChild).toHaveClass("bg-destructive");
    });

    it("applies size classes", () => {
        const { container } = render(<Button size="sm">Small</Button>);

        expect(container.firstChild).toHaveClass("h-9");
    });

    it("renders as a child element via asChild", () => {
        render(
            <Button asChild>
                <a href="/test">Link Button</a>
            </Button>
        );

        expect(screen.getByRole("link")).toHaveTextContent("Link Button");
    });
});
