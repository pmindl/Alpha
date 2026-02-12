import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Button } from './Button';

describe('Button Component', () => {
    it('renders with default props', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('cyber-button');
    });

    it('renders with variant="icon"', () => {
        render(<Button variant="icon">Icon</Button>);
        const button = screen.getByRole('button', { name: /icon/i });
        expect(button).toHaveClass('icon-btn');
        expect(button).not.toHaveClass('cyber-button');
    });

    it('renders with variant="icon" and active={true}', () => {
        render(<Button variant="icon" active={true}>Active Icon</Button>);
        const button = screen.getByRole('button', { name: /active icon/i });
        expect(button).toHaveClass('icon-btn');
        expect(button).toHaveClass('active');
    });

    it('renders with custom className', () => {
        render(<Button className="custom-class">Custom</Button>);
        const button = screen.getByRole('button', { name: /custom/i });
        expect(button).toHaveClass('cyber-button');
        expect(button).toHaveClass('custom-class');
    });

    it('renders children correctly', () => {
        render(
            <Button>
                <span>Child Element</span>
            </Button>
        );
        expect(screen.getByText('Child Element')).toBeInTheDocument();
    });

    it('handles click events', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('can be disabled', () => {
        render(<Button disabled>Disabled Button</Button>);
        const button = screen.getByRole('button', { name: /disabled button/i });
        expect(button).toBeDisabled();
    });

    it('passes additional props to the button element', () => {
        render(<Button type="submit" id="test-button">Submit</Button>);
        const button = screen.getByRole('button', { name: /submit/i });
        expect(button).toHaveAttribute('type', 'submit');
        expect(button).toHaveAttribute('id', 'test-button');
    });
});
