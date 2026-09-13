/**
 * ClearSpend - UI Module
 * Handles DOM manipulation, transaction lists, metric cards, modals, and toasts.
 */

const UI = (() => {
  // Elements
  const netBalanceDisplay = document.getElementById('netBalanceDisplay');
  const monthlyIncomeDisplay = document.getElementById('monthlyIncomeDisplay');
  const monthlyExpenseDisplay = document.getElementById('monthlyExpenseDisplay');
  const budgetRemainingDisplay = document.getElementById('budgetRemainingDisplay');
  const budgetProgressBar = document.getElementById('budgetProgressBar');
  const budgetSpentRatio = document.getElementById('budgetSpentRatio');
  const budgetPercentage = document.getElementById('budgetPercentage');
  const transactionCountBadge = document.getElementById('transactionCountBadge');
  const transactionsList = document.getElementById('transactionsList');
  const emptyState = document.getElementById('emptyState');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const transactionModal = document.getElementById('transactionModal');
  const budgetModal = document.getElementById('budgetModal');
  const helpModal = document.getElementById('helpModal');

  // Modal form inputs
  const transactionForm = document.getElementById('transactionForm');
  const editTransactionId = document.getElementById('editTransactionId');
  const modalTitle = document.getElementById('modalTitle');
  const txTitle = document.getElementById('txTitle');
  const txAmount = document.getElementById('txAmount');
  const txDate = document.getElementById('txDate');
  const txCategory = document.getElementById('txCategory');
  const txNotes = document.getElementById('txNotes');
  const typeExpenseLabel = document.getElementById('typeExpenseLabel');
  const typeIncomeLabel = document.getElementById('typeIncomeLabel');
  const formCurrencyPrefix = document.getElementById('formCurrencyPrefix');
  const budgetCurrencyLabel = document.getElementById('budgetCurrencyLabel');
  const budgetInput = document.getElementById('budgetInput');
  const categoryFilter = document.getElementById('categoryFilter');

  /**
   * Format ISO date (YYYY-MM-DD) to friendly format
   */
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  /**
   * Escape HTML to prevent XSS
   */
  const escapeHTML = (str) => {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  };

  /**
   * Render Top Metric Cards & Budget Progress
   */
  const updateMetrics = () => {
    const all = Store.getTransactions();
    const currency = Store.getCurrencySymbol();
    formCurrencyPrefix.textContent = currency;
    budgetCurrencyLabel.textContent = currency;

    // Calculate all-time net balance
    let totalIncomeAllTime = 0;
    let totalExpenseAllTime = 0;
    all.forEach(t => {
      if (t.type === 'income') totalIncomeAllTime += t.amount;
      else totalExpenseAllTime += t.amount;
    });
    const netBalance = totalIncomeAllTime - totalExpenseAllTime;
    netBalanceDisplay.textContent = Store.formatMoney(netBalance);
    netBalanceDisplay.className = `metric-value ${netBalance >= 0 ? 'text-success' : 'text-danger'}`;

    // Current calendar month stats
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    all.forEach(t => {
      if (t.date && t.date.startsWith(currentMonthKey)) {
        if (t.type === 'income') monthlyIncome += t.amount;
        else monthlyExpense += t.amount;
      }
    });

    monthlyIncomeDisplay.textContent = Store.formatMoney(monthlyIncome);
    monthlyExpenseDisplay.textContent = Store.formatMoney(monthlyExpense);

    // Budget Calculations
    const budget = Store.getBudget();
    const remaining = budget - monthlyExpense;
    const ratio = budget > 0 ? (monthlyExpense / budget) * 100 : 0;
    const boundedPct = Math.min(100, Math.max(0, ratio));

    if (remaining >= 0) {
      budgetRemainingDisplay.textContent = Store.formatMoney(remaining);
      budgetRemainingDisplay.className = 'metric-value';
    } else {
      budgetRemainingDisplay.textContent = `-${Store.formatMoney(Math.abs(remaining))}`;
      budgetRemainingDisplay.className = 'metric-value text-danger';
    }

    budgetSpentRatio.textContent = `Spent: ${Store.formatMoney(monthlyExpense)} / ${Store.formatMoney(budget)}`;
    budgetPercentage.textContent = `${Math.round(ratio)}%`;
    budgetProgressBar.style.width = `${boundedPct}%`;

    // Progress bar color alert
    budgetProgressBar.classList.remove('progress-warning', 'progress-danger');
    if (ratio >= 100) {
      budgetProgressBar.classList.add('progress-danger');
    } else if (ratio >= 75) {
      budgetProgressBar.classList.add('progress-warning');
    }
  };

  /**
   * Render List of Transactions
   */
  const renderTransactions = (transactions, onEdit, onDelete) => {
    transactionCountBadge.textContent = `${transactions.length} record${transactions.length === 1 ? '' : 's'}`;

    if (transactions.length === 0) {
      transactionsList.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    transactionsList.innerHTML = transactions.map(t => {
      const isExpense = t.type === 'expense';
      const cat = Store.getCategoryInfo(t.type, t.category);
      const sign = isExpense ? '-' : '+';
      const amountClass = isExpense ? 'amount-expense' : 'amount-income';
      const rowTypeClass = isExpense ? 'type-expense' : 'type-income';
      const icon = isExpense ? '🔻' : '🔺';

      return `
        <div class="transaction-row ${rowTypeClass}" data-id="${t.id}">
          <div class="col-type">
            <div class="type-indicator-circle" title="${t.type.toUpperCase()}">${icon}</div>
          </div>
          <div class="col-info tx-main-info">
            <div class="tx-title">${escapeHTML(t.title)}</div>
            ${t.notes ? `<div class="tx-notes" title="${escapeHTML(t.notes)}">${escapeHTML(t.notes)}</div>` : ''}
          </div>
          <div class="col-cat">
            <span class="category-badge">
              <span>${cat.icon}</span>
              <span>${escapeHTML(cat.name)}</span>
            </span>
          </div>
          <div class="col-date">${formatDate(t.date)}</div>
          <div class="col-amount ${amountClass}">
            ${sign}${Store.formatMoney(t.amount)}
          </div>
          <div class="col-actions">
            <button class="action-btn edit-btn" data-id="${t.id}" title="Edit transaction">✏️</button>
            <button class="action-btn delete-btn" data-id="${t.id}" title="Delete transaction">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events
    transactionsList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => onEdit(btn.dataset.id));
    });

    transactionsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => onDelete(btn.dataset.id));
    });
  };

  /**
   * Populate Category Dropdown inside Add/Edit Modal
   */
  const populateModalCategories = (type) => {
    const list = Store.CATEGORIES[type] || [];
    txCategory.innerHTML = list.map(c => `
      <option value="${c.id}">${c.icon} ${c.name}</option>
    `).join('');
  };

  /**
   * Populate Category Filter dropdown in Toolbar
   */
  const populateFilterCategories = () => {
    const allCategories = [
      ...Store.CATEGORIES.expense.map(c => ({ ...c, group: 'Expenses' })),
      ...Store.CATEGORIES.income.map(c => ({ ...c, group: 'Income' }))
    ];

    categoryFilter.innerHTML = `
      <option value="all">All Categories</option>
      <optgroup label="Expenses">
        ${Store.CATEGORIES.expense.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
      </optgroup>
      <optgroup label="Income">
        ${Store.CATEGORIES.income.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
      </optgroup>
    `;
  };

  /**
   * Open Add/Edit Transaction Modal
   */
  const openTransactionModal = (tx = null) => {
    transactionForm.reset();
    const currency = Store.getCurrencySymbol();
    formCurrencyPrefix.textContent = currency;

    if (tx) {
      // Editing existing
      modalTitle.textContent = 'Edit Transaction';
      editTransactionId.value = tx.id;
      txTitle.value = tx.title;
      txAmount.value = tx.amount;
      txDate.value = tx.date;
      txNotes.value = tx.notes || '';

      if (tx.type === 'income') {
        typeIncomeLabel.click();
      } else {
        typeExpenseLabel.click();
      }
      populateModalCategories(tx.type);
      txCategory.value = tx.category;
    } else {
      // New transaction
      modalTitle.textContent = 'Add Transaction';
      editTransactionId.value = '';
      txDate.value = new Date().toISOString().split('T')[0];
      typeExpenseLabel.click();
      populateModalCategories('expense');
    }

    transactionModal.classList.add('show');
    txTitle.focus();
  };

  const closeTransactionModal = () => {
    transactionModal.classList.remove('show');
  };

  /**
   * Open/Close Budget Modal
   */
  const openBudgetModal = () => {
    budgetInput.value = Store.getBudget();
    budgetModal.classList.add('show');
    budgetInput.focus();
  };

  const closeBudgetModal = () => {
    budgetModal.classList.remove('show');
  };

  /**
   * Open/Close Help Guide Modal
   */
  const openHelpModal = () => {
    helpModal.classList.add('show');
  };

  const closeHelpModal = () => {
    helpModal.classList.remove('show');
  };

  /**
   * Toast notification
   */
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  };

  return {
    updateMetrics,
    renderTransactions,
    populateModalCategories,
    populateFilterCategories,
    openTransactionModal,
    closeTransactionModal,
    openBudgetModal,
    closeBudgetModal,
    openHelpModal,
    closeHelpModal,
    showToast
  };
})();
