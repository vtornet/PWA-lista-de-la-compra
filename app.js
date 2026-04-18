// ============================================
// APP STATE & CONSTANTS
// ============================================

const DB_NAME = 'ShoppingListDB';
const DB_VERSION = 2; // Incremented for new store
const STORES = {
    lists: 'lists',
    items: 'items',
    settings: 'settings',
    history: 'history',
    priceHistory: 'priceHistory'
};

const STORAGE_KEYS = {
    theme: 'theme',
    currentList: 'currentListId',
    installDismissed: 'installDismissed'
};

// ============================================
// SUPABASE CONFIG
// ============================================

const SUPABASE_URL = 'https://ezwwaepvpuurboijbsry.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dowcVDh_7Ux-9PP9UKR9SA_u5SSPTYn';

let supabase = null;
let currentUser = null;

let appState = {
    currentListId: null,
    showPending: true,
    showCompleted: true,
    lists: [],
    items: [],
    settings: {
        autoDeleteCompleted: false,
        confirmBeforeDelete: true,
        hapticFeedback: true
    },
    history: [],
    db: null,
    currentView: 'lists' // 'lists', 'items', 'stats'
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const utils = {
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    formatPrice(price) {
        if (price == null || price === 0) return '0,00 €';
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(price);
    },

    formatDate(timestamp) {
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(new Date(timestamp));
    },

    formatDateTime(timestamp) {
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    hapticFeedback() {
        if (appState.settings.hapticFeedback && navigator.vibrate) {
            navigator.vibrate(10);
        }
    },

    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            textArea.remove();
            return Promise.resolve();
        } catch (err) {
            textArea.remove();
            return Promise.reject(err);
        }
    },

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ============================================
// INDEXEDDB OPERATIONS
// ============================================

const db = {
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                appState.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create lists store
                if (!db.objectStoreNames.contains(STORES.lists)) {
                    const listStore = db.createObjectStore(STORES.lists, { keyPath: 'id' });
                    listStore.createIndex('name', 'name', { unique: false });
                }

                // Create items store
                if (!db.objectStoreNames.contains(STORES.items)) {
                    const itemStore = db.createObjectStore(STORES.items, { keyPath: 'id' });
                    itemStore.createIndex('listId', 'listId', { unique: false });
                    itemStore.createIndex('inShoppingList', 'inShoppingList', { unique: false });
                }

                // Create settings store
                if (!db.objectStoreNames.contains(STORES.settings)) {
                    db.createObjectStore(STORES.settings, { keyPath: 'key' });
                }

                // Create history store
                if (!db.objectStoreNames.contains(STORES.history)) {
                    const historyStore = db.createObjectStore(STORES.history, { keyPath: 'id' });
                    historyStore.createIndex('listId', 'listId', { unique: false });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create price history store
                if (!db.objectStoreNames.contains(STORES.priceHistory)) {
                    const priceHistoryStore = db.createObjectStore(STORES.priceHistory, { keyPath: 'id' });
                    priceHistoryStore.createIndex('itemName', 'itemName', { unique: false });
                    priceHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deleteByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = appState.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.openCursor(IDBKeyRange.only(value));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
};

// ============================================
// SUPABASE AUTH
// ============================================

const auth = {
    init() {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Auth] Supabase initialized');

            // Check for existing session
            this.checkSession();
        } catch (error) {
            console.error('[Auth] Failed to initialize:', error);
        }
    },

    async checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                currentUser = session.user;
                console.log('[Auth] User logged in:', currentUser.email);
                this.updateAuthUI();
                await this.loadUserProfile();
            }
        } catch (error) {
            console.error('[Auth] Session check failed:', error);
        }
    },

    async signUp(email, password) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                // Create profile record
                await this.createProfile(data.user.id, email);
                currentUser = data.user;
                this.updateAuthUI();
                // New user won't have shared lists yet, but set up subscription
                subscribeToInvitations();
                return { success: true };
            }
        } catch (error) {
            console.error('[Auth] Sign up failed:', error);
            return { success: false, error: error.message };
        }
    },

    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                currentUser = data.user;
                this.updateAuthUI();
                await this.loadUserProfile();
                // Load shared data
                await loadSharedLists();
                await loadPendingInvitations();
                subscribeToInvitations();
                return { success: true };
            }
        } catch (error) {
            console.error('[Auth] Sign in failed:', error);
            return { success: false, error: error.message };
        }
    },

    async signOut() {
        try {
            unsubscribeFromInvitations();
            await supabase.auth.signOut();
            currentUser = null;
            this.updateAuthUI();
            ui.showToast('Sesión cerrada', 'success');
            // Reload to clear shared lists
            await dataOps.loadLists();
            ui.renderListsGrid();
            document.getElementById('invitationsSection').style.display = 'none';
        } catch (error) {
            console.error('[Auth] Sign out failed:', error);
        }
    },

    async createProfile(userId, email) {
        try {
            const { error } = await supabase
                .from('profiles')
                .insert({ id: userId, email });

            if (error) {
                // If profile already exists, ignore
                if (error.code !== '23505') {
                    console.error('[Auth] Profile creation failed:', error);
                }
            }
        } catch (error) {
            console.error('[Auth] Profile creation error:', error);
        }
    },

    async loadUserProfile() {
        if (!currentUser) return null;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (!error && data) {
                return data;
            }
        } catch (error) {
            console.error('[Auth] Profile load failed:', error);
        }
        return null;
    },

    updateAuthUI() {
        const authSection = document.getElementById('authSection');
        const userEmailSpan = document.getElementById('userEmail');

        if (!authSection) return;

        if (currentUser) {
            authSection.classList.add('logged-in');
            if (userEmailSpan) {
                userEmailSpan.textContent = currentUser.email;
            }
        } else {
            authSection.classList.remove('logged-in');
        }
    },

    isAuthenticated() {
        return currentUser !== null;
    }
};

// ============================================
// DATA OPERATIONS
// ============================================

