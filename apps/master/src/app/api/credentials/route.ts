import { NextRequest, NextResponse } from "next/server";
import { getVaultManager } from "../../../lib/managers";
import { z } from "zod";

const CredentialSchema = z.object({
    id: z.string(),
    value: z.string(),
    scopes: z.array(z.string()).default(['global']),
    description: z.string().default(''),
    provider: z.string().default('manual'),
    service: z.string().default('user')
});

export async function GET() {
    try {
        const vault = getVaultManager();
        const credentials = vault.listCredentials();
        return NextResponse.json(credentials);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = CredentialSchema.parse(body);

        const credential = {
            id: parsed.id,
            value: parsed.value,
            scopes: parsed.scopes,
            description: parsed.description,
            metadata: {
                provider: parsed.provider,
                service: parsed.service
            },
            updatedAt: new Date().toISOString()
        };

        const vault = getVaultManager();
        vault.addCredential(credential);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }
        const vault = getVaultManager();
        const removed = vault.removeCredential(id);
        if (removed) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Credential not found" }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
