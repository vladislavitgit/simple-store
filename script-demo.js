import { catalogConfig } from './config.js';
import { fetchSheet, renderProducts, renderServices } from './catalog.js';
import { initializePhoneInput, phoneDigits, formatPhoneNumber } from './phone.js';

const productContainer = document.getElementById('products');
const serviceContainer = document.getElementById('services');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealObserver = !reducedMotion.matches && 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        }
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' })
    : null;

function revealElements(container) {
    if (!revealObserver || reducedMotion.matches) return;
    for (const element of container.querySelectorAll('[data-reveal]')) {
        if ((element.parentElement?.classList.contains('page-view') || element.parentElement?.classList.contains('info-panel')) && !element.classList.contains('request-section')) continue;
        element.classList.add('reveal-pending');
        element.classList.remove('is-visible');
        revealObserver.observe(element);
    }
}

const views = [...document.querySelectorAll('.page-view')];
const navLinks = [...document.querySelectorAll('[data-view]')];
let currentView = '';
let requestedView = '';
let viewTransitionId = 0;
let viewTimer;

function scheduleView(callback, delay, id) {
    viewTimer = setTimeout(() => {
        if (id === viewTransitionId) callback();
    }, delay);
}

function clearViewTransition() {
    clearTimeout(viewTimer);
    for (const view of views) {
        view.classList.remove('view-enter', 'view-ready');
    }
}

function initializeCompanyMap() {
    const container = document.getElementById('company-map');
    if (container.dataset.initialized) return;
    container.dataset.initialized = 'true';
    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = 'https://api-maps.yandex.ru/services/constructor/1.0/js/?um=constructor%3A61a0291ba3c11a85eca4ca3b6d78f5a16f99619e5040240d9819cc43792c0459&width=100%25&height=100%25&lang=ru_RU&scroll=true';
    script.addEventListener('error', () => {
        delete container.dataset.initialized;
        script.remove();
    }, { once: true });
    container.append(script);
}

function activateView(page, id, animate, prepareReveal = true) {
    if (id !== viewTransitionId) return;
    const changed = page !== currentView;
    for (const view of views) {
        view.hidden = view.id !== `${page}-view`;
        view.inert = view.hidden;
        view.classList.remove('view-exit', 'view-enter', 'view-ready');
    }
    currentView = page;
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
    const view = document.getElementById(`${page}-view`);
    if (page === 'about') initializeCompanyMap();
    if (prepareReveal) revealElements(view);
    if (!animate || reducedMotion.matches) return;
    const children = [...view.children]
        .filter(child => !['product-grid', 'services-section', 'request-section'].some(name => child.classList.contains(name)));
    const duration = 900;
    view.style.setProperty('--text-duration', `${duration}ms`);
    const delays = children.map((_, index) => index * 50);
    children.forEach((child, index) => {
        child.classList.add('view-text');
        child.style.setProperty('--view-delay', `${delays[index]}ms`);
    });
    view.classList.add('view-enter');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (id !== viewTransitionId) return;
        view.classList.add('view-ready');
        scheduleView(() => view.classList.remove('view-enter', 'view-ready'), (delays.at(-1) ?? 0) + duration, id);
    }));
}

