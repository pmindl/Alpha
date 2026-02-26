import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './page'

// Mock the fetch API
global.fetch = vi.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve([]),
    })
) as any

// Mock child components to simplify testing
vi.mock('@/components/Dashboard', () => ({
    StatsCards: () => <div data-testid="stats-cards" />,
    ActionBar: () => <div data-testid="action-bar" />,
}))
vi.mock('@/components/InvoiceTable', () => ({
    InvoiceTable: () => <div data-testid="invoice-table" />,
}))
vi.mock('@/components/UploadZone', () => ({
    UploadZone: () => <div data-testid="upload-zone" />,
}))

test('Page renders correctly', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice Processor' })).toBeDefined()
})
