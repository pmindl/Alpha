import axios from 'axios';
import { parseStringPromise, Builder } from 'xml2js';

const API_KEY = process.env.PACKETA_API_KEY;
const API_PASSWORD = process.env.PACKETA_API_PASSWORD;
const API_URL = process.env.PACKETA_API_URL || 'https://www.zasilkovna.cz/api/rest';

export interface PacketStatus {
    dateTime: string;
    statusCode: string;
    statusText: string;
    branchId: string;
    destinationBranchId: string;
    externalTrackingCode: string;
}

export async function trackPacket(packetId: string): Promise<PacketStatus | null> {
    if (!API_PASSWORD) {
        console.warn("⚠️ PACKETA_API_PASSWORD not set. Tracking disabled.");
        return null;
    }

    try {
        // Construct XML Request for packetStatus
        const builder = new Builder({ headless: true, renderOpts: { pretty: false } });
        const xmlRequest = builder.buildObject({
            packetStatus: {
                apiPassword: API_PASSWORD,
                packetId: packetId
            }
        });

        // Send Request
        const response = await axios.post(API_URL, xmlRequest, {
            headers: { 'Content-Type': 'application/xml' }
        });

        // Parse XML Response
        const result = await parseStringPromise(response.data, { explicitArray: false });

        // Check for faults
        if (result.response && result.response.fault) {
            console.error("❌ Packeta API Fault:", result.response.fault);
            return null;
        }

        /* 
           Expected structure (simplified):
           <response>
             <dateTime>...</dateTime>
             <statusCode>...</statusCode>
             ...
           </response>
        */
        const data = result.response;
        if (!data) return null;

        return {
            dateTime: data.dateTime,
            statusCode: data.statusCode,
            statusText: data.statusText,
            branchId: data.branchId,
            destinationBranchId: data.destinationBranchId,
            externalTrackingCode: data.externalTrackingCode
        };

    } catch (error) {
        console.error("❌ Error tracking packet:", error);
        return null;
    }
}