function showView() {
    const hash = window.location.hash.slice(1);
    const page = navLinks.some(link => link.dataset.view === hash) ? hash : 'catalog';
    if (page === requestedView) return;
    requestedView = page;
    const id = ++viewTransitionId;
    clearViewTransition();
    for (const link of navLinks) {
        if (link.dataset.view === page) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    document.title = `${{ catalog: 'Каталог', about: 'О компании', reviews: 'Отзывы' }[page]} — Simple Store`;
    if (!currentView || reducedMotion.matches) {
        activateView(page, id, !currentView);
        return;
    }
    const outgoing = document.getElementById(`${currentView}-view`);
    if (page === currentView) {
        outgoing.classList.remove('view-exit');
        outgoing.inert = false;
        return;
    }
    outgoing.inert = true;
    outgoing.classList.add('view-exit');
    scheduleView(() => activateView(page, id, true), 440, id);
}

for (const link of navLinks) {
    link.addEventListener('click', () => {
        if (link.dataset.view === currentView && currentView === requestedView) {
            window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
        }
    });
}
window.addEventListener('hashchange', showView);
window.addEventListener('resize', () => {
    if (!requestedView || (currentView === requestedView && !views.some(view => view.classList.contains('view-enter')))) return;
    const changed = currentView !== requestedView;
    const id = ++viewTransitionId;
    clearViewTransition();
    activateView(requestedView, id, false, changed);
});
showView();

function showStatus(container, message, retry) {
    const status = document.createElement('div');
    status.className = 'catalog-status';
    const text = document.createElement('p');
    text.textContent = message;
    status.append(text);
    if (retry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Попробовать ещё раз';
        button.addEventListener('click', retry, { once: true });
        status.append(button);
    }
    container.replaceChildren(status);
}

async function loadCatalog(kind) {
    const container = kind === 'products' ? productContainer : serviceContainer;
    const url = kind === 'products' ? catalogConfig.productsCsvUrl : catalogConfig.servicesCsvUrl;
    container.setAttribute('aria-busy', 'true');
    showStatus(container, kind === 'products' ? 'Загружаем ассортимент…' : 'Загружаем услуги…');
    try {
        if (!url) {
            showStatus(container, 'Список услуг скоро появится. Оставьте заявку — обсудим, чем можем помочь.');
            return;
        }
        const items = await fetchSheet(url, kind, catalogConfig.cacheDuration);
        if (!items.length) {
            showStatus(container, kind === 'products' ? 'В каталоге пока нет товаров. Уточните ассортимент, оставив заявку.' : 'Список услуг пока пуст. Оставьте заявку, чтобы обсудить задачу.');
        } else if (kind === 'products') {
            renderProducts(container, items, catalogConfig.productImages);
        } else {
            renderServices(container, items);
        }
        revealElements(container);
    } catch (error) {
        console.error(`Ошибка загрузки ${kind}:`, error);
        showStatus(container, kind === 'products' ? 'Не удалось загрузить товары. Попробуйте ещё раз или оставьте заявку.' : 'Не удалось загрузить услуги. Попробуйте ещё раз или оставьте заявку.', () => loadCatalog(kind));
    } finally {
        container.setAttribute('aria-busy', 'false');
    }
}

const overlay = document.getElementById('reservation-overlay');
const pageContent = document.getElementById('page-content');
const form = document.getElementById('reservation-form');
const nameInput = form.elements.namedItem('name');
const phoneInput = form.elements.namedItem('phone');
const itemInput = form.elements.namedItem('item');
const selection = document.getElementById('reservation-selection');
const status = document.getElementById('reservation-status');
const submitButton = form.querySelector('[type="submit"]');
let returnFocus = null;
let submitting = false;
initializePhoneInput(phoneInput);

function openModal(trigger) {
    returnFocus = trigger;
    if (!submitting) {
        itemInput.value = trigger.dataset.request || '';
        status.textContent = '';
        delete status.dataset.state;
    }
    selection.hidden = !itemInput.value;
    selection.textContent = itemInput.value ? `Ваш выбор: ${itemInput.value}` : '';
    overlay.inert = false;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    pageContent.inert = true;
    document.body.style.overflow = 'hidden';
    nameInput.focus({ preventScroll: true });
}

function closeModal() {
    pageContent.inert = false;
    returnFocus?.focus({ preventScroll: true });
    overlay.inert = true;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-request]');
    if (trigger) openModal(trigger);
});
document.getElementById('reservation-back').addEventListener('click', closeModal);
overlay.addEventListener('click', event => {
    if (event.target === overlay) closeModal();
});
overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button:not(:disabled), input:not([type="hidden"]):not(:disabled), a[href]')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

form.addEventListener('submit', event => {
    event.preventDefault();
    if (phoneInput.value) phoneInput.value = formatPhoneNumber(phoneDigits(phoneInput.value));
    if (!form.reportValidity()) return;
    status.textContent = 'Демо-версия, бот не подключен';
    status.dataset.state = 'success';
    form.reset();
    selection.hidden = true;
});

loadCatalog('products');
loadCatalog('services');
