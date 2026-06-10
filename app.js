const SUPABASE_URL = 'https://nztwxymmuwecvymbtrgt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dHd4eW1tdXdlY3Z5bWJ0cmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODYwMjUsImV4cCI6MjA5NjY2MjAyNX0.4tbqTfSamJp3l7x5z0xmliFiNFgguWIDfgLRZsz1GwY';

// Ważne: stała nazywa się supabaseClient, aby nie nadpisywać globalnego obiektu 'supabase' z biblioteki CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let taryfikatorData = [];
let currentUser = null; // Przechowuje dane zalogowanego gracza
let isSheriff = false;

// ============================================
// LOGOWANIE I REJESTRACJA
// ============================================

async function registerOfficer() {
    const discord = document.getElementById('auth-discord').value.trim();
    const icName = document.getElementById('auth-ic').value.trim();
    
    if(!discord || !icName) return alert("Podaj nick Discord oraz Imię i Nazwisko IC!");
    
    // Sprawdzamy czy taki wniosek już istnieje
    const {data: existingUser} = await supabaseClient.from('funkcjonariusze').select('*').eq('discord_nick', discord);
    if(existingUser && existingUser.length > 0) {
        return alert("Ten nick Discord już wysłał wniosek lub posiada aktywne konto.");
    }
    
    // Wysyłamy do bazy
    const {error} = await supabaseClient.from('funkcjonariusze').insert([{
        discord_nick: discord, imie_nazwisko_ic: icName, status: 'oczekujacy'
    }]);
    
    if(!error) {
        alert("Wniosek został wysłany! Poczekaj aż Szeryf zaakceptuje podanie i nada numer odznaki.");
        document.getElementById('auth-discord').value = '';
        document.getElementById('auth-ic').value = '';
    } else {
        console.error(error);
        alert("Wystąpił błąd! Upewnij się, że wyłączyłeś RLS w tabeli funkcjonariusze.");
    }
}

async function loginOfficer() {
    const discord = document.getElementById('auth-discord').value.trim();
    if(!discord) return alert("Podaj nick z Discorda, aby się zalogować!");
    
    const {data, error} = await supabaseClient.from('funkcjonariusze').select('*').eq('discord_nick', discord).single();
    
    if(error || !data) return alert("Nie znaleziono konta z takim nickiem. Najpierw wyślij wniosek!");
    
    if(data.status === 'oczekujacy') return alert("Twój wniosek nadal oczekuje na weryfikację przez dowództwo.");
    if(data.status === 'odrzucony') return alert("Twój wniosek do LSPD/BCSO został odrzucony.");
    
    // Zalogowano pomyślnie
    currentUser = data;
    isSheriff = false;
    openMDT();
}

function loginSheriff() {
    const pin = prompt("Podaj PIN dostępowy dowództwa:");
    if(pin === "7777") { 
        currentUser = { imie_nazwisko_ic: "Szeryf", numer_odznaki: "001" };
        isSheriff = true;
        openMDT();
    } else {
        alert("Błędny PIN!");
    }
}

function openMDT() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('mdt-app').style.display = 'flex';
    
    document.getElementById('logged-user-info').innerText = `[${currentUser.numer_odznaki || '---'}] ${currentUser.imie_nazwisko_ic}`;
    
    if(isSheriff) {
        document.getElementById('btn-tab-szeryf').style.display = 'block';
    } else {
        document.getElementById('btn-tab-szeryf').style.display = 'none';
    }
    
    fetchTaryfikator();
}

// ============================================
// PANEL SZERYFA (WNIOSKI)
// ============================================

async function fetchPendingOfficers() {
    const { data, error } = await supabaseClient.from('funkcjonariusze').select('*').eq('status', 'oczekujacy');
    if (!error) {
        const container = document.getElementById('pending-list');
        if(data.length === 0) { container.innerHTML = '<p>Brak oczekujących wniosków.</p>'; return; }
        
        container.innerHTML = data.map(o => `
            <div class="card" style="border-left: 4px solid #ffcc00;">
                <h3 style="margin-top: 0;">${o.imie_nazwisko_ic}</h3>
                <p><strong>Discord:</strong> ${o.discord_nick}</p>
                <input type="text" id="badge-${o.id}" placeholder="Nadaj numer legitymacji (np. 012)">
                <div style="margin-top: 10px;">
                    <button class="action-btn" style="background:#28a745; width: auto; padding: 10px 20px;" onclick="acceptOfficer('${o.id}')">Akceptuj</button>
                    <button class="delete-btn" style="padding: 10px 20px;" onclick="rejectOfficer('${o.id}')">Odrzuć</button>
                </div>
            </div>
        `).join('');
    }
}

