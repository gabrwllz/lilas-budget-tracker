import { PALETTE } from "./constants.js";
import {
  $,
  dateKey,
  escapeHtml,
  formatDate,
  initialsForName,
  money,
} from "./utils.js";

export function renderApp(store, openCategoryId, actions) {
  const period = store.selectedPeriod();
  const total = store.totalForPeriod(period);
  const spent = store.spentForPeriod(period);
  const earliest = store.earliestPeriod();

  $("#globalRemaining").textContent = money(total - spent);
  $(".brand-mark").textContent = initialsForName(store.state.settings.userName);
  $("#globalSpent").textContent = `${money(spent)} dépensé sur ${money(total)}`;
  $("#periodStatus").textContent = store.periodIsCurrent()
    ? "Période actuelle"
    : "Historique";
  $("#periodSelector").innerHTML =
    `${formatDate(period.start)} au ${formatDate(period.end)} <span></span>`;
  $("#periodDates").textContent = formatDate(dateKey(new Date()), {
    day: "numeric",
    month: "long",
  });
  $("#previousPeriod").disabled = period.start === earliest.start;
  $("#nextPeriod").disabled = store.periodIsCurrent();

  const list = $("#categoryList");
  list.innerHTML = "";
  store.state.categories.forEach((category, index) => {
    list.appendChild(
      createCategoryCard(store, category, index, openCategoryId, actions),
    );
  });
  renderInsight(total - spent, spent, total);
}

function createCategoryCard(store, category, index, openCategoryId, actions) {
  const line = store.categoryLine(category.id);
  const remaining = line.allocated + line.extra - line.spent;
  const base = line.allocated + line.extra;
  const transactionCount =
    line.expenses.length +
    (Array.isArray(line.extras) ? line.extras.length : line.extra ? 1 : 0);
  const colors = PALETTE[index % PALETTE.length];
  const card = document.createElement("article");

  card.className = `category-card ${openCategoryId === category.id ? "open" : ""}`;
  card.style.animationDelay = `${index * 45}ms`;
  card.innerHTML = `<button class="category-header" type="button"><span class="category-icon" style="--accent:${colors.accent};--tint:${colors.tint}">${category.icon || colors.icon}</span><span class="category-info"><strong>${escapeHtml(category.name)}</strong><small>${transactionCount} transaction${transactionCount === 1 ? "" : "s"} · ${money(line.allocated)} alloué${line.extra ? ` + ${money(line.extra)} extra` : ""}</small></span><span class="category-remaining"><strong>${money(remaining)}</strong><small>restant</small></span></button><div class="progress-track"><div class="progress-value ${remaining < 0 ? "over" : ""}" style="width:${base ? Math.min(100, Math.max(0, (line.spent / base) * 100)) : 0}%;--accent:${colors.accent}"></div></div><div class="category-details"><div class="category-details-inner"><div class="expense-list">${transactionMarkup(line, periodStart(store))}</div><button class="primary-button" type="button" data-action="expense">＋ Ajouter une dépense</button><button class="secondary-button" type="button" data-action="extra">＋ Ajouter un extra</button></div></div>`;
  card
    .querySelector(".category-header")
    .addEventListener("click", () => actions.toggleCategory(category.id));
  card
    .querySelector('[data-action="expense"]')
    .addEventListener("click", () =>
      actions.openTransaction(category.id, "expense"),
    );
  card
    .querySelector('[data-action="extra"]')
    .addEventListener("click", () =>
      actions.openTransaction(category.id, "extra"),
    );
  card
    .querySelectorAll("[data-expense]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        actions.removeExpense(category.id, button.dataset.expense),
      ),
    );
  card
    .querySelectorAll("[data-extra]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        actions.removeExtra(category.id, button.dataset.extra),
      ),
    );
  return card;
}

function periodStart(store) {
  return store.selectedPeriod().start;
}

function transactionMarkup(line, periodStartKey) {
  const legacyExtras =
    !Array.isArray(line.extras) && line.extra
      ? [
          {
            id: "legacy-extra",
            name: "Extra",
            amount: line.extra,
            date: periodStartKey,
            legacy: true,
          },
        ]
      : [];
  const extras = Array.isArray(line.extras) ? line.extras : legacyExtras;
  const transactions = [
    ...line.expenses.map((item) => ({ ...item, type: "expense" })),
    ...extras.map((item) => ({ ...item, type: "extra" })),
  ].sort((first, second) => second.date.localeCompare(first.date));

  if (!transactions.length)
    return '<p class="empty-expenses">Aucune transaction ici pour le moment.</p>';
  return transactions
    .map(
      (transaction) =>
        `<div class="expense-row"><div><strong>${escapeHtml(transaction.name)}</strong><div class="expense-meta">${transaction.type === "extra" ? "Extra · " : ""}${formatDate(transaction.date, { day: "numeric", month: "short", year: "numeric" })}</div></div><div class="expense-actions"><span class="expense-amount ${transaction.type === "extra" ? "extra-amount" : ""}">${transaction.type === "extra" ? "+" : "−"} ${money(transaction.amount)}</span>${transaction.legacy ? "" : `<button class="delete-expense" type="button" data-${transaction.type}="${transaction.id}" aria-label="Supprimer ${escapeHtml(transaction.name)}">×</button>`}</div></div>`,
    )
    .join("");
}

function renderInsight(remaining, spent, total) {
  const ratio = total ? spent / total : 0;
  $("#insightTitle").textContent =
    remaining < 0
      ? "On ajuste doucement"
      : ratio > 0.75
        ? "La période avance bien"
        : "Petit pas, grand équilibre";
  $("#insightText").textContent =
    remaining < 0
      ? "Une enveloppe est dépassée. Tu peux ajouter un extra pour rééquilibrer."
      : ratio > 0.75
        ? "Tu as utilisé la majorité du budget de cette période."
        : "Chaque dépense ajoutée garde ton budget à jour.";
}
