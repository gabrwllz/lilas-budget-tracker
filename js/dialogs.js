import { FREQUENCY_LABELS, PALETTE } from './constants.js';
import { closeModal, showModal, toast } from './modal.js';
import { createId, dateKey, escapeHtml, formatDate, $, money } from './utils.js';

export function openTransactionModal(store, categoryId, type, refresh) {
  const category = store.categoryById(categoryId);
  const isExtra = type === 'extra';
  showModal(`<div class="modal-header"><div><span class="eyebrow">${isExtra ? 'Nouveau montant' : 'Nouvelle dépense'}</span><h2>${isExtra ? 'Ajouter un extra' : `Dans ${escapeHtml(category.name)}`}</h2></div><button class="close-button" type="button" aria-label="Fermer">×</button></div><form id="transactionForm" class="form-grid"><div class="field"><label for="transactionName">${isExtra ? 'Source de l’extra' : 'Nom de la dépense'}</label><input id="transactionName" required placeholder="${isExtra ? 'Ex. remboursement' : 'Ex. café du matin'}"></div><div class="field"><label for="transactionAmount">Montant</label><input id="transactionAmount" required min="0.01" step="0.01" type="number" inputmode="decimal" placeholder="0,00"></div><button class="primary-button" type="submit">${isExtra ? 'Ajouter à l’enveloppe' : 'Enregistrer la dépense'}</button></form>`);
  $('#transactionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#transactionName').value.trim();
    const amount = Number($('#transactionAmount').value);
    if (!name || !amount || amount < 0) return;
    const transaction = { id: createId(), name, amount, date: dateKey(new Date()) };
    if (isExtra) store.addExtra(categoryId, transaction);
    else store.addExpense(categoryId, transaction);
    closeModal();
    refresh(categoryId);
    toast(isExtra ? 'Extra ajouté à ton enveloppe.' : 'Dépense enregistrée.');
  });
  $('#transactionName').focus();
}

export function openCategoryManager(store, refresh) {
  showModal(`<div class="modal-header"><div><span class="eyebrow">Personnaliser</span><h2>Mes enveloppes</h2></div><button class="close-button" type="button" aria-label="Fermer">×</button></div><div class="manage-list">${store.state.categories.map((category, index) => `<div class="manage-item"><span class="category-icon" style="--accent:${PALETTE[index % PALETTE.length].accent};--tint:${PALETTE[index % PALETTE.length].tint}">${category.icon || PALETTE[index % PALETTE.length].icon}</span><span>${escapeHtml(category.name)}<small style="display:block;color:var(--muted);font-size:10px">${money(category.defaultAmount)} par défaut</small></span><button class="small-action" data-edit="${category.id}" type="button" aria-label="Renommer">✎</button><button class="small-action" data-remove="${category.id}" type="button" aria-label="Supprimer">×</button></div>`).join('')}</div><button class="primary-button" id="newCategory" type="button">＋ Nouvelle enveloppe</button>`);
  $('#newCategory').addEventListener('click', () => openCategoryForm(store, refresh));
  $('#modal').querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openCategoryForm(store, refresh, button.dataset.edit)));
  $('#modal').querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    const category = store.categoryById(button.dataset.remove);
    if (!category || !confirm(`Supprimer l’enveloppe « ${category.name} » et son historique ?`)) return;
    store.removeCategory(category.id);
    openCategoryManager(store, refresh);
    refresh();
  }));
}

export function openCategoryForm(store, refresh, editId = null) {
  const category = editId ? store.categoryById(editId) : null;
  showModal(`<div class="modal-header"><div><span class="eyebrow">${category ? 'Modifier' : 'Nouvelle enveloppe'}</span><h2>${category ? 'Ajuster l’enveloppe' : 'Créer une enveloppe'}</h2></div><button class="close-button" type="button" aria-label="Fermer">×</button></div><form id="categoryForm" class="form-grid"><div class="field"><label for="categoryName">Nom</label><input id="categoryName" required value="${category ? escapeHtml(category.name) : ''}" placeholder="Ex. Épicerie"></div><div class="field"><label for="categoryAmount">Montant par période</label><input id="categoryAmount" required min="0" step="0.01" type="number" inputmode="decimal" value="${category ? category.defaultAmount : ''}" placeholder="0,00"></div><button class="primary-button" type="submit">${category ? 'Enregistrer' : 'Ajouter l’enveloppe'}</button></form>`);
  $('#categoryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#categoryName').value.trim();
    const amount = Number($('#categoryAmount').value);
    if (!name || amount < 0) return;
    if (category) store.updateCategory(category.id, { name, defaultAmount: amount });
    else store.addCategory({ id: createId(), name, defaultAmount: amount, icon: PALETTE[store.state.categories.length % PALETTE.length].icon });
    closeModal();
    refresh();
    toast(category ? 'Enveloppe mise à jour.' : 'Enveloppe ajoutée.');
  });
  $('#categoryName').focus();
}

