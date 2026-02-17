import { GoogleGenerativeAI } from '@google/generative-ai';
import { InvoiceMetadata, DocumentAnalysisResult } from './types';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set');
}
const genAI = new GoogleGenerativeAI(apiKey || '');

const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: "application/json" }
});

export async function analyzeEmail(subject: string, body: string, sender: string, attachmentNames: string[] = []): Promise<InvoiceMetadata> {
    const prompt = `
  ANALYZUJ TENTO E-MAIL:
  Od: ${sender}
  Předmět: ${subject}
  Přílohy: ${attachmentNames.length > 0 ? attachmentNames.join(', ') : '(Žádné)'}
  Text: ${body.substring(0, 5000)}

  Jsi expertní AI asistent pro automatizaci účetnictví. Tvým úkolem je klasifikovat příchozí e-maily a připravit metadata pro účetní systém.

  **KONTEXT TVÝCH FIREM (Odběratelé):**
  Musíš identifikovat, pro koho je dokument určen:
  1. FIRMA_A: "Lumegro s.r.o." (IČ: 08827877) -> Identifikátor: "firma_a"
  2. FIRMA_B: "Lumenica Derm & Med, s.r.o." (IČ: 17904544) -> Identifikátor: "firma_b"

  *Pokud si nejsi jistý nebo firma není uvedena, použij "unknown".*

  ---

  ### PRAVIDLA ANALÝZY:

  **1. TYP DOKUMENTU (document_type):**
  Analyzuj předmět a text. Rozhodni o typu dokumentu s nejvyšší přesností:
  - **"invoice"**: Běžná faktura, daňový doklad, vyúčtování.
  - **"proforma"**: Zálohová faktura, výzva k platbě, proforma, nedaňový doklad. (Hledej klíčová slova: "záloha", "výzva", "proforma").
  - **"credit_note"**: Dobropis, opravný daňový doklad (často zmiňuje "dobropis" nebo zápornou částku).
  - **"receipt"**: Účtenka (např. z platebního terminálu, Bolt, Uber).
  - **"false"**: Reklamní e-maily, potvrzení objednávky BEZ faktury, WHOIS notifikace, spam, newslettery.

  **2. IDENTIFIKACE STRAN:**
  - **Provider:** Identifikuj dodavatele (např. "alza", "t-mobile", "shoptet").
  - **My Company:** Identifikuj příjemce (firma_a / firma_b) dle kontextu (např. adresa v patičce, oslovení).

   **3. TYP OBSAHU A LOKACE SOUBORU (Priorita):**
   Musíš určit, kde se dokument nachází, abysme ho mohli stáhnout.
      A) **"attachment"**: Pokud seznam "Přílohy" obsahuje soubory s názvy jako "faktura", "invoice", "doklad", "účtenka", "receipt", "platba", NEBO pokud text e-mailu naznačuje, že faktura je přiložena. **Top Priorita:** Pokud vidíš přílohu "faktura.pdf", MUSÍŠ vrátit "attachment", i kdyby byl text e-mailu prázdný.
      B) **"link"**: Pouze pokud NENÍ zmíněna příloha (ani v seznamu příloh), hledej odkaz ke stažení samotného dokladu.
      C) **"none"**: Pokud není ani příloha, ani odkaz na stažení.

  **4. EXTRAKCE URL (Pouze pro typ "link"):**
  Pokud je typ "link", extrahuj POUZE přímý odkaz na stažení/zobrazení dokladu.
     - **BLACKLIST (Ignoruj):** Platební brány ("pay", "gopay", "stripe", "checkout", "úhrada"), přihlášení ("login", "signin", "reset"), podpora/reklama.
     - **WHITELIST (Hledej):** Odkazy v kontextu slov: "stáhnout", "zobrazit", "pdf", "doklad", "faktura", "download", "view", "print".
     - **Logika:** Pokud najdeš jen tlačítko "Zaplatit" a žádné "Stáhnout", nastav "invoice_url": null a "content_type": "none" (nebo "attachment", pokud tam je). Nikdy nevracej platební bránu jako fakturu.

   **5. VÝBĚR SOUBORŮ (relevant_files):**
   Ze seznamu "Přílohy" vyber POUZE ty soubory, které jsou fakturami, účtenkami nebo dobropisy.
   - Hledej názvy jako: "faktura", "invoice", "doklad", "účtenka", "receipt", "billing".
   - Ignoruj: "logo.png", "icon.png", "obchodni_podminky.pdf", "manual.pdf", "zasilkovna.pdf" (pokud je to jen štítek).
   - Pokud si nejsi jistý a soubor je PDF/obrázek a vypadá jako hlavní dokument, zařaď ho.
   - Vrať seznam PŘESNÝCH názvů souborů.

   **6. SUMARIZACE:**
   Vytvoř stručné shrnutí obsahu emailu (1 věta).

  ---

  ### VÝSTUPNÍ FORMÁT (JSON Only):
  Vrať pouze validní JSON objekt.

  \`\`\`json
  {
    "document_type": "invoice | proforma | credit_note | receipt | false",
    "my_company_identifier": "firma_a | firma_b | unknown",
    "provider": "string",
    "content_type": "attachment | link | none",
    "invoice_url": "string | null",
    "summary": "string",
    "relevant_files": ["filename1.pdf", "filename2.pdf"]
  }
  \`\`\`
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up potential markdown formatting
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        // Handle case where model returns an array
        if (Array.isArray(data)) {
            data = data[0];
        }

        // Enrich with computed alias
        data.is_invoice = ['invoice', 'proforma', 'credit_note', 'receipt'].includes(data.document_type);
        // Ensure relevant_files exists
        if (!data.relevant_files) {
            data.relevant_files = [];
        }

        return data;
    } catch (error) {
        console.error('Error analyzing email with Gemini:', error);
        // Return safe default
        return {
            document_type: 'false',
            my_company_identifier: 'unknown',
            provider: 'unknown',
            content_type: 'none',
            invoice_url: null,
            summary: 'Error during analysis',
            relevant_files: [],
            is_invoice: false
        };
    }
}

export async function analyzeDocument(fileBuffer: Buffer, mimeType: string): Promise<DocumentAnalysisResult> {
    const prompt = `
    Jsi expertní účetní AI. Tvým úkolem je vizuálně analyzovat tento dokument a rozhodnout, zda se jedná o validní účetní doklad (faktura, účtenka, dobropis).
    
    IGNORE:
    - Přepravní štítky (Zásilkovna, PPL, DPD, Balíkovna, GLS) -> NEJSOU doklady.
    - Reklamní letáky, loga, ikony -> NEJSOU doklady.
    - Smluvní podmínky, návody -> NEJSOU doklady.

    Analyze thoroughly. Look for:
    - Slova "Faktura", "Daňový doklad", "Invoice", "Receipt", "Účtenka".
    - Částky k úhradě, datum vystavení, IČ/DIČ dodavatele.

    Vrať JSON:
    {
        "is_invoice": boolean,
        "document_type": "invoice" | "receipt" | "credit_note" | "other",
        "reason": "stručné vysvětlení (např. 'Obsahuje slovo Faktura a částku', nebo 'Jedná se o přepravní štítek')"
    }
    `;

    try {
        const imagePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        if (Array.isArray(data)) data = data[0];

        return {
            is_invoice: data.is_invoice,
            document_type: data.document_type || 'other',
            reason: data.reason || 'AI Analysis'
        };

    } catch (error) {
        console.error('Error analyzing document content:', error);
        return {
            is_invoice: false,
            document_type: 'other',
            reason: `Error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
