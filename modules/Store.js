// modules/Store.js: Zentrales State Management (Pub/Sub)

import { Debug } from './Debug.js';

export class Store {
    constructor() {
        // Der "Single Source of Truth"
        this.state = {
            rawDevices: [],
            classifiedDevices: [],
            // NEU: Filter-Status
            currentFilter: {
                showFTF: true,
                showConsumer: true,
                showIrrelevant: false // Irrelevante standardmäßig ausblenden
            },
            // NEU: Für Deep Dive Ansicht
            selectedDevice: null,
            
            // UI-Zustände
            isLoading: false,
            errorMessage: null
        };
        
        // Liste der Subscriber (Observer-Pattern)
        this.subscribers = {}; 

        Debug.log("Store: Initialisiert.");
    }

    /**
     * Ein Modul (z.B. UI) registriert sich für ein bestimmtes Event
     * @param {string} event - Das Event, auf das gehört werden soll
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
            return;
        }
        Debug.log(`Store: Notify Event [${event}]`);
        this.subscribers[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                Debug.error(`Fehler im Subscriber für Event [${event}]:`, error);
            }
        });
    }

    // --- STATE SETTER (Mutations) ---

    setRawDevices(devices) {
        this.state.rawDevices = devices;
        this.state.classifiedDevices = []; 
        this.state.selectedDevice = null;   
        
        Debug.log(`Store: ${devices.length} Roh-Geräte gesetzt.`);
        this.notify('rawDevicesUpdated', this.state.rawDevices);
    }
    
    setClassifiedDevices(devices) {
        this.state.classifiedDevices = devices;
        Debug.log(`Store: ${devices.length} klassifizierte Geräte gesetzt.`);
        this.notify('classifiedDevicesUpdated', this.state.classifiedDevices);
    }
    
    /**
     * NEU: Setzt einen neuen Filter-Status und benachrichtigt die UI
     * @param {object} filterUpdate - z.B. { showConsumer: true }
     */
    setFilter(filterUpdate) {
        this.state.currentFilter = { ...this.state.currentFilter, ...filterUpdate };
        Debug.log(`Store: Filter aktualisiert`, this.state.currentFilter);
        
        // Benachrichtigt die UI, die Liste neu zu zeichnen
        this.notify('filterChanged', this.state.currentFilter);
    }
    
    /**
     * NEU: Setzt das aktuell ausgewählte Gerät für den Deep Dive
     * @param {string} deviceId - Die ID des ausgewählten Geräts
     */
    setSelectedDevice(deviceId) {
        const device = this.state.classifiedDevices.find(d => d.id === deviceId) || null;
        
        this.state.selectedDevice = device;
        Debug.log(`Store: Gerät ausgewählt`, device);
        
        this.notify('selectedDeviceUpdated', this.state.selectedDevice);
    }

    setIsLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notify('loadingChanged', this.state.isLoading);
    }
    
    setErrorMessage(message) {
        this.state.errorMessage = message;
        this.notify('errorOccurred', this.state.errorMessage);
    }
}
