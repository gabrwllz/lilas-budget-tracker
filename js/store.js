import { STORAGE_KEY } from "./constants.js";
import { addDays, dateKey, fromKey } from "./utils.js";

function defaultState() {
  return {
    settings: {
      frequency: "biweekly",
      nextPayday: dateKey(new Date()),
      initialized: false,
      userName: "",
      pendingPayroll: null,
    },
    categories: [],
    periods: {},
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.settings?.nextPayday && Array.isArray(saved.categories)) {
      saved.settings.userName ||= "";
      saved.settings.pendingPayroll ||= null;
      saved.periods ||= {};
      return saved;
    }
  } catch (error) {
    // Corrupted local data falls back to a fresh budget.
  }
  return defaultState();
}

export function createStore() {
  const state = loadState();
  let selectedPeriodId = null;

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const categoryById = (id) =>
    state.categories.find((category) => category.id === id);
  const frequencyDays = () =>
    ({ weekly: 7, biweekly: 14, semimonthly: 15, monthly: null })[
      state.settings.frequency
    ];

  function periodForDate(date) {
    const reference = fromKey(state.settings.nextPayday);
    const target = new Date(date);
    target.setHours(12, 0, 0, 0);
    let start = new Date(reference);

    if (state.settings.frequency === "semimonthly") {
      while (target < start) start = addDays(start, -15);
      while (target >= addDays(start, 15)) start = addDays(start, 15);
      return { start, end: addDays(start, 14) };
    }

    if (state.settings.frequency === "monthly") {
      while (target < start) start.setMonth(start.getMonth() - 1);
      while (addDays(start, 31) <= target) start.setMonth(start.getMonth() + 1);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(start.getDate() - 1);
      if (target < start) {
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
      }
      return { start, end };
    }

    const days = frequencyDays();
    const diff = Math.floor((target - start) / 86400000);
    start = addDays(start, Math.floor(diff / days) * days);
    if (target < start) start = addDays(start, -days);
    return { start, end: addDays(start, days - 1) };
  }

  function ensurePeriod(id, carry = false) {
    if (!state.periods[id]) {
      const previous = Object.values(state.periods)
        .sort((first, second) => first.start.localeCompare(second.start))
        .filter((period) => period.start < id)
        .pop();
      state.periods[id] = {
        id,
        start: id,
        end: dateKey(periodForDate(fromKey(id)).end),
        categories: {},
      };
      state.categories.forEach((category) => {
        const previousLine = previous?.categories?.[category.id];
        const carried =
          carry && previousLine
            ? Math.max(
                0,
                previousLine.allocated -
                  previousLine.spent +
                  previousLine.extra,
              )
            : 0;
        state.periods[id].categories[category.id] = createCategoryLine(
          Number(category.defaultAmount) + carried,
        );
      });
    }

    state.categories.forEach((category) => {
      if (!state.periods[id].categories[category.id]) {
        state.periods[id].categories[category.id] = createCategoryLine(
          Number(category.defaultAmount),
        );
      }
    });
    save();
    return state.periods[id];
  }

  function createCategoryLine(allocated) {
    return { allocated, spent: 0, extra: 0, extras: [], expenses: [] };
  }

  function ensureCurrentPeriod() {
    const today = new Date();
    let currentId = dateKey(periodForDate(today).start);
    const currentPeriod = state.periods[currentId];
    if (
      state.settings.pendingPayroll &&
      currentPeriod &&
      dateKey(today) > currentPeriod.end
    ) {
      Object.assign(state.settings, state.settings.pendingPayroll);
      state.settings.pendingPayroll = null;
      currentId = dateKey(periodForDate(today).start);
    }
    ensurePeriod(currentId);
    selectedPeriodId ||= currentId;
    return currentId;
  }

  function selectedPeriod() {
    return (
      state.periods[selectedPeriodId] || ensurePeriod(ensureCurrentPeriod())
    );
  }

  return {
    state,
    save,
    categoryById,
    periodForDate,
    ensurePeriod,
    ensureCurrentPeriod,
    selectedPeriod,
    setSelectedPeriod: (id) => {
      selectedPeriodId = id;
    },
    getSelectedPeriodId: () => selectedPeriodId,
    periodIsCurrent: () => selectedPeriodId === ensureCurrentPeriod(),
    categoryLine: (categoryId) =>
      selectedPeriod().categories[categoryId] || createCategoryLine(0),
    earliestPeriod: () =>
      Object.values(state.periods).sort((first, second) =>
        first.start.localeCompare(second.start),
      )[0] || selectedPeriod(),
    totalForPeriod: (period) =>
      Object.values(period.categories).reduce(
        (sum, line) => sum + line.allocated + line.extra,
        0,
      ),
    spentForPeriod: (period) =>
      Object.values(period.categories).reduce(
        (sum, line) => sum + line.spent,
        0,
      ),
    addExpense(categoryId, expense) {
      const line = selectedPeriod().categories[categoryId];
      line.spent += expense.amount;
      line.expenses.unshift(expense);
      save();
    },
    removeExpense(categoryId, expenseId) {
      const line = selectedPeriod().categories[categoryId];
      const expense = line.expenses.find((item) => item.id === expenseId);
      if (!expense) return false;
      line.expenses = line.expenses.filter((item) => item.id !== expenseId);
      line.spent = Math.max(0, line.spent - expense.amount);
      save();
      return true;
    },
    addExtra(categoryId, extra) {
      const line = selectedPeriod().categories[categoryId];
      line.extra += extra.amount;
      line.extras ||= [];
      line.extras.unshift(extra);
      save();
    },
    removeExtra(categoryId, extraId) {
      const line = selectedPeriod().categories[categoryId];
      const extra = line.extras?.find((item) => item.id === extraId);
      if (!extra) return false;
      line.extras = line.extras.filter((item) => item.id !== extraId);
      line.extra = Math.max(0, line.extra - extra.amount);
      save();
      return true;
    },
    updateSettings(settings) {
      Object.assign(state.settings, settings);
      save();
    },
    updatePayrollSettings(
      settings,
      { scope = "current", resetCurrent = false } = {},
    ) {
      if (scope === "next") {
        state.settings.pendingPayroll = settings;
        save();
        return;
      }

      const today = new Date();
      const previousId = dateKey(periodForDate(today).start);
      const currentPeriod = ensurePeriod(previousId);
      Object.assign(state.settings, settings);
      state.settings.pendingPayroll = null;
      const nextId = dateKey(periodForDate(today).start);

      if (nextId !== previousId) {
        delete state.periods[nextId];
        currentPeriod.id = nextId;
        currentPeriod.start = nextId;
        currentPeriod.end = dateKey(periodForDate(today).end);
        state.periods[nextId] = currentPeriod;
        delete state.periods[previousId];
      } else {
        currentPeriod.end = dateKey(periodForDate(today).end);
      }

      if (resetCurrent) {
        Object.keys(currentPeriod.categories).forEach((categoryId) => {
          const category = categoryById(categoryId);
          currentPeriod.categories[categoryId] = createCategoryLine(
            Number(category?.defaultAmount || 0),
          );
        });
      }
      save();
    },
    updateCategory(id, values) {
      const category = categoryById(id);
      if (!category) return;
      Object.assign(category, values);
      const currentLine = selectedPeriod().categories[id];
      if (currentLine) currentLine.allocated = values.defaultAmount;
      save();
    },
    addCategory(category) {
      state.categories.push(category);
      Object.values(state.periods).forEach((period) => {
        period.categories[category.id] = createCategoryLine(
          category.defaultAmount,
        );
      });
      save();
    },
    removeCategory(id) {
      state.categories = state.categories.filter(
        (category) => category.id !== id,
      );
      Object.values(state.periods).forEach(
        (period) => delete period.categories[id],
      );
      save();
    },
    removePeriod(id) {
      delete state.periods[id];
      save();
    },
    shiftPeriod(direction) {
      const current = selectedPeriod();
      if (direction > 0 && state.settings.pendingPayroll) {
        Object.assign(state.settings, state.settings.pendingPayroll);
        state.settings.pendingPayroll = null;
      }
      const date = fromKey(current.start);
      const next =
        state.settings.frequency === "monthly"
          ? new Date(date.setMonth(date.getMonth() + direction))
          : addDays(date, (frequencyDays() || 15) * direction);
      const id = dateKey(periodForDate(next).start);
      const isNewPeriod = !state.periods[id];
      return { id, isNewPeriod };
    },
  };
}
