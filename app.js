// ============================================
// APP STATE & CONSTANTS
// ============================================

const DB_NAME = 'ShoppingListDB';
const DB_VERSION = 1;
const STORES = {
    lists: 'lists',
    items: 'items',
    settings: 'settings',
    history: 'history'
};

const STORAGE_KEYS = {
    theme: 'theme',
    currentList: 'currentListId',
    installDismissed: 'installDismissed'
};

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
        appState.items.sort((a, b) => {
            if (a.inShoppingList === b.inShoppingList) {
                return a.name.localeCompare(b.name);
            }
            return a.inShoppingList ? -1 : 1;
        });
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
            listId: appState.currentListId,
            inShoppingList: true,
            imageUrl: itemData.imageUrl || null,
            price: itemData.price || null,
            previousPrice: null,
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
            [STORES.lists, STORES.items, STORES.settings, STORES.history],
            'readwrite'
        );

        for (const storeName of [STORES.lists, STORES.items, STORES.history]) {
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
        document.getElementById('statsView').classList.remove('active');
        document.getElementById('appTitle').textContent = 'Mis Listas';
    },

    showItemsView() {
        appState.currentView = 'items';
        document.getElementById('listsView').classList.remove('active');
        document.getElementById('itemsView').classList.add('active');
        document.getElementById('statsView').classList.remove('active');
    },

    showStatsView() {
        appState.currentView = 'stats';
        document.getElementById('listsView').classList.remove('active');
        document.getElementById('itemsView').classList.remove('active');
        document.getElementById('statsView').classList.add('active');
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
                return `
                    <div class="list-card" data-list-id="${list.id}">
                        <div class="list-card-actions">
                            <button class="list-card-action-btn share" data-list-id="${list.id}" aria-label="Compartir">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="18" cy="5" r="3"/>
                                    <circle cx="6" cy="12" r="3"/>
                                    <circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                            </button>
                            <button class="list-card-action-btn edit" data-list-id="${list.id}" aria-label="Editar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="list-card-action-btn delete" data-list-id="${list.id}" aria-label="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                            </button>
                        </div>
                        <div class="list-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                        </div>
                        <div class="list-card-name">${utils.escapeHtml(list.name)}</div>
                        <div class="list-card-meta">
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

function handleInstallPrompt() {
    if (localStorage.getItem(STORAGE_KEYS.installDismissed)) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installBanner').style.display = '';
    });
}

async function promptInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
        document.getElementById('installBanner').style.display = 'none';
    }

    deferredPrompt = null;
}

function dismissInstall() {
    document.getElementById('installBanner').style.display = 'none';
    localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    try {
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
            shareList(appState.currentListId);
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

    // Install banner
    document.getElementById('installBtn').addEventListener('click', promptInstall);
    document.getElementById('dismissInstallBtn').addEventListener('click', dismissInstall);

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
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed', err));
    });
}

// ============================================
// START APP
// ============================================

init();

window.showToast = ui.showToast.bind(ui);