async function acceptOfficer(id) {
    const badgeNumber = document.getElementById(`badge-${id}`).value.trim();
    if(!badgeNumber) return alert("Podaj numer legitymacji, zanim zaakceptujesz wniosek!");
    
    const {error} = await supabaseClient.from('funkcjonariusze').update({
        status: 'zaakceptowany', numer_odznaki: badgeNumber
    }).eq('id', id);
    
    if(!error) {
        alert("Zatwierdzono funkcjonariusza!");
        fetchPendingOfficers();
    }
}

async function rejectOfficer(id) {
    const confirmReject = confirm("Na pewno chcesz odrzucić to podanie?");
    if(confirmReject) {
        const {error} = await supabaseClient.from('funkcjonariusze').update({status: 'odrzucony'}).eq('id', id);
        if(!error) fetchPendingOfficers();
    }
}

// ============================================
// GŁÓWNA LOGIKA FUNKCJONALNA MDT
// ============================================

function switchTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (element) element.classList.add('active');

    if (tabName === 'taryfikator') fetchTaryfikator();
    if (tabName === 'notatki') fetchNotes();
    if (tabName === 'mandaty') fetchTickets();
    if (tabName === 'poszukiwania') fetchBolos();
    if (tabName === 'szeryf') fetchPendingOfficers();
}

async function fetchTaryfikator() {
    const { data, error } = await supabaseClient.from('taryfikator').select('*').order('kategoria', { ascending: true });
    if (!error) {
        taryfikatorData = data;
        renderTaryfikator();
    } else {
        console.error("Błąd pobierania taryfikatora:", error);
    }
}

