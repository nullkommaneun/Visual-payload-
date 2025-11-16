// modules/PayloadParser.js: Utility-Modul mit reinen Funktionen

import { Debug } from './Debug.js';

export const PayloadParser = {
    
    /**
     * Zerlegt einen rohen Hex-Payload in ein strukturiertes Objekt.
     * @param {string} hexPayload - Der rohe Hex-String (z.B. "06C5...")
     * @returns {object} Ein Objekt mit analysierten Segmenten.
     */
    parsePayload: (hexPayload) => {
        if (!hexPayload) return { error: "Kein Payload vorhanden." };
        
        Debug.log(`PayloadParser: Parse Payload (${hexPayload.substring(0, 10)}...)`);
        
        const segments = {};
        
        // (Regel-Logik zur Zerlegung des Payloads folgt hier)
        // z.B. 
        // if (hexPayload.startsWith('06C5')) { 
        //    segments.prefix = { raw: "06C5", description: "Cypress-Kennung" };
        //    segments.data = { raw: hexPayload.substring(4), description: "Unbekannte Daten" };
        // } else {
        //    segments.unknown = { raw: hexPayload, description: "Unbekannter Payload-Typ" };
        // }

        return segments;
    },

    // (Weitere Hilfsfunktionen, z.B. hexToAscii, hexToDec, etc. folgen)
};