export function openSettings(store, refresh) {
  showModal(`<div class="modal-header"><div><span class="eyebrow">Configuration</span><h2>Mes réglages</h2></div><button class="close-button" type="button" aria-label="Fermer">×</button></div><form id="settingsForm" class="form-grid"><div class="field"><label for="userName">Ton nom</label><input id="userName" required value="${escapeHtml(store.state.settings.userName || '')}" placeholder="Ex. Gabrielle ou Gabrielle Tremblay"></div><div class="field"><label for="frequency">Fréquence de paie</label><select id="frequency">${Object.entries(FREQUENCY_LABELS).map(([value, label]) => `<option value="${value}" ${store.state.settings.frequency === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="nextPayday">Date d’une paie connue</label><input id="nextPayday" required type="date" value="${store.state.settings.nextPayday}"></div><p class="form-note">Une période commence le jour de paie et se termine la veille de la suivante.</p><button class="primary-button" type="submit">Enregistrer les réglages</button></form>`);
  $('#settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    store.updateSettings({ userName: $('#userName').value.trim(), frequency: $('#frequency').value, nextPayday: $('#nextPayday').value });
    const currentId = dateKey(store.periodForDate(new Date()).start);
    store.ensurePeriod(currentId);
    store.setSelectedPeriod(currentId);
    closeModal();
    refresh();
    toast('Réglages enregistrés.');
  });
}

export function openPeriodPicker(store, refresh) {
  const periods = Object.values(store.state.periods).sort((first, second) => second.start.localeCompare(first.start));
  const currentId = store.ensureCurrentPeriod();
  showModal(`<div class="modal-header"><div><span class="eyebrow">Tes cycles</span><h2>Historique</h2></div><button class="close-button" type="button" aria-label="Fermer">×</button></div><div class="history-list">${periods.map((period) => `<div class="history-period-row"><button class="history-period" data-period="${period.id}" type="button"><span><strong>${period.id === currentId ? 'Période actuelle' : formatDate(period.start, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>${formatDate(period.start)} au ${formatDate(period.end)}</small></span><b>${money(store.totalForPeriod(period) - store.spentForPeriod(period))}</b></button><button class="small-action history-delete" data-delete-period="${period.id}" type="button" aria-label="Supprimer la période du ${formatDate(period.start)}">×</button></div>`).join('')}</div>`);
  $('#modal').querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => { store.setSelectedPeriod(button.dataset.period); closeModal(); refresh(); }));
  $('#modal').querySelectorAll('[data-delete-period]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.deletePeriod === currentId) return toast('La période actuelle ne peut pas être supprimée.');
    if (!confirm(`Supprimer la période du ${formatDate(button.dataset.deletePeriod)} et toutes ses transactions ?`)) return;
    store.removePeriod(button.dataset.deletePeriod);
    openPeriodPicker(store, refresh);
    refresh();
    toast('Période supprimée.');
  }));
}

export function openOnboarding(store, refresh) {
  showModal(`<div class="modal-header"><div><span class="eyebrow">Bienvenue dans Lilas</span><h2>On part de zéro, ensemble.</h2></div></div><form id="onboardingForm" class="form-grid"><div class="field"><label for="onboardingName">Ton nom</label><input id="onboardingName" required placeholder="Ex. Gabrielle ou Gabrielle Tremblay"></div><div class="field"><label for="onboardingFrequency">Fréquence de paie</label><select id="onboardingFrequency">${Object.entries(FREQUENCY_LABELS).map(([value, label]) => `<option value="${value}" ${value === 'biweekly' ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="onboardingPayday">Date de la prochaine paie</label><input id="onboardingPayday" required type="date" value="${dateKey(new Date())}"></div><p class="form-note">Ton nom sert seulement à personnaliser l’icône de l’app.</p><button class="primary-button" type="submit">Configurer mon budget</button></form>`);
  $('#onboardingForm').addEventListener('submit', (event) => {
    event.preventDefault();
    store.updateSettings({ userName: $('#onboardingName').value.trim(), frequency: $('#onboardingFrequency').value, nextPayday: $('#onboardingPayday').value, initialized: true });
    const id = dateKey(store.periodForDate(new Date()).start);
    store.state.categories = [
      { id: 'home', name: 'Maison', defaultAmount: 800, icon: '⌂' },
      { id: 'fun', name: 'Plaisir', defaultAmount: 180, icon: '✦' },
      { id: 'transport', name: 'Transport', defaultAmount: 120, icon: '♢' }
    ];
    store.ensurePeriod(id);
    store.setSelectedPeriod(id);
    store.save();
    closeModal();
    refresh();
    toast('Ton budget est prêt.');
  });
}

export function openProfileSetup(store, refresh) {
  showModal(`<div class="modal-header"><div><span class="eyebrow">Personnalisation</span><h2>Comment t’appelles-tu ?</h2></div></div><form id="profileForm" class="form-grid"><div class="field"><label for="profileName">Ton nom</label><input id="profileName" required placeholder="Ex. Gabrielle ou Gabrielle Tremblay"></div><p class="form-note">Ton nom sert seulement à créer tes initiales dans l’icône de l’app.</p><button class="primary-button" type="submit">Continuer</button></form>`);
  $('#profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    store.updateSettings({ userName: $('#profileName').value.trim() });
    closeModal();
    refresh();
  });
}
