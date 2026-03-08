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
    DashboardHeader: () => <div data-testid="dashboard-header" />,
}))
vi.mock('@/components/InvoiceTable', () => ({
    InvoiceTable: () => <div data-testid="invoice-table" />,
}))
vi.mock('@/components/UploadZone', () => ({
    UploadZone: () => <div data-testid="upload-zone" />,
}))

test('Page renders correctly', async () => {
    render(<Page />)
    expect(screen.getByTestId('dashboard-header')).toBeDefined()
})
