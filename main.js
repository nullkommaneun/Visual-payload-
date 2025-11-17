// main.js: Der Einstiegspunkt der Anwendung

// --- GEÄNDERT ---
// Wir importieren jetzt 'initializeDebugUI' und 'Debug'
import { Debug, initializeDebugUI } from './modules/Debug.js';
import { Store } from './modules/Store.js';
import { FileLoader } from './modules/FileLoader.js';
import { MLClassifier } from './modules/MLClassifier.js';
import { UI } from './modules/UI.js';

// Globale App-Initialisierung
function initApp() {
    // --- NEU: ERSTER SCHRITT ---
    // Initialisiert das On-Screen-Debug-Fenster, *bevor* der erste Log-Aufruf kommt.
    // Da initApp() selbst auf DOMContentLoaded wartet, sind die Elemente garantiert vorhanden.
    initializeDebugUI(); 
    
    Debug.log("App initialisiert. Starte Module...");
    
    // 1. Store initialisieren
    const store = new Store();

    // 2. Module initialisieren und den Store injizieren
    const fileLoader = new FileLoader(store);
    const classifier = new MLClassifier(store);
    const ui = new UI(store);
    
    // 3. Initial-Setup-Funktionen der Module aufrufen
    fileLoader.initialize(); 
    classifier.initialize(); 
    ui.initialize();
    
    Debug.log("Alle Module sind betriebsbereit.");
}

// Sicherstellen, dass das DOM geladen ist, bevor die App startet
document.addEventListener('DOMContentLoaded', initApp);
