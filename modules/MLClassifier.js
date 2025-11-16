// modules/MLClassifier.js: Klassifiziert Geräte (FTF, Consumer, Irrelevant)

import { Debug } from './Debug.js';

// --- Das "Regel-Modell" ---
// Diese Listen definieren unsere Klassifizierungsregeln.
// In einer echten App wären sie komplexer oder würden vom Server geladen.

// Bekannte FTF-Hersteller (basierend auf 'company' String)
const FTF_COMPANIES = [
    'linde material handling',
    'kion group',
    'jungheinrich ag',
    'toyota material handling',
    'dematic',
    'omron corporation' // Beispiel für FTF-Zulieferer
];

// Bekannte Consumer-Geräte-Hersteller
const CONSUMER_COMPANIES = [
    'apple, inc.',
    'samsung electronics co., ltd.',
    'google',
    'microsoft',
    'bose corporation',
    'sony corporation',
    'tile, inc.'
];

// Bekannte FTF-spezifische Payload-Präfixe
const FTF_PAYLOAD_PREFIXES = [
    '06c5', // Beispiel: Cypress-Kennung, die wir als FTF definieren
    '09a1'  // Beispiel: Ein fiktiver FTF-spezifischer Header
];
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
            
            // Wir erstellen ein *neues* Objekt, das alle alten Daten
            // und die neue Klassifizierungsinformation enthält.
            return {
                ...device, // Kopiert alle Felder (id, name, rssiGraph, rawDataPayload etc.)
                classification: classification // Fügt das Klassifizierungsergebnis hinzu
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
        
        // 1a: Check nach Herstellername
        if (company && FTF_COMPANIES.some(ftfCompany => company.includes(ftfCompany))) {
            return "FTF";
        }
        
        // 1b: Check nach Payload-Präfix
        if (payload && FTF_PAYLOAD_PREFIXES.some(prefix => payload.startsWith(prefix))) {
            return "FTF";
        }

        // Regel 2: Consumer-Check
        if (company && CONSUMER_COMPANIES.some(consCompany => company.includes(consCompany))) {
            return "Consumer";
        }
        
        // Regel 3: Fallback (Weder FTF noch bekanntes Consumer-Gerät)
        return "Irrelevant";
    }
}
