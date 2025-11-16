// modules/MLClassifier.js: Klassifiziert Geräte (FTF, Consumer, Irrelevant)

import { Debug } from './Debug.js';

// --- Das "Regel-Modell" ---
const FTF_COMPANIES = [ /* ... (unverändert) ... */ ];
const CONSUMER_COMPANIES = [ /* ... (unverändert) ... */ ];
const FTF_PAYLOAD_PREFIXES = [ /* ... (unverändert) ... */ ];
// -----------------------------


export class MLClassifier {
    constructor(store) {
        this.store = store;
        Debug.log("MLClassifier: Initialisiert.");
    }

    /**
     * Registriert die notwendigen Listener beim Store.
     */
    initialize() {
        Debug.log("MLClassifier: Abonniert Store-Event 'rawDevicesUpdated'.");
        
        // Abonniert den Store. Wenn neue Rohdaten da sind, starte Klassifizierung
        this.store.subscribe('rawDevicesUpdated', (devices) => {
            // --- NEU: DEBUG-LOG ---
            Debug.log(`MLClassifier: Event 'rawDevicesUpdated' EMPFANGEN. Starte Klassifizierung für ${devices.length} Geräte.`, devices);
            // ---------------------
            this.classifyDevices(devices);
        });
    }
    
    /**
     * Führt die regelbasierte Klassifizierung durch.
     * @param {Array} devices - Die Roh-Geräte aus dem Store
     */
    classifyDevices(devices) {
        if (!devices || devices.length === 0) {
            Debug.log("MLClassifier: Keine Geräte zum Klassifizieren vorhanden.");
            this.store.setClassifiedDevices([]); // Leeres Array setzen
            return;
        }

        Debug.log(`MLClassifier: Klassifiziere ${devices.length} Geräte...`);
        
        const startTime = performance.now();

        const classifiedDevices = devices.map(device => {
            const classification = this.applyRules(device);
            
            return {
                ...device, 
                classification: classification 
            };
        });
        
        const duration = performance.now() - startTime;
        Debug.log(`MLClassifier: Klassifizierung abgeschlossen in ${duration.toFixed(2)}ms.`);
        
        // Ergebnis in den Store schreiben
        this.store.setClassifiedDevices(classifiedDevices);
    }

    /**
     * Wendet das Regel-Set auf ein einzelnes Gerät an.
     * @param {object} device - Ein einzelnes Gerät aus den Rohdaten
     * @returns {string} - "FTF", "Consumer" oder "Irrelevant"
     */
    applyRules(device) {
        const company = (device.company || '').toLowerCase();
        const payload = (device.rawDataPayload || '').toLowerCase();

        // Regel 1: FTF-Check (höchste Priorität)
        if (company && FTF_COMPANIES.some(ftfCompany => company.includes(ftfCompany))) {
            return "FTF";
        }
        if (payload && FTF_PAYLOAD_PREFIXES.some(prefix => payload.startsWith(prefix))) {
            return "FTF";
        }

        // Regel 2: Consumer-Check
        if (company && CONSUMER_COMPANIES.some(consCompany => company.includes(consCompany))) {
            return "Consumer";
        }
        
        // Regel 3: Fallback
        return "Irrelevant";
    }
}
