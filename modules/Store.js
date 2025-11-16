// modules/Store.js: Zentrales State Management (Pub/Sub)

import { Debug } from './Debug.js';

export class Store {
    constructor() {
        // Der "Single Source of Truth"
        this.state = {
            rawDevices: [],         // Rohdaten aus der JSON
            classifiedDevices: [],  // Daten nach Klassifizierung
            currentFilter: {},      // Aktuelle Filter-Einstellungen der UI
            selectedDevice: null    // Das Gerät, das im Deep Dive angezeigt wird
        };
        
        // Liste der Subscriber (Observer-Pattern)
        this.subscribers = {}; // z.B. { 'rawDevicesUpdated': [callback1, callback2] }

        Debug.log("Store: Initialisiert.");
    }

    /**
     * Ein Modul (z.B. UI) registriert sich für ein bestimmtes Event
     * @param {string} event - Das Event, auf das gehört werden soll (z.B. 'stateChanged')
     * @param {function} callback - Die Funktion, die bei dem Event aufgerufen wird
     */
    subscribe(event, callback) {
        // (Implementierung folgt in Schritt 2)
        Debug.log(`Store: Neue Subscription für Event [${event}]`);
    }

    /**
     * Internes Benachrichtigungs-System
     * @param {string} event - Das Event, das ausgelöst wird
     * @param {*} data - Die Daten, die an die Subscriber übergeben werden
     */
    notify(event, data) {
        // (Implementierung folgt in Schritt 2)
        Debug.log(`Store: Notify Event [${event}]`);
    }

    // --- STATE SETTER ---
    // Alle Änderungen am State MÜSSEN über diese Funktionen laufen,
    // damit wir das "notify" nicht vergessen.

    /**
     * Setzt die Rohdaten und benachrichtigt alle Subscriber.
     * @param {Array} devices - Die geparsten Geräte aus der JSON
     */
    setRawDevices(devices) {
        this.state.rawDevices = devices;
        Debug.log(`Store: ${devices.length} Roh-Geräte gesetzt.`);
        // Benachrichtige alle, die 'rawDevicesUpdated' abonniert haben
        this.notify('rawDevicesUpdated', this.state.rawDevices);
    }
    
    // (Weitere Setter für classifiedDevices, selectedDevice etc. folgen hier)
}
