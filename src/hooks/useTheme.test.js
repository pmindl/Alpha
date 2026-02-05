import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTheme } from '../hooks/useTheme';

describe('useTheme Hook', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
        // Mock matchMedia
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    it('should default to light mode if no preference', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.isDark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should initialize to dark mode from localStorage', () => {
        localStorage.setItem('theme', 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should toggle theme', () => {
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.toggleTheme();
        });

        expect(result.current.isDark).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        act(() => {
            result.current.toggleTheme();
        });

        expect(result.current.isDark).toBe(false);
        expect(localStorage.getItem('theme')).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});
