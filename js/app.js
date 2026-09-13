/**
 * ClearSpend - Main Application Controller
 * Orchestrates Store, UI, Charts, and User Event Handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const currencySelect = document.getElementById('currencySelect');
  const dataMenuBtn = document.getElementById('dataMenuBtn');
  const dataDropdownMenu = document.getElementById('dataDropdownMenu');
  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const transactionModal = document.getElementById('transactionModal');
  const transactionForm = document.getElementById('transactionForm');
  const typeExpenseLabel = document.getElementById('typeExpenseLabel');
  const typeIncomeLabel = document.getElementById('typeIncomeLabel');
  const editBudgetBtn = document.getElementById('editBudgetBtn');
  const budgetModal = document.getElementById('budgetModal');
  const closeBudgetModalBtn = document.getElementById('closeBudgetModalBtn');
  const cancelBudgetBtn = document.getElementById('cancelBudgetBtn');
  const budgetForm = document.getElementById('budgetForm');
  const budgetInput = document.getElementById('budgetInput');
  const helpModal = document.getElementById('helpModal');
  const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
  const gotItHelpBtn = document.getElementById('gotItHelpBtn');
  const footerHelpBtn = document.getElementById('footerHelpBtn');
  const searchInput = document.getElementById('searchInput');
  const userFilter = document.getElementById('userFilter');
  const typeFilter = document.getElementById('typeFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  const dateRangeFilter = document.getElementById('dateRangeFilter');
  const categoryChartPeriod = document.getElementById('categoryChartPeriod');
  const emptyAddBtn = document.getElementById('emptyAddBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const importJsonBtn = document.getElementById('importJsonBtn');
  const jsonFileInput = document.getElementById('jsonFileInput');
  const loadDemoDataBtn = document.getElementById('loadDemoDataBtn');
  const footerDemoDataBtn = document.getElementById('footerDemoDataBtn');
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');

  // Filter state
  const filters = {
    search: '',
    user: 'all',
    type: 'all',
    category: 'all',
    dateRange: 'this-month'
  };

  /**
   * Helper: Check if a date string falls inside a chosen range
   */
  const isDateInRange = (dateStr, rangeKey) => {
    if (!dateStr || rangeKey === 'all-time') return true;

    const txDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (rangeKey === 'today') {
      return txDate.getTime() === today.getTime();
    }

    if (rangeKey === 'this-week') {
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      return txDate >= startOfWeek && txDate <= today;
    }

    if (rangeKey === 'this-month') {
      return txDate.getFullYear() === today.getFullYear() && txDate.getMonth() === today.getMonth();
    }

    if (rangeKey === 'last-month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return txDate.getFullYear() === lastMonth.getFullYear() && txDate.getMonth() === lastMonth.getMonth();
    }

    if (rangeKey === 'this-year') {
      return txDate.getFullYear() === today.getFullYear();
    }

    return true;
  };

  /**
   * Apply filters to transactions list
   */
  const getFilteredTransactions = () => {
    const all = Store.getTransactions();
    return all.filter(t => {
      // User filter
      if (filters.user !== 'all' && (t.username || '').toLowerCase() !== filters.user.toLowerCase()) return false;

      // Type filter
      if (filters.type !== 'all' && t.type !== filters.type) return false;

      // Category filter
      if (filters.category !== 'all' && t.category !== filters.category) return false;

      // Date Range filter
      if (!isDateInRange(t.date, filters.dateRange)) return false;

      // Search Query filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const titleMatch = (t.title || '').toLowerCase().includes(query);
        const notesMatch = (t.notes || '').toLowerCase().includes(query);
        const userMatch = (t.username || '').toLowerCase().includes(query);
        if (!titleMatch && !notesMatch && !userMatch) return false;
      }

      return true;
    });
  };

  /**
   * Master Refresh View
   */
  const refreshApp = () => {
    const filtered = getFilteredTransactions();

    // 1. Update Metrics
    UI.updateMetrics();

    // 2. Render Transactions
    UI.renderTransactions(filtered, handleEditTransaction, handleDeleteTransaction);

    // 3. Update Category Donut Chart
    Charts.updateCategoryChart(filtered);

    // 4. Update Trend Bar Chart
    Charts.updateTrendChart();

    // Update Period label on Category chart
    const periodText = {
      'this-month': 'This Month',
      'today': 'Today',
      'this-week': 'This Week',
      'last-month': 'Last Month',
      'this-year': 'This Year',
      'all-time': 'All Time'
    }[filters.dateRange] || 'Filtered';
    categoryChartPeriod.textContent = periodText;
  };

  /**
   * Transaction Actions (Edit / Delete)
   */
  const handleEditTransaction = (id) => {
    const tx = Store.getTransactions().find(t => t.id === id);
    if (tx) {
      UI.openTransactionModal(tx);
    }
  };

  const handleDeleteTransaction = (id) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      Store.deleteTransaction(id);
      UI.showToast('Transaction deleted', 'info');
      refreshApp();
    }
  };

  /**
   * Theme Initialization & Toggle
   */
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    Store.setTheme(theme);
    Charts.refreshTheme();
  };

  const initTheme = () => {
    const savedTheme = Store.getTheme();
    applyTheme(savedTheme);
  };

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  /**
   * Currency Change
   */
  currencySelect.value = Store.getCurrency();
  currencySelect.addEventListener('change', (e) => {
    Store.setCurrency(e.target.value);
    UI.showToast(`Currency changed to ${e.target.value}`, 'success');
    refreshApp();
  });

  /**
   * Type Toggle Radio inside Transaction Modal
   */
  const typeRadios = document.querySelectorAll('input[name="txType"]');
  typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'expense') {
        typeExpenseLabel.classList.add('active');
        typeIncomeLabel.classList.remove('active');
      } else {
        typeIncomeLabel.classList.add('active');
        typeExpenseLabel.classList.remove('active');
      }
      UI.populateModalCategories(type);
    });
  });

  /**
   * Open / Close Modals
   */
  openAddModalBtn.addEventListener('click', () => UI.openTransactionModal());
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => UI.openTransactionModal());
  closeModalBtn.addEventListener('click', () => UI.closeTransactionModal());
  cancelModalBtn.addEventListener('click', () => UI.closeTransactionModal());

  editBudgetBtn.addEventListener('click', () => UI.openBudgetModal());
  closeBudgetModalBtn.addEventListener('click', () => UI.closeBudgetModal());
  cancelBudgetBtn.addEventListener('click', () => UI.closeBudgetModal());

  footerHelpBtn.addEventListener('click', () => UI.openHelpModal());
  closeHelpModalBtn.addEventListener('click', () => UI.closeHelpModal());
  gotItHelpBtn.addEventListener('click', () => UI.closeHelpModal());

  // Close modals on clicking backdrop
  [transactionModal, budgetModal, helpModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });

  // Close modals on ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      transactionModal.classList.remove('show');
      budgetModal.classList.remove('show');
      helpModal.classList.remove('show');
      dataDropdownMenu.parentElement.classList.remove('show');
    }
  });

  /**
   * Transaction Form Submission
   */
  transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('editTransactionId').value;
    const type = document.querySelector('input[name="txType"]:checked').value;
    const title = document.getElementById('txTitle').value;
    const amount = document.getElementById('txAmount').value;
    const date = document.getElementById('txDate').value;
    const category = document.getElementById('txCategory').value;
    const notes = document.getElementById('txNotes').value;

    const txUserElem = document.getElementById('txUser');
    const username = txUserElem ? txUserElem.value : undefined;

    if (id) {
      Store.updateTransaction(id, { type, title, amount, date, category, notes, username });
      UI.showToast('Transaction updated successfully', 'success');
    } else {
      Store.addTransaction({ type, title, amount, date, category, notes, username });
      UI.showToast('Transaction added successfully', 'success');
    }

    UI.closeTransactionModal();
    refreshApp();
  });

  /**
   * Budget Form Submission
   */
  budgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const limit = budgetInput.value;
    Store.setBudget(limit);
    UI.closeBudgetModal();
    UI.showToast('Monthly budget updated', 'success');
    UI.updateMetrics();
  });

  /**
   * Filter & Search Handlers
   */
  let searchDebounceTimeout = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      filters.search = e.target.value.trim();
      refreshApp();
    }, 150);
  });

  if (userFilter) {
    userFilter.addEventListener('change', (e) => {
      filters.user = e.target.value;
      refreshApp();
    });
  }

  typeFilter.addEventListener('change', (e) => {
    filters.type = e.target.value;
    refreshApp();
  });

  categoryFilter.addEventListener('change', (e) => {
    filters.category = e.target.value;
    refreshApp();
  });

  dateRangeFilter.addEventListener('change', (e) => {
    filters.dateRange = e.target.value;
    refreshApp();
  });

  /**
   * Data Management Dropdown
   */
  dataMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dataMenuBtn.parentElement.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    if (dataDropdownMenu.parentElement.classList.contains('show')) {
      dataDropdownMenu.parentElement.classList.remove('show');
    }
  });

  // Sync with SSMS Database
  const syncDbBtn = document.getElementById('syncDbBtn');
  if (syncDbBtn) {
    syncDbBtn.addEventListener('click', async () => {
      UI.showToast('Syncing with SSMS Database...', 'info');
      const res = await Store.syncFromDatabase();
      if (res.success) {
        refreshApp();
        UI.showToast(`Synced ${res.count} transactions with database!`, 'success');
      } else {
        UI.showToast('Could not reach backend. Please run start-server.bat', 'warning');
      }
    });
  }

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    const ok = Store.exportToCSV();
    if (ok) UI.showToast('CSV export downloaded', 'success');
    else UI.showToast('No transactions to export', 'info');
  });

  // Export JSON
  exportJsonBtn.addEventListener('click', () => {
    Store.exportToJSON();
    UI.showToast('JSON backup downloaded', 'success');
  });

  // Import JSON
  importJsonBtn.addEventListener('click', () => {
    jsonFileInput.click();
  });

  jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = Store.importFromJSON(event.target.result);
      if (res.success) {
        UI.showToast(`Restored ${res.count} transactions!`, 'success');
        refreshApp();
      } else {
        UI.showToast(`Import failed: ${res.error}`, 'error');
      }
      jsonFileInput.value = '';
    };
    reader.readAsText(file);
  });

  // Load Demo Data
  const loadDemoHandler = () => {
    Store.loadSampleData();
    UI.showToast('Demo data loaded', 'success');
    refreshApp();
  };

  loadDemoDataBtn.addEventListener('click', loadDemoHandler);
  if (footerDemoDataBtn) footerDemoDataBtn.addEventListener('click', loadDemoHandler);

  // Clear All Data
  clearAllDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to erase all data? This cannot be undone.')) {
      Store.clearAll();
      UI.showToast('All transaction data cleared', 'info');
      refreshApp();
    }
  });

  /**
   * User Authentication & Session Management
   */
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userAuthDropdown = document.getElementById('userAuthDropdown');
  const userProfileName = document.getElementById('userProfileName');
  const loggedInUserSection = document.getElementById('loggedInUserSection');
  const loggedOutUserSection = document.getElementById('loggedOutUserSection');
  const menuUserName = document.getElementById('menuUserName');
  const menuUserEmail = document.getElementById('menuUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  const checkUserSession = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isGuest = urlParams.get('guest') === '1';

    if (isGuest) {
      userProfileName.textContent = 'Guest';
      loggedInUserSection.style.display = 'none';
      loggedOutUserSection.style.display = 'block';
      if (userFilter && userFilter.parentElement) {
        userFilter.parentElement.style.display = 'none';
      }
      return;
    }

    const rawUser = localStorage.getItem('clearspend_user');
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        if (user && user.username) {
          userProfileName.textContent = user.username;
          menuUserName.textContent = user.username;
          menuUserEmail.textContent = user.email || '';
          loggedInUserSection.style.display = 'block';
          loggedOutUserSection.style.display = 'none';
          if (userFilter && userFilter.parentElement) {
            userFilter.parentElement.style.display = 'block';
          }
          return;
        }
      } catch {
        localStorage.removeItem('clearspend_user');
      }
    }

    // Redirect to login page if not logged in and not explicitly guest
    window.location.href = 'login.html';
  };

  if (userProfileBtn) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userAuthDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      if (userAuthDropdown && userAuthDropdown.classList.contains('show')) {
        userAuthDropdown.classList.remove('show');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('clearspend_user');
      window.location.href = 'login.html';
    });
  }

  /**
   * App Initial Boot
   */
  checkUserSession();
  initTheme();
  UI.populateFilterCategories();
  UI.populateModalCategories('expense');

  const currentUser = Store.getCurrentUser();
  if (!currentUser.isGuest) {
    UI.populateUserFilter([currentUser.username]);

    // Load all users from backend and populate user filter
    Store.fetchAllUsers().then((users) => {
      if (users && users.length > 0) {
        UI.populateUserFilter(users);
      }
    }).catch(() => {});

    // Sync database for current logged-in user
    Store.syncFromDatabase(currentUser.username).then((res) => {
      if (res && res.success) {
        UI.populateUserFilter();
        refreshApp();
      }
    }).catch(() => {});
  } else {
    // Guest mode: hide user filter dropdown
    if (userFilter && userFilter.parentElement) {
      userFilter.parentElement.style.display = 'none';
    }
  }

  refreshApp();
});