const dataOps = {
    async loadLists() {
        appState.lists = await db.getAll(STORES.lists);
        appState.lists.sort((a, b) => a.name.localeCompare(b.name));
    },

    async loadItems(listId) {
        const allItems = await db.getAll(STORES.items);
        appState.items = allItems.filter(item => item.listId === listId);
        // Sort alphabetically by name
        appState.items.sort((a, b) => a.name.localeCompare(b.name, 'es-ES'));
    },

    async loadSettings() {
        const settingsData = await db.getAll(STORES.settings);
        settingsData.forEach(setting => {
            appState.settings[setting.key] = setting.value;
        });
    },

    async saveSetting(key, value) {
        appState.settings[key] = value;
        await db.put(STORES.settings, { key, value });
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
    },

    async createList(name) {
        const list = {
            id: utils.generateId(),
            name,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await db.add(STORES.lists, list);
        appState.lists.push(list);
        appState.lists.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    },

    async updateList(id, name) {
        const list = appState.lists.find(l => l.id === id);
        if (list) {
            list.name = name;
            list.updatedAt = Date.now();
            await db.put(STORES.lists, list);
            appState.lists.sort((a, b) => a.name.localeCompare(b.name));
        }
    },

    async deleteList(id) {
        await db.delete(STORES.lists, id);
        await db.deleteByIndex(STORES.items, 'listId', id);
        await db.deleteByIndex(STORES.history, 'listId', id);
        appState.lists = appState.lists.filter(l => l.id !== id);

        if (appState.currentListId === id) {
            appState.currentListId = null;
            appState.items = [];
            localStorage.removeItem(STORAGE_KEYS.currentList);
        }
    },

    async createItem(itemData) {
        const item = {
            id: utils.generateId(),
            name: itemData.name,
            listId: itemData.listId || appState.currentListId,
            inShoppingList: itemData.inShoppingList !== undefined ? itemData.inShoppingList : true,
            imageUrl: itemData.imageUrl || null,
            price: itemData.price || null,
            previousPrice: itemData.previousPrice || null,
            quantity: itemData.quantity || 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await db.add(STORES.items, item);
        appState.items.unshift(item);
        return item;
    },

    async updateItem(item) {
        item.updatedAt = Date.now();
        await db.put(STORES.items, item);

        const index = appState.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            appState.items[index] = item;
        }
    },

    async deleteItem(itemId) {
        await db.delete(STORES.items, itemId);
        appState.items = appState.items.filter(i => i.id !== itemId);
    },

    async toggleItemStatus(item) {
        const wasInList = item.inShoppingList;
        item.inShoppingList = !item.inShoppingList;
        item.updatedAt = Date.now();

        if (!wasInList && item.price) {
            await this.addToHistory(item);
        }

        await db.put(STORES.items, item);
    },

    async addToHistory(item) {
        const historyEntry = {
            id: utils.generateId(),
            listId: item.listId,
            itemName: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            timestamp: Date.now()
        };
        await db.add(STORES.history, historyEntry);
        appState.history.push(historyEntry);
    },

    async loadHistory(listId) {
        const allHistory = await db.getAll(STORES.history);
        appState.history = allHistory.filter(h => h.listId === listId);
        appState.history.sort((a, b) => b.timestamp - a.timestamp);
    },

    async exportListToJson(listId) {
        const list = appState.lists.find(l => l.id === listId);
        if (!list) return null;

        const listItems = await db.getAll(STORES.items);
        const items = listItems
            .filter(item => item.listId === listId)
            .map(item => ({
                name: item.name,
                inShoppingList: item.inShoppingList,
                imageUrl: item.imageUrl,
                price: item.price,
                previousPrice: item.previousPrice,
                quantity: item.quantity
            }));

        const exportData = {
            version: 1,
            exportDate: Date.now(),
            listName: list.name,
            items: items
        };

        return JSON.stringify(exportData, null, 2);
    },

    async exportAllToJson() {
        const exportData = {
            version: 1,
            exportDate: Date.now(),
            lists: []
        };

        for (const list of appState.lists) {
            const listItems = await db.getAll(STORES.items);
            const items = listItems
                .filter(item => item.listId === list.id)
                .map(item => ({
                    name: item.name,
                    inShoppingList: item.inShoppingList,
                    imageUrl: item.imageUrl,
                    price: item.price,
                    previousPrice: item.previousPrice,
                    quantity: item.quantity
                }));

            exportData.lists.push({
                name: list.name,
                items: items
            });
        }

        return JSON.stringify(exportData, null, 2);
    },

    async importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Check if it's a single list export (from share feature)
            if (data.listName && data.items) {
                const newList = await this.createList(data.listName + ' (compartida)');
                let importedItems = 0;

                for (const exportItem of data.items) {
                    const item = {
                        name: exportItem.name,
                        listId: newList.id,
                        inShoppingList: exportItem.inShoppingList,
                        imageUrl: exportItem.imageUrl,
                        price: exportItem.price,
                        previousPrice: exportItem.previousPrice || null,
                        quantity: exportItem.quantity
                    };
                    await this.createItem(item);
                    importedItems++;
                }

                return { success: true, importedLists: 1, importedItems, listId: newList.id };
            }

            // Check if it's a full export (with lists array)
            if (!data.lists || !Array.isArray(data.lists)) {
                throw new Error('Formato de archivo inválido');
            }

            let importedLists = 0;
            let importedItems = 0;

            for (const exportList of data.lists) {
                let list = appState.lists.find(l => l.name === exportList.name);
                if (!list) {
                    list = await this.createList(exportList.name + ' (importado)');
                    importedLists++;
                }

                for (const exportItem of exportList.items) {
                    const item = {
                        name: exportItem.name,
                        listId: list.id,
                        inShoppingList: exportItem.inShoppingList,
                        imageUrl: exportItem.imageUrl,
                        price: exportItem.price,
                        previousPrice: exportItem.previousPrice || null,
                        quantity: exportItem.quantity
                    };
                    await this.createItem(item);
                    importedItems++;
                }
            }

            return { success: true, importedLists, importedItems };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async clearAllData() {
        const transaction = appState.db.transaction(
            [STORES.lists, STORES.items, STORES.settings, STORES.history, STORES.priceHistory],
            'readwrite'
        );

        for (const storeName of [STORES.lists, STORES.items, STORES.history, STORES.priceHistory]) {
            transaction.objectStore(storeName).clear();
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                appState.lists = [];
                appState.items = [];
                appState.history = [];
                appState.currentListId = null;
                localStorage.clear();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // Load all products from all lists
    async loadAllProducts() {
        const allItems = await db.getAll(STORES.items);
        const products = [];

        for (const item of allItems) {
            const list = appState.lists.find(l => l.id === item.listId);
            if (!list) continue;

            // Get price history for this product
            const priceHistory = await this.getPriceHistory(item.name);

            products.push({
                ...item,
                listName: list.name,
                listId: item.listId,
                priceHistory: priceHistory
            });
        }

        // Sort alphabetically by name
        products.sort((a, b) => a.name.localeCompare(b.name, 'es-ES'));

        return products;
    },

    // Get price history for a product
    async getPriceHistory(itemName) {
        const allHistory = await db.getAll(STORES.priceHistory);
        return allHistory
            .filter(h => h.itemName === itemName)
            .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    },

    // Save price to history when updating item price
    async savePriceToHistory(item, oldPrice, newPrice) {
        if (!oldPrice || oldPrice === newPrice) return;

        const historyEntry = {
            id: utils.generateId(),
            itemName: item.name,
            listId: item.listId,
            oldPrice: oldPrice,
            newPrice: newPrice,
            timestamp: Date.now()
        };

        await db.add(STORES.priceHistory, historyEntry);
    },

    // Update item price and save to history
    async updateItemPrice(item, newPrice) {
        const oldPrice = item.price;

        if (oldPrice !== newPrice) {
            // Save to history if price changed
            if (oldPrice && oldPrice !== newPrice) {
                await this.savePriceToHistory(item, oldPrice, newPrice);
            }

            // Update previousPrice
            item.previousPrice = oldPrice;
            item.price = newPrice;
            item.updatedAt = Date.now();

            await db.put(STORES.items, item);

            // Update in appState.items if present
            const index = appState.items.findIndex(i => i.id === item.id);
            if (index !== -1) {
                appState.items[index] = item;
            }
        }
    },

    // Calculate price change percentage
    calculatePriceChange(current, previous) {
        if (!current || !previous) return null;

        const change = ((current - previous) / previous) * 100;
        return {
            percentage: Math.abs(change).toFixed(1),
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
            isPositive: change < 0 // Lower price is positive for consumer
        };
    }
};

// ============================================
// NAVIGATION
// ============================================

const navigation = {
    showListsView() {
        appState.currentView = 'lists';
        document.getElementById('listsView').classList.add('active');
        document.getElementById('itemsView').classList.remove('active');
        document.getElementById('productsView').classList.remove('active');
        document.getElementById('statsView').classList.remove('active');
        document.getElementById('appTitle').textContent = 'Mis Listas';
    },

    showItemsView() {
        appState.currentView = 'items';
        document.getElementById('listsView').classList.remove('active');
        document.getElementById('itemsView').classList.add('active');
        document.getElementById('productsView').classList.remove('active');
        document.getElementById('statsView').classList.remove('active');
    },

    showStatsView() {
        appState.currentView = 'stats';
        document.getElementById('listsView').classList.remove('active');
        document.getElementById('itemsView').classList.remove('active');
        document.getElementById('productsView').classList.remove('active');
        document.getElementById('statsView').classList.add('active');
    },

    async showProductsView() {
        appState.currentView = 'products';
        await dataOps.loadLists();
        const products = await dataOps.loadAllProducts();

        appState.allProducts = products;

        document.getElementById('listsView').classList.remove('active');
        document.getElementById('itemsView').classList.remove('active');
        document.getElementById('statsView').classList.remove('active');
        document.getElementById('productsView').classList.add('active');
        document.getElementById('appTitle').textContent = 'Productos';

        ui.renderProducts(products);
    },

    async openList(listId) {
        appState.currentListId = listId;
        localStorage.setItem(STORAGE_KEYS.currentList, listId);
        await dataOps.loadItems(listId);
        await dataOps.loadHistory(listId);

        const list = appState.lists.find(l => l.id === listId);
        document.getElementById('currentListTitle').textContent = list ? list.name : 'Lista';

        this.showItemsView();
        ui.renderItems();
    }
};

// ============================================
// PRICE HISTORY MODAL
// ============================================

let currentPriceHistoryItem = null;

async function openPriceHistoryModal(itemId) {
    const products = appState.allProducts || [];
    const product = products.find(p => p.id === itemId) || appState.items.find(i => i.id === itemId);

    if (!product) return;

    currentPriceHistoryItem = product;

    // Get price history
    const priceHistory = product.priceHistory || await dataOps.getPriceHistory(product.name);

    // Update modal title
    document.getElementById('priceHistoryTitle').textContent = product.name;

    // Set current price input
    const priceInput = document.getElementById('currentPriceInput');
    priceInput.value = product.price || '';

    // Update price change info
    updatePriceChangeInfo(product);

    // Render price history list
    renderPriceHistoryList(priceHistory, product.price);

    // Show modal
    document.getElementById('priceHistoryModal').classList.add('open');
}

function updatePriceChangeInfo(product) {
    const infoDiv = document.getElementById('priceChangeInfo');

    if (!product.price || !product.previousPrice) {
        infoDiv.innerHTML = `
            <svg class="price-change-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span class="price-change-text">Sin historial de precios previo</span>
        `;
        return;
    }

    const change = dataOps.calculatePriceChange(product.price, product.previousPrice);

    if (!change) {
        infoDiv.innerHTML = `<span class="price-change-text">Precio sin cambios</span>`;
        return;
    }

    const iconSvg = change.direction === 'up' ?
        '<path d="M12 19V5M5 12l7-7 7 7"/>' :
        change.direction === 'down' ?
        '<path d="M12 5v14M19 12l-7 7-7-7"/>' :
        '<circle cx="12" cy="12" r="1"/>';

    const directionText = change.direction === 'up' ? 'Ha subido' :
                        change.direction === 'down' ? 'Ha bajado' : 'Sin cambios';

    infoDiv.innerHTML = `
        <svg class="price-change-icon ${change.direction === 'down' ? 'up' : change.direction === 'up' ? 'down' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${iconSvg}
        </svg>
        <div class="price-change-text">
            <span>${directionText} desde </span>
            <strong>${utils.formatPrice(product.previousPrice)}</strong>
            <span class="price-change-percentage ${change.isPositive ? 'positive' : 'negative'}">
                (${change.percentage}%)
            </span>
        </div>
    `;
}

function renderPriceHistoryList(history, currentPrice) {
    const container = document.getElementById('priceHistoryList');

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="price-history-empty">
                <p>No hay historial de precios aún</p>
                <p class="text-secondary text-sm">Los cambios de precio se guardarán automáticamente aquí</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map((entry, index) => {
        const change = index < history.length - 1 ?
            dataOps.calculatePriceChange(entry.newPrice, history[index + 1]?.newPrice || entry.oldPrice) :
            null;

        const changeHtml = change ?
            `<span class="price-history-change ${change.isPositive ? 'positive' : 'negative'}">
                ${change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→'} ${change.percentage}%
            </span>` : '';

        return `
            <div class="price-history-item">
                <span class="price-history-date">${utils.formatDateTime(entry.timestamp)}</span>
                <span class="price-history-price">${utils.formatPrice(entry.newPrice)}</span>
                ${changeHtml}
            </div>
        `;
    }).join('');
}

async function savePriceFromModal() {
    if (!currentPriceHistoryItem) return;

    const priceInput = document.getElementById('currentPriceInput');
    const newPrice = parseFloat(priceInput.value) || null;

    // Find the item in the original list
    const allItems = await db.getAll(STORES.items);
    const item = allItems.find(i => i.id === currentPriceHistoryItem.id);

    if (item) {
        await dataOps.updateItemPrice(item, newPrice);

        // Update the current item
        currentPriceHistoryItem.price = newPrice;
        currentPriceHistoryItem.previousPrice = item.previousPrice;

        // Refresh modal
        const updatedHistory = await dataOps.getPriceHistory(item.name);
        currentPriceHistoryItem.priceHistory = updatedHistory;
        updatePriceChangeInfo(currentPriceHistoryItem);
        renderPriceHistoryList(updatedHistory, newPrice);

        // Refresh products view if active
        if (appState.currentView === 'products') {
            const products = await dataOps.loadAllProducts();
            ui.renderProducts(products);
        }

        // Refresh items view if active
        if (appState.currentView === 'items' && appState.currentListId === item.listId) {
            await dataOps.loadItems(item.listId);
            ui.renderItems();
        }

        utils.hapticFeedback();
        ui.showToast('Precio actualizado', 'success');
    }
}

function closePriceHistoryModal() {
    document.getElementById('priceHistoryModal').classList.remove('open');
    currentPriceHistoryItem = null;
}

// ============================================
// UI RENDERERS
// ============================================

const ui = {
    renderListsGrid() {
        const container = document.getElementById('listsGrid');
        const emptyState = document.getElementById('emptyListsState');

        if (!container) return;

        if (appState.lists.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // Get item counts for each list
        const allItems = db.getAll(STORES.items).then(items => {
            const listCounts = {};
            items.forEach(item => {
                listCounts[item.listId] = (listCounts[item.listId] || 0) + 1;
            });
            return listCounts;
        });

        allItems.then(listCounts => {
            container.innerHTML = appState.lists.map(list => {
                const itemCount = listCounts[list.id] || 0;
                const isShared = list.isShared || false;
                const sharedBadge = isShared ? `
                    <span class="list-shared-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        Compartida
                    </span>
                ` : '';

                return `
                    <div class="list-card ${isShared ? 'shared' : ''}" data-list-id="${list.id}">
                        <div class="list-card-actions">
                            ${!isShared ? `
                            <button class="list-card-action-btn share" data-list-id="${list.id}" aria-label="Compartir">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="18" cy="5" r="3"/>
                                    <circle cx="6" cy="12" r="3"/>
                                    <circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                            </button>
                            ` : ''}
                            <button class="list-card-action-btn edit" data-list-id="${list.id}" aria-label="Editar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            ${!isShared ? `
                            <button class="list-card-action-btn delete" data-list-id="${list.id}" aria-label="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                            </button>
                            ` : ''}
                        </div>
                        <div class="list-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                        </div>
                        <div class="list-card-name">${utils.escapeHtml(list.name)}</div>
                        <div class="list-card-meta">
                            ${sharedBadge}
                            <span class="list-card-count">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                                </svg>
                                ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');

            // Attach event listeners
            this.attachListCardListeners(container);
        });
    },

    attachListCardListeners(container) {
        container.querySelectorAll('.list-card').forEach(card => {
            // Open list on card click (but not on action buttons)
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.list-card-action-btn')) {
                    const listId = card.dataset.listId;
                    navigation.openList(listId);
                }
            });
        });

        container.querySelectorAll('.list-card-action-btn.share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                shareList(btn.dataset.listId);
            });
        });

        container.querySelectorAll('.list-card-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditListModal(btn.dataset.listId);
            });
        });

        container.querySelectorAll('.list-card-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const listId = btn.dataset.listId;
                confirmAction('¿Eliminar esta lista y todos sus productos?', async () => {
                    await dataOps.deleteList(listId);
                    this.renderListsGrid();
                    showToast('Lista eliminada', 'success');
                });
            });
        });
    },

    renderItems() {
        const container = document.getElementById('itemsList');
        const emptyState = document.getElementById('emptyState');
        const totalSummary = document.getElementById('totalSummary');

        // Filter based on toggles
        let filteredItems = appState.items;
        if (!appState.showPending && !appState.showCompleted) {
            // Both hidden - show message
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'Los filtros están ocultando todos los productos';
            emptyState.querySelector('.empty-hint').textContent = 'Activa al menos un filtro para ver productos';
            totalSummary.classList.add('hidden');
            this.updateCounts();
            return;
        }

        if (appState.showPending && appState.showCompleted) {
            // Show all
            filteredItems = appState.items;
        } else if (appState.showPending) {
            // Show only pending
            filteredItems = appState.items.filter(i => i.inShoppingList);
        } else if (appState.showCompleted) {
            // Show only completed
            filteredItems = appState.items.filter(i => !i.inShoppingList);
        }

        this.updateCounts();

        if (filteredItems.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No hay productos para mostrar';
            emptyState.querySelector('.empty-hint').textContent = 'Ajusta los filtros o añade productos';
            totalSummary.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        totalSummary.classList.remove('hidden');

        container.innerHTML = filteredItems.map(item => this.renderItem(item)).join('');

        container.querySelectorAll('.item').forEach(itemEl => {
            const itemId = itemEl.dataset.itemId;

            const checkbox = itemEl.querySelector('.item-checkbox');
            checkbox.addEventListener('click', () => toggleItemStatus(itemId));

            const editBtn = itemEl.querySelector('.item-action-btn.edit');
            editBtn.addEventListener('click', () => openEditModal(itemId));

            const deleteBtn = itemEl.querySelector('.item-action-btn.delete');
            deleteBtn.addEventListener('click', () => {
                confirmAction('¿Eliminar este producto?', async () => {
                    await dataOps.deleteItem(itemId);
                    this.renderItems();
                    showToast('Producto eliminado', 'success');
                });
            });

            this.attachSwipeGestures(itemEl, itemId);
        });

        this.updateSummary();
    },

    updateCounts() {
        const pendingCount = appState.items.filter(i => i.inShoppingList).length;
        const completedCount = appState.items.filter(i => !i.inShoppingList).length;

        document.getElementById('countPending').textContent = pendingCount;
        document.getElementById('countCompleted').textContent = completedCount;
    },

    renderItem(item) {
        const imageHtml = item.imageUrl
            ? `<img src="${utils.escapeHtml(item.imageUrl)}" alt="" class="item-image" loading="lazy">`
            : `<div class="item-image-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
               </div>`;

        return `
            <div class="item ${item.inShoppingList ? '' : 'completed'}" data-item-id="${item.id}">
                <div class="item-checkbox ${item.inShoppingList ? '' : 'checked'}"></div>
                ${imageHtml}
                <div class="item-content">
                    <div class="item-name">${utils.escapeHtml(item.name)}</div>
                    <div class="item-details">
                        ${item.quantity > 1 ? `<span class="item-detail">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                            </svg>
                            ×${item.quantity}
                        </span>` : ''}
                        ${item.price ? `<span class="item-detail">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                            </svg>
                            ${utils.formatPrice(item.price)}
                        </span>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn edit" aria-label="Editar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="item-action-btn delete" aria-label="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    attachSwipeGestures(itemEl, itemId) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        const handleStart = (x) => {
            startX = x;
            isDragging = true;
            itemEl.style.transition = 'none';
        };

        const handleMove = (x) => {
            if (!isDragging) return;
            currentX = x;
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            itemEl.style.transition = '';

            const diff = currentX - startX;

            if (diff < -80) {
                toggleItemStatus(itemId);
            } else if (diff > 80) {
                confirmAction('¿Eliminar este producto?', async () => {
                    await dataOps.deleteItem(itemId);
                    this.renderItems();
                    showToast('Producto eliminado', 'success');
                });
            }
        };

        itemEl.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX));
        itemEl.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX));
        itemEl.addEventListener('touchend', handleEnd);

        itemEl.addEventListener('mousedown', (e) => handleStart(e.clientX));
        itemEl.addEventListener('mousemove', (e) => handleMove(e.clientX));
        itemEl.addEventListener('mouseup', handleEnd);
        itemEl.addEventListener('mouseleave', () => {
            if (isDragging) handleEnd();
        });
    },

    updateSummary() {
        const totalItems = appState.items.reduce((sum, item) => sum + item.quantity, 0);
        const estimatedTotal = appState.items
            .filter(i => i.inShoppingList)
            .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
        const spentTotal = appState.items
            .filter(i => !i.inShoppingList)
            .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('totalEstimated').textContent = utils.formatPrice(estimatedTotal);
        document.getElementById('totalSpent').textContent = utils.formatPrice(spentTotal);
    },

    renderStats(range = 'all') {
        const now = Date.now();
        let filteredHistory = [...appState.history];

        if (range === 'week') {
            const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
            filteredHistory = filteredHistory.filter(h => h.timestamp > weekAgo);
        } else if (range === 'month') {
            const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
            filteredHistory = filteredHistory.filter(h => h.timestamp > monthAgo);
        }

        const totalSpent = filteredHistory.reduce((sum, h) => sum + h.total, 0);
        const itemsBought = filteredHistory.reduce((sum, h) => sum + h.quantity, 0);
        const avgPrice = itemsBought > 0 ? totalSpent / itemsBought : 0;

        let saved = 0;
        appState.items.forEach(item => {
            if (item.previousPrice && item.price && item.previousPrice > item.price) {
                saved += (item.previousPrice - item.price) * item.quantity;
            }
        });

        document.getElementById('statTotalSpent').textContent = utils.formatPrice(totalSpent);
        document.getElementById('statItemsBought').textContent = itemsBought;
        document.getElementById('statAvgPrice').textContent = utils.formatPrice(avgPrice);
        document.getElementById('statSaved').textContent = utils.formatPrice(saved);

        this.renderChart(filteredHistory);
        this.renderTopProducts(filteredHistory);
    },

    renderChart(history) {
        const canvas = document.getElementById('expensesChart');
        const ctx = canvas.getContext('2d');

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width - 32;
        canvas.height = 200;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (history.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos', canvas.width / 2, canvas.height / 2);
            return;
        }

        const grouped = {};
        history.forEach(h => {
            const date = new Date(h.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            grouped[date] = (grouped[date] || 0) + h.total;
        });

        const labels = Object.keys(grouped).slice(-7);
        const values = labels.map(l => grouped[l]);
        const maxValue = Math.max(...values, 1);

        const barWidth = (canvas.width - 60) / labels.length - 10;
        const chartHeight = canvas.height - 40;

        labels.forEach((label, i) => {
            const x = 30 + i * (barWidth + 10);
            const barHeight = (values[i] / maxValue) * chartHeight;
            const y = chartHeight - barHeight + 20;

            const gradient = ctx.createLinearGradient(x, y, x, chartHeight + 20);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(1, '#818cf8');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 4);
            ctx.fill();

            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x + barWidth / 2, canvas.height - 5);

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(utils.formatPrice(values[i]), x + barWidth / 2, y - 5);
        });
    },

    renderTopProducts(history) {
        const counts = {};
        history.forEach(h => {
            counts[h.itemName] = (counts[h.itemName] || 0) + h.quantity;
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const container = document.getElementById('topProductsList');

        if (sorted.length === 0) {
            container.innerHTML = '<p class="text-secondary">Sin datos suficientes</p>';
            return;
        }

        container.innerHTML = sorted.map(([name, count], index) => `
            <div class="top-product-item">
                <div class="top-product-rank top-${index + 1}">${index + 1}</div>
                <div class="top-product-info">
                    <div class="top-product-name">${utils.escapeHtml(name)}</div>
                    <div class="top-product-count">Comprado ${count} ${count === 1 ? 'vez' : 'veces'}</div>
                </div>
                <div class="top-product-times">${count}</div>
            </div>
        `).join('');
    },

    renderProducts(products) {
        const container = document.getElementById('productsList');
        const emptyState = document.getElementById('emptyProductsState');

        if (!container) return;

        if (!products || products.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        container.innerHTML = products.map(product => this.renderProductCard(product)).join('');

        // Attach event listeners
        container.querySelectorAll('.product-card').forEach(card => {
            const itemId = card.dataset.itemId;

            // View history button
            const historyBtn = card.querySelector('.view-history-btn');
            if (historyBtn) {
                historyBtn.addEventListener('click', () => {
                    openPriceHistoryModal(itemId);
                });
            }

            // Quick edit price button
            const editPriceBtn = card.querySelector('.edit-price-btn');
            if (editPriceBtn) {
                editPriceBtn.addEventListener('click', () => {
                    openPriceHistoryModal(itemId);
                });
            }
        });
    },

    renderProductCard(product) {
        const hasPrice = product.price !== null && product.price !== undefined;
        const currentPrice = hasPrice ? product.price : null;
        const previousPrice = product.previousPrice;

        let priceChangeHtml = '';
        if (hasPrice && previousPrice && previousPrice !== currentPrice) {
            const change = dataOps.calculatePriceChange(currentPrice, previousPrice);
            if (change) {
                const arrow = change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→';
                const changeClass = change.isPositive ? 'positive' : !change.isPositive && change.direction !== 'same' ? 'negative' : 'neutral';
                priceChangeHtml = `<span class="product-card-price-change ${changeClass}">${arrow} ${change.percentage}%</span>`;
            }
        }

        return `
            <div class="product-card" data-item-id="${product.id}">
                <div class="product-card-header">
                    <div class="product-card-info">
                        <div class="product-card-name">${utils.escapeHtml(product.name)}</div>
                        <div class="product-card-list">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            ${utils.escapeHtml(product.listName)}
                        </div>
                    </div>
                    <div class="product-card-price-section">
                        <div class="product-card-price">${hasPrice ? utils.formatPrice(currentPrice) : 'Sin precio'}</div>
                        ${priceChangeHtml}
                    </div>
                </div>
                <div class="product-card-actions">
                    <button class="product-card-btn view-history-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Historial
                    </button>
                    <button class="product-card-btn edit-price-btn primary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar precio
                    </button>
                </div>
            </div>
        `;
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${utils.escapeHtml(message)}</div>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }
};

// ============================================
// SHARE FUNCTIONS
// ============================================

let currentShareListId = null;

async function shareList(listId) {
    currentShareListId = listId;
    const json = await dataOps.exportListToJson(listId);

    if (!json) {
        showToast('Error al exportar lista', 'error');
        return;
    }

    // Check if Web Share API supports files
    if (navigator.share && navigator.canShare) {
        try {
            const blob = new Blob([json], { type: 'application/json' });
            const file = new File([blob], 'lista-compra.json', { type: 'application/json' });

            const shareData = {
                title: 'Mi lista de compra',
                text: 'Aquí tienes mi lista de compra',
                files: [file]
            };

            if (navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                    showToast('Lista compartida como archivo', 'success');
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') {
                        return; // User cancelled
                    }
                    console.log('File sharing not supported, showing modal');
                }
            }
        } catch (err) {
            console.log('Share API check failed, showing modal');
        }
    }

    // Fallback: show share modal with all options
    document.getElementById('shareModal').classList.add('open');
}

async function shareViaApp() {
    const json = await dataOps.exportListToJson(currentShareListId);
    const list = appState.lists.find(l => l.id === currentShareListId);
    const listName = list ? list.name : 'lista';

    // Check if share API is available
    if (!navigator.share) {
        showToast('Tu navegador no permite compartir. Usa "Descargar" o "Copiar".', 'warning');
        return;
    }

    // Try with file first
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], `${listName.toLowerCase().replace(/\s+/g, '-')}.json`, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: `Lista: ${listName}`,
                text: 'Aquí tienes mi lista de compra',
                files: [file]
            });
            closeShareModal();
            showToast('Lista compartida como archivo', 'success');
            return;
        } catch (err) {
            if (err.name === 'AbortError') {
                return; // User cancelled
            }
            console.log('File sharing failed:', err);
        }
    }

    // Fallback: share as formatted text
    try {
        const data = JSON.parse(json);
        let textMessage = `📝 ${data.listName || 'Mi Lista de Compra'}\n\n`;

        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                const status = item.inShoppingList ? '☐' : '☑';
                const price = item.price ? ` (${item.price}€)` : '';
                const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
                textMessage += `${status} ${item.name}${qty}${price}\n`;
            });
        } else {
            textMessage += '(No hay productos)';
        }

        textMessage += `\n📎 Para importar: usa "Importar JSON" en la app`;

        await navigator.share({
            title: `Lista: ${listName}`,
            text: textMessage
        });
        closeShareModal();
        showToast('Lista compartida como texto', 'success');
    } catch (err) {
        if (err.name === 'AbortError') {
            return; // User cancelled
        }
        console.log('Text sharing failed:', err);

        // Show helpful error message
        showToast('No se pudo compartir. Usa "Descargar" o "Copiar".', 'error');
    }
}

async function downloadJson() {
    const json = await dataOps.exportListToJson(currentShareListId);
    const list = appState.lists.find(l => l.id === currentShareListId);

    if (json && list) {
        utils.downloadFile(json, `lista-${list.name.toLowerCase().replace(/\s+/g, '-')}.json`);
        closeShareModal();
        showToast('Lista descargada', 'success');
    }
}

async function copyJson() {
    const json = await dataOps.exportListToJson(currentShareListId);

    try {
        await utils.copyToClipboard(json);
        closeShareModal();
        showToast('JSON copiado al portapapeles', 'success');
    } catch (err) {
        showToast('Error al copiar', 'error');
    }
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('open');
    currentShareListId = null;
}

// ============================================
// EVENT HANDLERS
// ============================================

function toggleItemStatus(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (item) {
        dataOps.toggleItemStatus(item).then(() => {
            utils.hapticFeedback();
            ui.renderItems();
        });
    }
}

function openSidePanel() {
    document.getElementById('sidePanel').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSidePanel() {
    document.getElementById('sidePanel').classList.remove('open');
    document.body.style.overflow = '';
}

function openEditModal(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemQuantity').value = item.quantity;
    document.getElementById('editItemPrice').value = item.price || '';
    document.getElementById('editItemImage').value = item.imageUrl || '';

    const preview = document.getElementById('editImagePreview');
    if (item.imageUrl) {
        preview.innerHTML = `<img src="${utils.escapeHtml(item.imageUrl)}" alt="Preview">`;
    } else {
        preview.innerHTML = '';
    }

    document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
}

function openEditListModal(listId) {
    const list = appState.lists.find(l => l.id === listId);
    if (!list) return;

    document.getElementById('editListId').value = list.id;
    document.getElementById('editListName').value = list.name;
    document.getElementById('editListModal').classList.add('open');
}

function closeEditListModal() {
    document.getElementById('editListModal').classList.remove('open');
}

function confirmAction(message, callback) {
    if (!appState.settings.confirmBeforeDelete) {
        callback();
        return;
    }

    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.add('open');

    const handleConfirm = () => {
        modal.classList.remove('open');
        callback();
        cleanup();
    };

    const handleCancel = () => {
        modal.classList.remove('open');
        cleanup();
    };

    const cleanup = () => {
        document.getElementById('confirmOk').removeEventListener('click', handleConfirm);
        document.getElementById('confirmCancel').removeEventListener('click', handleCancel);
    };

    document.getElementById('confirmOk').addEventListener('click', handleConfirm);
    document.getElementById('confirmCancel').addEventListener('click', handleCancel);
}

// ============================================
// THEME MANAGEMENT
// ============================================

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.theme, newTheme);
}

// ============================================
// INSTALL PROMPT
// ============================================

let deferredPrompt;

const pwaInstall = {
    isInstalled: () => {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
    },

    isIOS: () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    isMobile: () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    canShowPrompt: () => {
        const installed = pwaInstall.isInstalled();
        const dismissed = localStorage.getItem(STORAGE_KEYS.installDismissed);

        console.log('[PWA Install] Debug:', {
            installed,
            dismissed,
            isIOS: pwaInstall.isIOS(),
            isMobile: pwaInstall.isMobile(),
            standalone: window.matchMedia('(display-mode: standalone)').matches,
            navigatorStandalone: window.navigator.standalone
        });

        if (installed) return false;
        if (dismissed) return false;
        return true;
    },

    showBanner: () => {
        document.getElementById('installBanner').style.display = '';
        console.log('[PWA Install] Banner shown');
    },

    hideBanner: () => {
        document.getElementById('installBanner').style.display = 'none';
    },

    init: () => {
        // Always set up listeners, regardless of current state
        pwaInstall.updateMenuButton();

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            console.log('[PWA Install] beforeinstallprompt fired');

            pwaInstall.showBanner();
            pwaInstall.updateMenuButton(true);
        });

        window.addEventListener('appinstalled', () => {
            pwaInstall.hideBanner();
            deferredPrompt = null;
            localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');
            console.log('[PWA Install] App installed');
            pwaInstall.updateMenuButton(false);
        });

        if (pwaInstall.isIOS() && !pwaInstall.isInstalled()) {
            setTimeout(() => {
                if (pwaInstall.canShowPrompt()) {
                    const bannerText = document.getElementById('installBannerText');
                    const installBtn = document.getElementById('installBtn');
                    bannerText.textContent = 'Instala la app en tu iPhone/iPad';
                    installBtn.textContent = 'Ver instrucciones';
                    pwaInstall.showBanner();
                }
            }, 3000);
        }
    },

    updateMenuButton: (canInstall = false) => {
        const btn = document.getElementById('installAppBtn');
        const hint = document.getElementById('installHint');

        if (!btn) return;

        if (pwaInstall.isInstalled()) {
            btn.style.display = 'none';
            if (hint) hint.textContent = 'La app ya está instalada en este dispositivo';
            return;
        }

        if (pwaInstall.isIOS()) {
            btn.disabled = false;
            if (hint) hint.textContent = 'Ver instrucciones para instalar en iPhone/iPad';
            return;
        }

        if (canInstall || deferredPrompt) {
            btn.disabled = false;
            if (hint) hint.textContent = 'Instala la app en tu dispositivo para usarla offline';
        } else {
            btn.disabled = true;
            if (hint) hint.textContent = 'La instalación no está disponible en este navegador';
        }
    }
};

async function promptInstall() {
    console.log('[PWA Install] Install button clicked, deferredPrompt:', !!deferredPrompt);

    if (pwaInstall.isIOS()) {
        openIosInstallModal();
        return;
    }

    if (!deferredPrompt) {
        console.log('[PWA Install] No deferredPrompt available');
        ui.showToast('La instalación no está disponible en este navegador', 'info');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log('[PWA Install] User choice:', outcome);

    if (outcome === 'accepted') {
        pwaInstall.hideBanner();
    }

    deferredPrompt = null;
}

function dismissInstall() {
    pwaInstall.hideBanner();
    localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');
}

// Debug function - call from console: testInstallBanner()
window.testInstallBanner = function() {
    console.log('[PWA Install] Test banner - Debug info:', {
        isInstalled: pwaInstall.isInstalled(),
        isIOS: pwaInstall.isIOS(),
        isMobile: pwaInstall.isMobile(),
        deferredPrompt: !!deferredPrompt,
        dismissed: localStorage.getItem(STORAGE_KEYS.installDismissed)
    });
    pwaInstall.showBanner();
    return 'Banner shown. Check console for debug info.';
};

// Reset install dismissed - call from console: resetInstall()
window.resetInstall = function() {
    localStorage.removeItem(STORAGE_KEYS.installDismissed);
    console.log('[PWA Install] Install dismissed flag reset. Reload to see banner.');
    return 'Install flag reset. Reload page.';
};

function openIosInstallModal() {
    document.getElementById('iosInstallModal').classList.add('active');
}

function closeIosInstallModal() {
    document.getElementById('iosInstallModal').classList.remove('active');
}

// ============================================
// AUTH MODAL
// ============================================

let authMode = 'login'; // 'login' or 'signup'

function openAuthModal(mode = 'login') {
    authMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authModalTitle');
    const toggleBtn = document.getElementById('authToggleMode');
    const submitBtn = document.getElementById('authSubmitBtn');

    if (mode === 'signup') {
        title.textContent = 'Registrarse';
        toggleBtn.textContent = '¿Ya tienes cuenta? Inicia sesión';
        submitBtn.textContent = 'Registrarse';
    } else {
        title.textContent = 'Iniciar sesión';
        toggleBtn.textContent = '¿No tienes cuenta? Regístrate';
        submitBtn.textContent = 'Entrar';
    }

    modal.classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.getElementById('authForm').reset();
}

async function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    let result;
    if (authMode === 'signup') {
        result = await auth.signUp(email, password);
        if (result.success) {
            ui.showToast('Registro exitoso. ¡Bienvenido!', 'success');
            closeAuthModal();
        } else {
            ui.showToast(result.error || 'Error al registrarse', 'error');
        }
    } else {
        result = await auth.signIn(email, password);
        if (result.success) {
            ui.showToast('Sesión iniciada correctamente', 'success');
            closeAuthModal();
            loadSharedLists();
        } else {
            ui.showToast(result.error || 'Error al iniciar sesión', 'error');
        }
    }
}

function toggleAuthMode() {
    openAuthModal(authMode === 'login' ? 'signup' : 'login');
}

// ============================================
// SHARE LIST MODAL
// ============================================

function openShareListModal(listId) {
    currentShareListId = listId;
    document.getElementById('shareListModal').classList.add('active');
    loadListMembers(listId);
}

function closeShareListModal() {
    document.getElementById('shareListModal').classList.remove('active');
    document.getElementById('shareListForm').reset();
    currentShareListId = null;
}

async function loadListMembers(listId) {
    const membersList = document.getElementById('listMembersList');
    membersList.innerHTML = '<p style="font-size: var(--font-size-sm); color: var(--text-secondary);">Cargando miembros...</p>';

    try {
        // Get members from Supabase
        const { data, error } = await supabase
            .from('list_members')
            .select('*, profiles!inner(email)')
            .eq('list_id', listId);

        if (error) {
            // If not logged in or error, show placeholder
            membersList.innerHTML = '<p style="font-size: var(--font-size-sm); color: var(--text-secondary);">Inicia sesión para ver miembros</p>';
            return;
        }

        if (!data || data.length === 0) {
            membersList.innerHTML = '<p style="font-size: var(--font-size-sm); color: var(--text-secondary);">No hay miembros añadidos</p>';
            return;
        }

        // Get local list for owner info
        const localLists = await db.getAll(STORES.lists);
        const localList = localLists.find(l => l.id === listId);

        let membersHTML = '';

        // Add owner (you)
        if (currentUser && localList) {
            membersHTML += `
                <div class="list-member-item">
                    <span class="list-member-email">${currentUser.email} (Tú)</span>
                    <span class="list-member-role">Owner</span>
                </div>
            `;
        }

        // Add other members
        data.forEach(member => {
            if (member.user_id !== currentUser?.id) {
                const roleLabel = member.role === 'editor' ? 'Puede editar' : 'Solo ver';
                membersHTML += `
                    <div class="list-member-item">
                        <span class="list-member-email">${member.profiles.email}</span>
                        <span class="list-member-role">${roleLabel}</span>
                        ${member.role === 'viewer' ? `
                            <button class="list-member-remove" onclick="removeMember('${member.id}')" aria-label="Eliminar miembro">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                `;
            }
        });

        membersList.innerHTML = membersHTML;
    } catch (error) {
        console.error('[Share] Error loading members:', error);
        membersList.innerHTML = '<p style="font-size: var(--font-size-sm); color: var(--danger);">Error al cargar miembros</p>';
    }
}

// Make it global
window.removeMember = async function(memberId) {
    if (!confirm('¿Eliminar a este usuario de la lista?')) return;

    try {
        const { error } = await supabase
            .from('list_members')
            .delete()
            .eq('id', memberId);

        if (error) throw error;

        ui.showToast('Miembro eliminado', 'success');
        if (currentShareListId) {
            loadListMembers(currentShareListId);
        }
    } catch (error) {
        console.error('[Share] Error removing member:', error);
        ui.showToast('Error al eliminar miembro', 'error');
    }
};

async function handleShareListSubmit(e) {
    e.preventDefault();

    if (!auth.isAuthenticated()) {
        ui.showToast('Debes iniciar sesión para compartir listas', 'warning');
        closeShareListModal();
        openAuthModal('login');
        return;
    }

    const email = document.getElementById('shareEmail').value;
    const role = document.getElementById('shareRole').value;

    // Find user by email
    try {
        // First, find the user's profile by email
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (profileError || !profile) {
            ui.showToast('Usuario no encontrado. Debe estar registrado.', 'warning');
            return;
        }

        // Check if already a member
        const { data: existingMember, error: checkError } = await supabase
            .from('list_members')
            .select('*')
            .eq('list_id', currentShareListId)
            .eq('user_id', profile.id)
            .single();

        if (existingMember) {
            ui.showToast('Este usuario ya tiene acceso a esta lista', 'info');
            return;
        }

        // Create invitation
        const { error: inviteError } = await supabase
            .from('list_members')
            .insert({
                list_id: currentShareListId,
                user_id: profile.id,
                role: role,
                status: 'pending'
            });

        if (inviteError) {
            throw inviteError;
        }

        ui.showToast(`Invitación enviada a ${email}`, 'success');
        closeShareListModal();
        loadListMembers(currentShareListId);

    } catch (error) {
        console.error('[Share] Error sending invitation:', error);
        ui.showToast('Error al enviar la invitación', 'error');
    }
}

// ============================================
// SHARED LISTS
// ============================================

async function loadSharedLists() {
    if (!auth.isAuthenticated()) return;

    try {
        const { data, error } = await supabase
            .from('list_members')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'accepted');

        if (!error && data) {
            console.log('[Shared] Loaded shared lists:', data);
            // Sync shared lists with local IndexedDB
            for (const member of data) {
                // Check if list already exists locally
                const localList = await db.get(STORES.lists, member.list_id);
                if (!localList) {
                    // List doesn't exist locally, create placeholder
                    await db.put(STORES.lists, {
                        id: member.list_id,
                        name: `Lista compartida (${member.list_id.slice(0, 8)})`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        isShared: true,
                        sharedRole: member.role
                    });
                }
            }
            // Reload lists to show shared ones
            await dataOps.loadLists();
            ui.renderListsGrid();
        }
    } catch (error) {
        console.error('[Shared] Error loading shared lists:', error);
    }
}

// Subscribe to realtime changes for invitations
let invitationsSubscription = null;

function subscribeToInvitations() {
    if (!auth.isAuthenticated() || invitationsSubscription) return;

    invitationsSubscription = supabase
        .channel('invitations-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'list_members',
                filter: `user_id=eq.${currentUser.id}`
            },
            (payload) => {
                console.log('[Realtime] Invitation change:', payload);
                if (payload.eventType === 'INSERT') {
                    loadPendingInvitations();
                } else if (payload.eventType === 'UPDATE') {
                    loadPendingInvitations();
                } else if (payload.eventType === 'DELETE') {
                    loadPendingInvitations();
                }
            }
        )
        .subscribe((status) => {
            console.log('[Realtime] Invitations subscription status:', status);
        });
}

function unsubscribeFromInvitations() {
    if (invitationsSubscription) {
        supabase.removeChannel(invitationsSubscription);
        invitationsSubscription = null;
    }
}

async function loadPendingInvitations() {
    if (!auth.isAuthenticated()) return;

    try {
        const { data, error } = await supabase
            .from('list_members')
            .select('*, profiles!inner(email)')
            .eq('user_id', currentUser.id)
            .eq('status', 'pending');

        if (!error && data && data.length > 0) {
            renderInvitations(data);
        } else {
            document.getElementById('invitationsSection').style.display = 'none';
        }
    } catch (error) {
        console.error('[Shared] Error loading invitations:', error);
    }
}

function renderInvitations(invitations) {
    const section = document.getElementById('invitationsSection');
    const list = document.getElementById('invitationsList');

    if (invitations.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = invitations.map(inv => `
        <div class="invitation-card">
            <div class="invitation-info">
                <span class="invitation-list-name">Lista compartida</span>
                <span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Invitado por: ${inv.profiles.email}</span>
            </div>
            <div class="invitation-actions">
                <button class="btn btn-outline btn-small" onclick="respondToInvitation('${inv.id}', 'rejected')">Rechazar</button>
                <button class="btn btn-primary btn-small" onclick="respondToInvitation('${inv.id}', 'accepted')">Aceptar</button>
            </div>
        </div>
    `).join('');
}

async function respondToInvitation(memberId, response) {
    try {
        const { error } = await supabase
            .from('list_members')
            .update({ status: response })
            .eq('id', memberId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        ui.showToast(response === 'accepted' ? 'Invitación aceptada' : 'Invitación rechazada', 'success');
        await loadPendingInvitations();
        if (response === 'accepted') {
            await loadSharedLists();
        }
    } catch (error) {
        console.error('[Shared] Error responding to invitation:', error);
        ui.showToast('Error al responder a la invitación', 'error');
    }
}

// Make it global for onclick
window.respondToInvitation = respondToInvitation;

function handleInstallPrompt() {
    pwaInstall.init();
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    try {
        // Initialize Supabase Auth first
        auth.init();

        await db.open();

        await dataOps.loadLists();
        await dataOps.loadSettings();
        initTheme();

        navigation.showListsView();
        ui.renderListsGrid();

        if (appState.lists.length === 0) {
            await dataOps.createList('Mi Lista');
            await dataOps.loadLists();
            ui.renderListsGrid();
        }

        setupEventListeners();
        handleInstallPrompt();

        // Load shared lists and invitations if logged in
        if (auth.isAuthenticated()) {
            await loadSharedLists();
            await loadPendingInvitations();
            subscribeToInvitations();
        }

    } catch (error) {
        console.error('Error initializing app:', error);
        ui.showToast('Error al iniciar la aplicación', 'error');
    }
}

function setupEventListeners() {
    // Menu
    document.getElementById('menuBtn').addEventListener('click', openSidePanel);
    document.getElementById('sidePanelOverlay').addEventListener('click', closeSidePanel);
    document.getElementById('closeSidePanel').addEventListener('click', closeSidePanel);

    // Theme toggle
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);

    // Products view button
    document.getElementById('productsBtn').addEventListener('click', () => {
        navigation.showProductsView();
    });

    // Back from products
    document.getElementById('backFromProducts').addEventListener('click', () => {
        navigation.showListsView();
        ui.renderListsGrid();
    });

    // Back from items
    document.getElementById('backFromItems').addEventListener('click', () => {
        navigation.showListsView();
        ui.renderListsGrid();
    });

    // Stats button in items view
    document.getElementById('listStatsBtn').addEventListener('click', () => {
        navigation.showStatsView();
        ui.renderStats('all');
    });

    // Share button in items view
    document.getElementById('shareListBtn').addEventListener('click', () => {
        if (appState.currentListId) {
            openShareListModal(appState.currentListId);
        }
    });

    // Back from stats
    document.getElementById('backFromStats').addEventListener('click', () => {
        navigation.showItemsView();
    });

    // Time range selector
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ui.renderStats(btn.dataset.range);
        });
    });

    // Filter toggles
    const showPendingCheckbox = document.getElementById('showPending');
    const showCompletedCheckbox = document.getElementById('showCompleted');

    if (showPendingCheckbox) {
        showPendingCheckbox.addEventListener('change', (e) => {
            appState.showPending = e.target.checked;
            // Update visual state for browsers without :has support
            const toggle = e.target.closest('.filter-toggle');
            if (e.target.checked) {
                toggle.classList.add('checked');
            } else {
                toggle.classList.remove('checked');
            }
            ui.renderItems();
        });
        // Set initial visual state
        if (showPendingCheckbox.checked) {
            showPendingCheckbox.closest('.filter-toggle').classList.add('checked');
        }
    }

    if (showCompletedCheckbox) {
        showCompletedCheckbox.addEventListener('change', (e) => {
            appState.showCompleted = e.target.checked;
            const toggle = e.target.closest('.filter-toggle');
            if (e.target.checked) {
                toggle.classList.add('checked');
            } else {
                toggle.classList.remove('checked');
            }
            ui.renderItems();
        });
        if (showCompletedCheckbox.checked) {
            showCompletedCheckbox.closest('.filter-toggle').classList.add('checked');
        }
    }

    // Create list form
    document.getElementById('createListForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('newListName');
        const name = nameInput.value.trim();

        if (!name) return;

        await dataOps.createList(name);
        nameInput.value = '';

        await dataOps.loadLists();
        ui.renderListsGrid();
        utils.hapticFeedback();
        ui.showToast('Lista creada', 'success');
    });

    // Add item form
    document.getElementById('addItemForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('itemName').value.trim();
        const quantity = parseInt(document.getElementById('itemQuantity').value) || 1;
        const price = parseFloat(document.getElementById('itemPrice').value) || null;
        const imageUrl = document.getElementById('itemImage').value.trim() || null;

        if (!name) return;

        await dataOps.createItem({ name, quantity, price, imageUrl });
        utils.hapticFeedback();

        e.target.reset();
        document.getElementById('itemQuantity').value = 1;

        ui.renderItems();
        ui.showToast('Producto añadido', 'success');
    });

    // Edit list modal
    document.getElementById('editListModalOverlay').addEventListener('click', closeEditListModal);
    document.getElementById('closeEditListModal').addEventListener('click', closeEditListModal);

    document.getElementById('editListForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const listId = document.getElementById('editListId').value;
        const name = document.getElementById('editListName').value.trim();

        if (!name) return;

        await dataOps.updateList(listId, name);
        closeEditListModal();
        await dataOps.loadLists();
        ui.renderListsGrid();
        ui.showToast('Lista actualizada', 'success');
    });

    document.getElementById('deleteListBtn').addEventListener('click', () => {
        const listId = document.getElementById('editListId').value;
        closeEditListModal();
        confirmAction('¿Eliminar esta lista y todos sus productos?', async () => {
            await dataOps.deleteList(listId);
            ui.renderListsGrid();
            ui.showToast('Lista eliminada', 'success');
        });
    });

    // Edit item modal
    document.getElementById('editModalOverlay').addEventListener('click', closeEditModal);
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);

    document.getElementById('editItemForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const itemId = document.getElementById('editItemId').value;
        const item = appState.items.find(i => i.id === itemId);

        if (!item) return;

        item.name = document.getElementById('editItemName').value.trim();
        item.quantity = parseInt(document.getElementById('editItemQuantity').value) || 1;
        item.price = parseFloat(document.getElementById('editItemPrice').value) || null;
        item.imageUrl = document.getElementById('editItemImage').value.trim() || null;

        await dataOps.updateItem(item);
        closeEditModal();
        ui.renderItems();
        ui.showToast('Producto actualizado', 'success');
    });

    document.getElementById('deleteItemBtn').addEventListener('click', () => {
        const itemId = document.getElementById('editItemId').value;
        closeEditModal();
        confirmAction('¿Eliminar este producto?', async () => {
            await dataOps.deleteItem(itemId);
            ui.renderItems();
            ui.showToast('Producto eliminado', 'success');
        });
    });

    document.getElementById('editItemImage').addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const preview = document.getElementById('editImagePreview');
        if (url) {
            preview.innerHTML = `<img src="${utils.escapeHtml(url)}" alt="Preview" onerror="this.parentElement.innerHTML=''">`;
        } else {
            preview.innerHTML = '';
        }
    });

    // Settings checkboxes
    document.getElementById('autoDeleteCompleted').addEventListener('change', (e) => {
        dataOps.saveSetting('autoDeleteCompleted', e.target.checked);
    });

    document.getElementById('confirmBeforeDelete').addEventListener('change', (e) => {
        dataOps.saveSetting('confirmBeforeDelete', e.target.checked);
    });

    document.getElementById('hapticFeedback').addEventListener('change', (e) => {
        dataOps.saveSetting('hapticFeedback', e.target.checked);
    });

    document.getElementById('autoDeleteCompleted').checked = appState.settings.autoDeleteCompleted;
    document.getElementById('confirmBeforeDelete').checked = appState.settings.confirmBeforeDelete;
    document.getElementById('hapticFeedback').checked = appState.settings.hapticFeedback;

    // Export
    document.getElementById('exportBtn').addEventListener('click', async () => {
        const json = await dataOps.exportAllToJson();
        utils.downloadFile(json, `lista-compra-${new Date().toISOString().split('T')[0]}.json`);
        ui.showToast('Listas exportadas', 'success');
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const result = await dataOps.importFromJson(event.target.result);
            if (result.success) {
                ui.showToast(
                    `Importado: ${result.importedLists} listas, ${result.importedItems} productos`,
                    'success'
                );
                await dataOps.loadLists();
                ui.renderListsGrid();

                // If a list was imported, offer to open it
                if (result.listId) {
                    setTimeout(() => {
                        if (confirm('¿Abrir la lista importada?')) {
                            navigation.openList(result.listId);
                        }
                    }, 500);
                }
            } else {
                ui.showToast(result.error || 'Error al importar', 'error');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // Clear all data
    document.getElementById('clearDataBtn').addEventListener('click', () => {
        confirmAction('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.', async () => {
            await dataOps.clearAllData();
            await dataOps.createList('Mi Lista');
            await init();
            closeSidePanel();
            ui.showToast('Datos borrados', 'success');
        });
    });

    // Share modal
    document.getElementById('shareModalOverlay').addEventListener('click', closeShareModal);
    document.getElementById('closeShareModal').addEventListener('click', closeShareModal);
    document.getElementById('shareAppBtn').addEventListener('click', shareViaApp);
    document.getElementById('downloadJsonBtn').addEventListener('click', downloadJson);
    document.getElementById('copyJsonBtn').addEventListener('click', copyJson);

    // Products search
    document.getElementById('productsSearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = (appState.allProducts || []).filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.listName.toLowerCase().includes(searchTerm)
        );
        ui.renderProducts(filteredProducts);
    });

    // Price history modal
    document.getElementById('priceHistoryModalOverlay').addEventListener('click', closePriceHistoryModal);
    document.getElementById('closePriceHistoryModal').addEventListener('click', closePriceHistoryModal);
    document.getElementById('savePriceBtn').addEventListener('click', savePriceFromModal);

    // Install banner
    document.getElementById('installBtn').addEventListener('click', promptInstall);
    document.getElementById('dismissInstallBtn').addEventListener('click', dismissInstall);

    // Install menu button
    document.getElementById('installAppBtn').addEventListener('click', promptInstall);

    // iOS install modal
    document.getElementById('iosInstallModalOverlay').addEventListener('click', closeIosInstallModal);
    document.getElementById('closeIosInstallModal').addEventListener('click', closeIosInstallModal);

    // Auth modal
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());
    document.getElementById('authModalOverlay').addEventListener('click', closeAuthModal);
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('authToggleMode').addEventListener('click', toggleAuthMode);

    // Share list modal
    document.getElementById('shareListModalOverlay').addEventListener('click', closeShareListModal);
    document.getElementById('closeShareListModal').addEventListener('click', closeShareListModal);
    document.getElementById('shareListForm').addEventListener('submit', handleShareListSubmit);
    document.getElementById('cancelShareBtn').addEventListener('click', closeShareListModal);

    // Handle resize for chart
    window.addEventListener('resize', utils.debounce(() => {
        if (appState.currentView === 'stats') {
            ui.renderChart(appState.history);
        }
    }, 250));
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('Service Worker registered:', reg.scope);
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        console.log('Service Worker state:', newWorker.state);
                    });
                });
            })
            .catch(err => console.error('Service Worker registration failed:', err));
    });

    // Check service worker status
    navigator.serviceWorker.ready.then(reg => {
        console.log('Service Worker is ready:', reg);
    });
}

// Check manifest link
window.addEventListener('load', () => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        console.log('Manifest link found:', manifestLink.href);
        fetch(manifestLink.href)
            .then(response => {
                if (response.ok) {
                    console.log('Manifest is accessible');
                    return response.json();
                }
                throw new Error('Manifest not accessible');
            })
            .then(manifest => console.log('Manifest content:', manifest))
            .catch(err => console.error('Manifest error:', err));
    } else {
        console.error('No manifest link found in HTML');
    }
});

// ============================================
// START APP
// ============================================

init();

window.showToast = ui.showToast.bind(ui);
