// Konfiguracja połączenia z Supabase
const SUPABASE_URL = "https://nztwxymmuwecvymbtrgt.supabase.co"; 
// !!! TUTAJ WKLEJ SWÓJ KLUCZ ANON KEY Z SUPABASE !!!
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dHd4eW1tdXdlY3Z5bWJ0cmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODYwMjUsImV4cCI6MjA5NjY2MjAyNX0.4tbqTfSamJp3l7x5z0xmliFiNFgguWIDfgLRZsz1GwY"; 

// Poprawne stworzenie klienta (nie wywołuje już błędu o duplikacji zmiennej)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Po załadowaniu strony uruchom pobieranie danych
document.addEventListener("DOMContentLoaded", () => {
    wczytajTaryfikator();
    wczytajPoszukiwania();
});

// 1. Obsługa przełączania zakładek w menu
function switchTab(tabName) {
    // Ukryj wszystkie zakładki
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Pokaż wybraną zakładkę
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// 2. Obsługa paska narzędzi edytora Word
function formatuj(komenda, wartosc = null) {
    document.execCommand(komenda, false, wartosc);
    document.getElementById('wordEditor').focus();
}

// 3. Pobieranie taryfikatora z Supabase
async function wczytajTaryfikator() {
    const listaDiv = document.getElementById("taryfikator-lista");
    
    const { data, error } = await supabaseClient
        .from("taryfikator")
        .select("*");

    if (error) {
        listaDiv.innerHTML = "<p style='color:red;'>Błąd ładowania danych z bazy.</p>";
        console.error(error);
        return;
    }

    if (data.length === 0) {
        listaDiv.innerHTML = "<p>Brak pozycji w taryfikatorze.</p>";
        return;
    }

    let html = "<ul>";
    data.forEach(item => {
        html += `<li><strong>${item.nazwa}</strong> - ${item.grzywna}$ | ${item.wiezienie} mies. (${item.kategoria})</li>`;
    });
    html += "</ul>";
    listaDiv.innerHTML = html;
}

// 4. Pobieranie poszukiwanych i wyświetlanie ich z opcją Pełnego Ekranu
async function wczytajPoszukiwania() {
    const listaDiv = document.getElementById("poszukiwani-lista");
    
    const { data, error } = await supabaseClient
        .from("poszukiwania")
        .select("*")
        .order('id', { ascending: false });

    if (error) {
        listaDiv.innerHTML = "<p style='color:red;'>Błąd ładowania poszukiwanych.</p>";
        return;
    }

    if (!data || data.length === 0) {
        listaDiv.innerHTML = "<p>Brak aktywnych poszukiwań w systemie.</p>";
        return;
    }

    let html = "";
    data.forEach(wpis => {
        html += `
            <div class="poszukiwany-card">
                <h2>👤 Wpis: ${wpis.tytul || 'Brak tytułu'}</h2>
                <div class="tresc-wpisu" style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                    ${wpis.tresc}
                </div>
                <button onclick="openFullscreen(this.parentElement.innerHTML)">Powiększ na cały ekran 🔍</button>
            </div>
        `;
    });
    listaDiv.innerHTML = html;
}

// 5. Wysyłanie sformatowanego tekstu Worda do Supabase
async function dodajPoszukiwanie() {
    const tytulInput = document.getElementById("poszukiwany-tytul").value;
    // POBIERAMY .innerHTML ZAMIAST .value - dzięki temu zapisujemy kolory, listy i pogrubienia!
    const trescHTML = document.getElementById("wordEditor").innerHTML;

    if (!tytulInput || !trescHTML || trescHTML === "<br>" || trescHTML.trim() === "") {
        alert("Uzupełnij tytuł oraz treść wpisu!");
        return;
    }

    const { error } = await supabaseClient
        .from("poszukiwania")
        .insert([{ tytul: tytulInput, tresc: trescHTML }]);

    if (error) {
        alert("Błąd podczas zapisu w bazie danych Supabase!");
        console.error(error);
    } else {
        alert("Pomyślnie dodano poszukiwanego!");
        // Czyszczenie pól formularza
        document.getElementById("poszukiwany-tytul").value = "";
        document.getElementById("wordEditor").innerHTML = "";
        // Odświeżenie listy wpisów na ekranie
        wczytajPoszukiwania();
    }
}

// 6. Funkcje okna pełnoekranowego (Modal)
function openFullscreen(contentHTML) {
    const modalContent = document.getElementById('fullscreenContent');
    modalContent.innerHTML = contentHTML;
    
    // Ukrywamy przycisk "Powiększ na cały ekran" wewnątrz samego okna, żeby nie dublować go w podglądzie
    const btnInModal = modalContent.querySelector('button');
    if(btnInModal) btnInModal.style.display = 'none';

    document.getElementById('fullscreenModal').style.display = 'block';
}

function closeFullscreen() {
    document.getElementById('fullscreenModal').style.display = 'none';
}