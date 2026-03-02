import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './page'

// Mock the MCP client
vi.mock('../lib/mcp', () => ({
    getMcpClient: vi.fn(() => ({
        callTool: vi.fn(() => Promise.resolve({
            content: [{ type: 'text', text: '{"user":"test"}' }]
        }))
    }))
}))

// Mock child components
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

test('Page renders correctly', async () => {
    // Page is an async Server Component, so we must await it
    const Result = await Page()
    render(Result)
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice Processor' })).toBeDefined()
})
