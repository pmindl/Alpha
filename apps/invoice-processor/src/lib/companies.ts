import { CompanyConfig } from './types';

let cachedCompanies: CompanyConfig[] | null = null;

/**
 * Resets the cached companies configuration.
 * Useful for testing when environment variables change.
 */
export function resetCache(): void {
    cachedCompanies = null;
}

export function getCompanies(): CompanyConfig[] {
    if (cachedCompanies) {
        return cachedCompanies;
    }

    const companyIds = (process.env.COMPANIES || '').split(',').filter(Boolean);

    cachedCompanies = companyIds.map(id => {
        const prefix = `COMPANY_${id.toUpperCase()}`;
        return {
            id: id,
            name: process.env[`${prefix}_NAME`] || '',
            ico: process.env[`${prefix}_ICO`] || '',
            gdriveFolderId: process.env[`${prefix}_GDRIVE_FOLDER`] || '',
            sfClientId: process.env[`${prefix}_SF_CLIENT_ID`] || '',
            emailPatterns: (process.env[`${prefix}_EMAIL_PATTERNS`] || '').split(',').filter(Boolean)
        };
    });

    return cachedCompanies;
}

export function getCompanyById(id: string): CompanyConfig | undefined {
    return getCompanies().find(c => c.id === id);
}

export function detectCompany(text: string): string | undefined {
    const companies = getCompanies();
    const lowerText = text.toLowerCase();

    for (const company of companies) {
        if (company.emailPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))) {
            return company.id;
        }
    }
    return undefined;
}
