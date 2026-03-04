import axios from 'axios';
import { parseStringPromise, Builder } from 'xml2js';
import { logErrorSafely } from './logger';

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

/**
 * Track a single packet by its Packeta ID.
 */
export async function trackPacket(packetId: string): Promise<PacketStatus | null> {
    if (!API_PASSWORD) {
        console.warn("⚠️ PACKETA_API_PASSWORD not set. Tracking disabled.");
        return null;
    }

    try {
        const builder = new Builder({ headless: true, renderOpts: { pretty: false } });
        const xmlRequest = builder.buildObject({
            packetStatus: {
                apiPassword: API_PASSWORD,
                packetId: packetId
            }
        });

        const response = await axios.post(API_URL, xmlRequest, {
            headers: { 'Content-Type': 'application/xml' },
            timeout: 10000,
        });

        const result = await parseStringPromise(response.data, { explicitArray: false });

        if (result.response && result.response.fault) {
            console.error("❌ Packeta API Fault:", result.response.fault);
            return null;
        }

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
        logErrorSafely("Error tracking packet", error);
        return null;
    }
}

/**
 * Multi-strategy tracking: collects tracking numbers from WooCommerce orders
 * AND from extracted entities (email body), then tracks all of them.
 *
 * Returns a map of tracking number → status.
 */
export async function trackAllPackets(
    orders: any[],
    entityTrackingNumbers: string[],
): Promise<Map<string, PacketStatus>> {
    const trackingMap = new Map<string, PacketStatus>();

    if (!API_PASSWORD) {
        return trackingMap;
    }

    // Collect all tracking numbers from all sources
    const allTrackingNumbers = new Set<string>();

    // Source 1: WooCommerce order meta_data
    for (const order of orders) {
        const trackingNumber = findTrackingNumber(order);
        if (trackingNumber) {
            allTrackingNumbers.add(trackingNumber);
        }
    }

    // Source 2: Extracted from email body
    for (const tn of entityTrackingNumbers) {
        allTrackingNumbers.add(tn);
    }

    if (allTrackingNumbers.size === 0) {
        return trackingMap;
    }

    // Track all in parallel (with limit to avoid overwhelming API)
    const trackingArray = Array.from(allTrackingNumbers).slice(0, 5); // Max 5 tracking lookups
    const results = await Promise.allSettled(
        trackingArray.map(async (tn) => {
            const status = await trackPacket(tn);
            return { trackingNumber: tn, status };
        })
    );

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.status) {
            trackingMap.set(result.value.trackingNumber, result.value.status);
        }
    }

    return trackingMap;
}

/**
 * Helper to find tracking number in WooCommerce order meta_data.
 */
function findTrackingNumber(order: any): string | null {
    if (order.meta_data) {
        const trackingMeta = order.meta_data.find((m: any) =>
            m.key === '_packet_id' ||
            m.key === 'tracking_number' ||
            m.key === '_tracking_number' ||
            m.key === 'packeta_packet_id' ||
            (m.key && m.key.includes('tracking'))
        );
        if (trackingMeta) return trackingMeta.value;
    }
    return null;
}
