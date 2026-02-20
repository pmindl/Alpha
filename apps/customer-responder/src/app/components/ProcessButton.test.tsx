import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProcessButton from './ProcessButton';

describe('ProcessButton', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        global.fetch = vi.fn();
    });

    it('renders the button correctly', () => {
        render(<ProcessButton />);
        const button = screen.getByRole('button', { name: /Run Analysis & Draft/i });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
    });

    it('handles loading state and successful processing', async () => {
        const mockResponse = { result: 'success' };
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockResponse)
        });

        render(<ProcessButton />);
        const button = screen.getByRole('button', { name: /Run Analysis & Draft/i });

        fireEvent.click(button);

        // Check loading state immediately after click
        expect(button).toHaveTextContent('Processing...');
        expect(button).toBeDisabled();

        // Wait for result
        await waitFor(() => {
            // Because of JSON.stringify formatting, looking for a part of the string
            expect(screen.getByText((content) => content.includes('"result": "success"'))).toBeInTheDocument();
        });

        // Check back to normal state
        expect(button).toHaveTextContent('Run Analysis & Draft');
        expect(button).not.toBeDisabled();

        expect(global.fetch).toHaveBeenCalledWith('/api/process');
    });

    it('handles error state', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        render(<ProcessButton />);
        const button = screen.getByRole('button', { name: /Run Analysis & Draft/i });

        fireEvent.click(button);

        await waitFor(() => {
             expect(screen.getByText((content) => content.includes('"error": "Failed to process"'))).toBeInTheDocument();
        });

        expect(button).not.toBeDisabled();
    });
});
