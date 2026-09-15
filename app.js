import { openCategoryForm, openCategoryManager, openOnboarding, openPeriodPicker, openProfileSetup, openSettings, openTransactionModal } from './js/dialogs.js';
import { closeModal, toast } from './js/modal.js';
import { $ } from './js/utils.js';
import { createStore } from './js/store.js';
import { renderApp } from './js/views.js';

const store = createStore();
let openCategoryId = null;

function refresh(categoryId = openCategoryId) {
  openCategoryId = categoryId;
  renderApp(store, openCategoryId, actions);
}

const actions = {
  toggleCategory(categoryId) {
    openCategoryId = openCategoryId === categoryId ? null : categoryId;
    refresh();
  },
  openTransaction: (categoryId, type) => openTransactionModal(store, categoryId, type, refresh),
  removeExpense(categoryId, expenseId) {
    const expense = store.categoryLine(categoryId).expenses.find((item) => item.id === expenseId);
    if (!expense || !confirm(`Supprimer « ${expense.name} » ?`)) return;
    store.removeExpense(categoryId, expenseId);
    refresh();
    toast('Dépense supprimée.');
  },
  removeExtra(categoryId, extraId) {
    const extra = store.categoryLine(categoryId).extras?.find((item) => item.id === extraId);
    if (!extra || !confirm(`Supprimer l’extra « ${extra.name} » ?`)) return;
    store.removeExtra(categoryId, extraId);
    refresh();
    toast('Extra supprimé.');
  }
};

function shiftPeriod(direction) {
  const { id, isNewPeriod } = store.shiftPeriod(direction);
  const carry = isNewPeriod && direction > 0 && confirm('Reporter le restant de cette période vers la nouvelle ?');
  store.ensurePeriod(id, carry);
  store.setSelectedPeriod(id);
  refresh();
}

function initialize() {
  store.ensureCurrentPeriod();
  if (!store.state.settings.initialized || !store.state.categories.length) {
    store.updateSettings({ initialized: true });
    openOnboarding(store, refresh);
  } else if (!store.state.settings.userName) {
    refresh();
    openProfileSetup(store, refresh);
  } else {
    refresh();
  }

  $('#previousPeriod').addEventListener('click', () => shiftPeriod(-1));
  $('#nextPeriod').addEventListener('click', () => shiftPeriod(1));
  $('#periodSelector').addEventListener('click', () => openPeriodPicker(store, refresh));
  $('#manageCategories').addEventListener('click', () => openCategoryManager(store, refresh));
  $('#addCategoryButton').addEventListener('click', () => openCategoryForm(store, refresh));
  $('#settingsButton').addEventListener('click', () => openSettings(store, refresh));
  $('#settingsNav').addEventListener('click', () => openSettings(store, refresh));
  $('#historyNav').addEventListener('click', () => openPeriodPicker(store, refresh));
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

initialize();