function renderTaryfikator() {
    const container = document.getElementById('taryfikator-list');
    container.innerHTML = '';
    let currentCat = '';

    if (!taryfikatorData || taryfikatorData.length === 0) {
        container.innerHTML = '<p style="color: #ffcc00;">⚠️ Tabela taryfikatora w bazie danych jest pusta lub zablokowana przez RLS.</p>';
        return;
    }

    taryfikatorData.forEach(item => {
        if (currentCat !== item.kategoria) {
            currentCat = item.kategoria;
            const h2 = document.createElement('h2');
            h2.innerText = currentCat;
            container.appendChild(h2);
        }
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
            <div><strong>${item.nazwa}</strong><br><small>$${item.grzywna} | ${item.wiezienie} m-cy | ${item.akcja_dodatkowa || 'Brak'}</small></div>
            <input type="checkbox" value="${item.id}" onchange="calculateTotal()">
        `;
        container.appendChild(div);
    });
}

function calculateTotal() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    let fine = 0, jail = 0, actions = new Set();

    checkboxes.forEach(cb => {
        const item = taryfikatorData.find(i => String(i.id) === String(cb.value));
        if (item) {
            fine += item.grzywna;
            jail += item.wiezienie;
            if (item.akcja_dodatkowa) actions.add(item.akcja_dodatkowa);
        }
    });
    document.getElementById('total-fine').innerText = fine.toLocaleString();
    document.getElementById('total-jail').innerText = jail;
    document.getElementById('total-actions').innerText = actions.size > 0 ? Array.from(actions).join(', ') : 'Brak';
}

async function fetchNotes() {
    const { data, error } = await supabaseClient.from('notatki_funkcjonariuszy').select('*').order('stworzono_at', { ascending: false });
    if (!error) {
        const container = document.getElementById('notes-list');
        container.innerHTML = data.map(n => `
            <div class="card">
                <p>${n.tresc}</p>
                <small>${new Date(n.stworzono_at).toLocaleString('pl-PL')}</small>
                <p><button class="delete-btn" onclick="deleteNote('${n.id}')">Usuń</button></p>
            </div>
        `).join('');
    }
}

async function addNote() {
    const text = document.getElementById('note-text').value;
    if (!text) return;
    const { error } = await supabaseClient.from('notatki_funkcjonariuszy').insert([{ tresc: text }]);
    if (!error) {
        document.getElementById('note-text').value = '';
        fetchNotes();
    }
}

async function deleteNote(id) {
    const potwierdzenie = confirm("Czy na pewno chcesz usunąć tę notatkę?");
    if (!potwierdzenie) return;

    const { error } = await supabaseClient.from('notatki_funkcjonariuszy').delete().eq('id', id);
    if (!error) {
        document.getElementById('notes-list').innerHTML = 'Odświeżanie notatek...';
        fetchNotes();
    } else {
        alert("Błąd podczas usuwania notatki.");
    }
}

async function fetchTickets() {
    const { data, error } = await supabaseClient.from('mandaty_wystawione').select('*').order('stworzono_at', { ascending: false });
    if (!error) {
        const container = document.getElementById('tickets-list');
        container.innerHTML = data.map(t => `
            <div class="card">
                <h3>Obywatel: ${t.obywatel}</h3>
                <p><strong>Zarzuty:</strong> ${t.powod}</p>
                <p><strong>Kara:</strong> $${t.grzywna.toLocaleString()} | <strong>Więzienie:</strong> ${t.wiezienie} m-cy</p>
                <small>Wystawiono: ${new Date(t.stworzono_at).toLocaleString('pl-PL')}</small>
            </div>
        `).join('');
    }
}

async function addTicket() {
    const citizen = document.getElementById('ticket-citizen').value;
    const reason = document.getElementById('ticket-reason').value;
    const fine = document.getElementById('ticket-fine').value || 0;
    const jail = document.getElementById('ticket-jail').value || 0;

    if (!citizen || !reason) return alert('Wypełnij imię i powód!');

    const { error } = await supabaseClient.from('mandaty_wystawione').insert([{
        obywatel: citizen, powod: reason, grzywna: parseInt(fine), wiezienie: parseInt(jail)
    }]);

    if (!error) {
        document.getElementById('ticket-citizen').value = '';
        document.getElementById('ticket-reason').value = '';
        document.getElementById('ticket-fine').value = '';
        document.getElementById('ticket-jail').value = '';
        fetchTickets();
    }
}

function addImgInputField() {
    const container = document.getElementById('bolo-images-inputs');
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'bolo-img-file';
    input.accept = 'image/*';
    input.style.marginTop = '5px';
    container.appendChild(input);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function fetchBolos() {
    const { data, error } = await supabaseClient.from('poszukiwania').select('*').order('stworzono_at', { ascending: false });
    if (!error) {
        const container = document.getElementById('bolos-list');
        container.innerHTML = data.map(b => {
            const imagesHtml = b.zdjecia && b.zdjecia.length > 0
                ? `<div class="image-gallery">${b.zdjecia.map(url => `<img src="${url}" class="gallery-img" onerror="this.style.display='none'">`).join('')}</div>`
                : '<em>Brak dołączonych zdjęć</em>';

            return `
                <div class="card" style="border-left: 4px solid #cc2424;">
                    <h2>🚨 ${b.tytul}</h2>
                    <p style="white-space: pre-wrap;">${b.opis}</p>
                    ${imagesHtml}
                    <br><small>Zgłoszono: ${new Date(b.stworzono_at).toLocaleString('pl-PL')}</small>
                    <p><button class="delete-btn" onclick="deleteBolo('${b.id}')">Zamknij sprawę / Usuń</button></p>
                </div>
            `;
        }).join('');
    }
}

async function addBolo() {
    const title = document.getElementById('bolo-title').value;
    const desc = document.getElementById('bolo-desc').value;
    
    if (!title || !desc) return alert('Wpisz tytuł oraz opis poszukiwania!');

    const imgInputs = document.querySelectorAll('.bolo-img-file');
    const zdjeciaArray = [];

    for (let input of imgInputs) {
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            try {
                const base64Data = await fileToBase64(file);
                zdjeciaArray.push(base64Data);
            } catch (e) {
                console.error(e);
            }
        }
    }

    const { error } = await supabaseClient.from('poszukiwania').insert([{
        tytul: title, opis: desc, zdjecia: zdjeciaArray
    }]);

    if (!error) {
        document.getElementById('bolo-title').value = '';
        document.getElementById('bolo-desc').value = '';
        document.getElementById('bolo-images-inputs').innerHTML = '<input type="file" class="bolo-img-file" accept="image/*">';
        fetchBolos();
    }
}

async function deleteBolo(id) {
    const potwierdzenie = confirm("Czy na pewno chcesz zamknąć tę sprawę i usunąć ją z rejestru poszukiwań?");
    if (!potwierdzenie) return;

    const { error } = await supabaseClient.from('poszukiwania').delete().eq('id', id);
    if (!error) {
        alert("Sprawa została pomyślnie zamknięta!");
        document.getElementById('bolos-list').innerHTML = 'Odświeżanie bazy BOLO...';
        fetchBolos();
    } else {
        console.error("Błąd usuwania BOLO:", error);
        alert("Wystąpił błąd podczas usuwania wpisu.");
    }
}