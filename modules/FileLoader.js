// modules/FileLoader.js: Kümmert sich um Datei-Upload und Parsing

import { Debug } from './Debug.js';

export class FileLoader {
    constructor(store) {
        this.store = store; // Referenz auf den zentralen Store
        this.fileLoaderUI = null; // Wird in initialize() gesetzt
        this.dropZone = null;
        this.fileInput = null;
        Debug.log("FileLoader: Initialisiert.");
    }

    /**
     * Initialisiert die UI-Elemente (z.B. Drop-Zone-Listener)
     */
    initialize() {
        // Holt sich die DOM-Elemente, die von UI.js gerendert wurden
        this.fileLoaderUI = document.getElementById('file-loader-ui');
        this.dropZone = this.fileLoaderUI.querySelector('#drop-zone');
        this.fileInput = this.fileLoaderUI.querySelector('#file-input');

        if (!this.dropZone || !this.fileInput) {
            Debug.error("FileLoader: Kritische UI-Elemente (drop-zone, file-input) nicht gefunden.");
            return;
        }
        
        // Verhindert Standardverhalten des Browsers (wichtig für Drag & Drop)
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.preventDefaults.bind(this), false);
        });

        // Visuelles Feedback für Drag & Drop
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.highlightDropZone.bind(this), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.unhighlightDropZone.bind(this), false);
        });

        // Event-Handler für das Ablegen der Datei
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
        
        // Event-Handler für den Fallback-Input
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this), false);
        
        Debug.log("FileLoader: UI-Listener sind initialisiert.");
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlightDropZone() {
        this.dropZone.classList.add('active');
    }

    unhighlightDropZone() {
        this.dropZone.classList.remove('active');
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Verarbeitet die ausgewählte Datei (Validierung, Lesen, Parsen).
     * @param {File} file
     */
    async processFile(file) {
        Debug.log(`FileLoader: Verarbeite Datei "${file.name}"...`);

        // 1. Status im Store setzen (UI wird reagieren)
        this.store.setIsLoading(true);
        this.store.setErrorMessage(null); // Alten Fehler löschen

        // 2. Dateityp-Validierung
        if (file.type !== 'application/json') {
            Debug.warn(`FileLoader: Ungültiger Dateityp (${file.type})`);
            this.store.setErrorMessage("Fehler: Es werden nur .json-Dateien akzeptiert.");
            this.store.setIsLoading(false);
            return;
        }

        // 3. Datei lesen (asynchron)
        try {
            const fileContent = await file.text();
            
            // 4. JSON parsen
            const jsonData = JSON.parse(fileContent);
            
            // --- NEU: DEBUG-LOG ---
            // Zeigt uns die exakte Struktur Ihrer JSON-Daten
            Debug.log("FileLoader: JSON-Daten geparst:", jsonData);
            // ---------------------

            // 5. (Optional) Daten-Validierung (prüfen, ob es unsere BLE-Scan-Struktur ist)
            if (!this.isValidScanData(jsonData)) {
                // --- NEU: DEBUG-LOG ---
                Debug.warn("FileLoader: Validierung (isValidScanData) fehlgeschlagen!");
                // ---------------------
                throw new Error("Die JSON-Datei hat nicht die erwartete Scan-Protokoll-Struktur. (isValidScanData = false)");
            }

            // 6. Erfolg: Daten an den Store übergeben
            Debug.log("FileLoader: Datei erfolgreich geparst. Setze Rohdaten im Store.");
            
            // !! ACHTUNG: DIES IST DIE WAHRSCHEINLICHSTE FEHLERQUELLE !!
            // Wir nehmen an, die Daten sind in 'jsonData.devices'.
            // Wenn Ihre JSON direkt ein Array ist, muss dies 'jsonData' sein.
            this.store.setRawDevices(jsonData.devices || []); 
            
        } catch (error) {
            Debug.error("FileLoader: Fehler beim Lesen/Parsen der Datei.", error);
            this.store.setErrorMessage(`Parsing-Fehler: ${error.message}`);
        } finally {
            // 7. Lade-Status im Store beenden
            this.store.setIsLoading(false);
            // Input-Feld zurücksetzen, um dieselbe Datei erneut laden zu können
            this.fileInput.value = ""; 
        }
    }
    
    /**
     * Simples Validierungs-Schema
     * @param {object} data
     */
    isValidScanData(data) {
        // Hier prüfen wir, ob die JSON-Struktur unseren Erwartungen entspricht.
        // Annahme: Es ist ein Objekt mit einem 'devices'-Array.
        // WENN IHRE JSON NUR EIN ARRAY IST: Ändern Sie dies zu 'return Array.isArray(data);'
        return data && Array.isArray(data.devices);
    }
}
