const sheetCache = new Map();

export function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"' && quoted && next === '"') {
            cell += '"';
            index++;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === ',' && !quoted) {
            row.push(cell.trim());
            cell = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') index++;
            row.push(cell.trim());
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    if (quoted) throw new Error('CSV содержит незакрытую кавычку.');
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
    return rows;
}

export function rowsToItems(rows, kind) {
    if (!rows.length) return [];
    const headers = rows[0].map(value => value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' '));
    const aliases = {
        name: kind === 'services' ? ['услуга', 'название услуги', 'название', 'наименование'] : ['название', 'товар', 'название товара', 'наименование'],
        price: ['цена', 'стоимость', 'цена руб', 'цена, руб.'],
        quantity: ['наличие шт', 'количество', 'остаток'],
        availability: ['наличие в магазинах', 'наличие'],
        description: ['описание', 'описание услуги'],
        duration: ['длительность', 'срок', 'время']
    };
    const columns = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(header => names.includes(header))]));
    if (columns.name === -1) throw new Error('Не найдена колонка с названием.');
    return rows.slice(1).map(row => Object.fromEntries(Object.entries(columns).map(([field, column]) => [field, column < 0 ? '' : row[column] || '']))).filter(item => item.name);
}

export async function fetchSheet(url, kind, cacheDuration) {
    const cached = sheetCache.get(url);
    if (cached && Date.now() < cached.expires) return cached.request;
    const entry = { expires: Infinity, request: null };
    entry.request = (async () => {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (/^\s*</.test(text)) throw new Error('Вместо CSV получена HTML-страница.');
            const items = rowsToItems(parseCSV(text), kind);
            entry.expires = Date.now() + cacheDuration;
            return items;
        } catch (error) {
            sheetCache.delete(url);
            throw error;
        }
    })();
    sheetCache.set(url, entry);
    return entry.request;
}

export function formatPrice(value) {
    if (!value) return 'По запросу';
    const normalized = value.replace(/[\s\u00a0]/g, '');
    if (/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) {
        return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(normalized.replace(',', '.')))} ₽`;
    }
    if (/^\d{1,3}(?:,\d{3})+$/.test(normalized)) {
        return `${new Intl.NumberFormat('ru-RU').format(Number(normalized.replace(/,/g, '')))} ₽`;
    }
    return /[₽руб]/i.test(value) ? value : `${value} ₽`;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function requestButton(item, className) {
    const button = createElement('button', className, '↗');
    button.type = 'button';
    button.dataset.request = item.name;
    button.setAttribute('aria-label', `Оставить заявку: ${item.name}`);
    return button;
}

export function productImageFile(name, images) {
    const key = name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
    return images[key] || '';
}

export function renderProducts(container, products, images = {}) {
    const fragment = document.createDocumentFragment();
    for (const [index, product] of products.entries()) {
        const card = createElement('article', 'product-card');
        card.dataset.reveal = '';
        const unavailable = product.quantity !== '' && Number(product.quantity.replace(/\s/g, '')) === 0;
        const stock = product.quantity === '' ? 'Наличие уточняется' : unavailable ? 'Нет в наличии' : 'В наличии';
        const badge = createElement('span', `stock-badge${unavailable ? ' is-unavailable' : ''}`, stock);
        const visual = createElement('div', 'product-visual');
        const imageFile = productImageFile(product.name, images);
        const missingImage = () => visual.replaceChildren(createElement('span', 'image-unavailable', 'Фото скоро появится'));
        if (imageFile) {
            const image = createElement('img', 'product-image');
            image.src = `images/${encodeURIComponent(imageFile)}`;
            image.alt = product.name;
            image.width = 1254;
            image.height = 1254;
            image.loading = index < 3 ? 'eager' : 'lazy';
            image.decoding = 'async';
            image.addEventListener('error', missingImage, { once: true });
            visual.append(image);
        } else {
            missingImage();
        }
        const bottom = createElement('div', 'product-bottom');
        bottom.append(createElement('span', 'product-price', formatPrice(product.price)), requestButton(product, 'product-select'));
        card.append(badge, visual, createElement('h3', '', product.name));
        if (product.availability) card.append(createElement('p', 'product-availability', product.availability));
        card.append(bottom);
        fragment.append(card);
    }
    container.replaceChildren(fragment);
}

export function renderServices(container, services) {
    const fragment = document.createDocumentFragment();
    services.forEach((service, index) => {
        const row = createElement('article', 'service-row');
        row.dataset.reveal = '';
        row.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 60}ms`);
        const description = createElement('div', 'service-description');
        description.append(createElement('h3', '', service.name));
        if (service.description) description.append(createElement('p', '', service.description));
        if (service.duration) description.append(createElement('p', '', `Срок: ${service.duration}`));
        row.append(description, createElement('span', 'service-price', formatPrice(service.price)), requestButton(service, 'service-select'));
        fragment.append(row);
    });
    container.replaceChildren(fragment);
}
