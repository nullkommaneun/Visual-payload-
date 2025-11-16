// modules/Store.js: Zentrales State Management (Pub/Sub)

import { Debug } from './Debug.js';

export class Store {
    constructor() {
        // Der "Single Source of Truth"
        this.state = {
            rawDevices: [],
            classifiedDevices: [],  // Daten nach Klassifizierung
            currentFilter: {},
            selectedDevice: null,
            // UI-Zustände
            isLoading: false,
            errorMessage: null
        };
        
        // Liste der Subscriber (Observer-Pattern)
        // { eventName: [callback1, callback2], ... }
        this.subscribers = {}; 

        Debug.log("Store: Initialisiert.");
    }

    /**
     * Ein Modul (z.B. UI) registriert sich für ein bestimmtes Event
     * @param {string} event - Das Event, auf das gehört werden soll (z.B. 'loadingChanged')
     * @param {function} callback - Die Funktion, die bei dem Event aufgerufen wird
     */
    subscribe(event, callback) {
        if (!this.subscribers[event]) {
            this.subscribers[event] = [];
        }
        this.subscribers[event].push(callback);
        Debug.log(`Store: Neue Subscription für Event [${event}]`);
    }

    /**
     * Internes Benachrichtigungs-System
     * @param {string} event - Das Event, das ausgelöst wird
     * @param {*} data - Die Daten, die an die Subscriber übergeben werden
     */
    notify(event, data) {
        if (!this.subscribers[event]) {
            return; // Kein Subscriber für dieses Event
        }
        Debug.log(`Store: Notify Event [${event}]`);
        // Rufe jeden Subscriber für dieses Event auf
        this.subscribers[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                Debug.error(`Fehler im Subscriber für Event [${event}]:`, error);
            }
        });
    }

    // --- STATE SETTER (Mutations) ---

    /**
     * Setzt die Rohdaten und benachrichtigt alle Subscriber.
     * @param {Array} devices - Die geparsten Geräte aus der JSON
     */
    setRawDevices(devices) {
        this.state.rawDevices = devices;
        this.state.classifiedDevices = []; // Alte Klassifizierung zurücksetzen
        this.state.selectedDevice = null;   // Auswahl zurücksetzen
        
        Debug.log(`Store: ${devices.length} Roh-Geräte gesetzt.`);
        
        this.notify('rawDevicesUpdated', this.state.rawDevices);
    }
    
    /**
     * NEU: Setzt die klassifizierten Daten und benachrichtigt die UI.
     * @param {Array} devices - Die Geräte inkl. 'classification'-Feld
     */
    setClassifiedDevices(devices) {
        this.state.classifiedDevices = devices;
        Debug.log(`Store: ${devices.length} klassifizierte Geräte gesetzt.`);
        
        // Benachrichtige die UI, dass sie die Liste neu zeichnen kann
        this.notify('classifiedDevicesUpdated', this.state.classifiedDevices);
    }
    
    /**
     * Setzt den globalen Lade-Status (z.B. für Datei-Upload).
     * @param {boolean} isLoading
     */
    setIsLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notify('loadingChanged', this.state.isLoading);
    }
    
    /**
     * Setzt eine Fehlermeldung, die der UI angezeigt werden kann.
     * @param {string | null} message
     */
    setErrorMessage(message) {
        this.state.errorMessage = message;
        this.notify('errorOccurred', this.state.errorMessage);
    }
    
    // (Weitere Setter für selectedDevice etc. folgen hier)
}
