/**
 * ClearSpend - Store Module
 * Handles state management, localStorage persistence, import/export, and data calculations.
 */

const Store = (() => {
  const STORAGE_KEYS = {
    TRANSACTIONS: 'clearspend_transactions',
    BUDGET: 'clearspend_monthly_budget',
    CURRENCY: 'clearspend_currency',
    THEME: 'clearspend_theme'
  };

  const CATEGORIES = {
    expense: [
      { id: 'food', name: 'Food & Dining', icon: '🍔', color: '#f97316' },
      { id: 'shopping', name: 'Shopping & Retail', icon: '🛍️', color: '#ec4899' },
      { id: 'housing', name: 'Housing & Rent', icon: '🏠', color: '#6366f1' },
      { id: 'transport', name: 'Transportation', icon: '🚗', color: '#06b6d4' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
      { id: 'utilities', name: 'Utilities & Bills', icon: '⚡', color: '#eab308' },
      { id: 'healthcare', name: 'Healthcare & Medical', icon: '💊', color: '#10b981' },
      { id: 'travel', name: 'Travel & Trips', icon: '✈️', color: '#14b8a6' },
      { id: 'education', name: 'Education', icon: '📚', color: '#3b82f6' },
      { id: 'other_expense', name: 'Other Expense', icon: '📦', color: '#64748b' }
    ],
    income: [
      { id: 'salary', name: 'Salary & Wages', icon: '💼', color: '#10b981' },
      { id: 'freelance', name: 'Freelance & Side Hustle', icon: '💻', color: '#0ea5e9' },
      { id: 'investments', name: 'Investments & Returns', icon: '📈', color: '#8b5cf6' },
      { id: 'gifts', name: 'Gifts & Awards', icon: '🎁', color: '#f43f5e' },
      { id: 'other_income', name: 'Other Income', icon: '💰', color: '#f59e0b' }
    ]
  };

  const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    CAD: '$',
    AUD: '$',
    JPY: '¥'
  };

  // Helper to generate IDs
  const generateId = () => 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  // Generate date offset helper for realistic demo data
  const getDateOffset = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Default sample transactions
  const SAMPLE_TRANSACTIONS = [
    { id: generateId(), type: 'income', title: 'Monthly Salary', amount: 85000, category: 'salary', date: getDateOffset(12), notes: 'Direct deposit bank transfer' },
    { id: generateId(), type: 'expense', title: 'Apartment Rent', amount: 25000, category: 'housing', date: getDateOffset(10), notes: 'Monthly rent paid via UPI' },
    { id: generateId(), type: 'expense', title: 'Supermarket Groceries', amount: 4800, category: 'food', date: getDateOffset(8), notes: 'Weekly grocery run' },
    { id: generateId(), type: 'expense', title: 'Electricity & Internet Bill', amount: 3200, category: 'utilities', date: getDateOffset(7), notes: 'Fiber broadband & power' },
    { id: generateId(), type: 'expense', title: 'Weekend Dining & Drinks', amount: 2450, category: 'food', date: getDateOffset(5), notes: 'Dinner with friends' },
    { id: generateId(), type: 'income', title: 'Website Design Project', amount: 15000, category: 'freelance', date: getDateOffset(4), notes: 'Client milestone 2' },
    { id: generateId(), type: 'expense', title: 'Fuel & Cab Fare', amount: 1800, category: 'transport', date: getDateOffset(3), notes: 'Commute and petrol' },
    { id: generateId(), type: 'expense', title: 'Streaming Subscriptions', amount: 899, category: 'entertainment', date: getDateOffset(2), notes: 'Netflix & Spotify' },
    { id: generateId(), type: 'expense', title: 'New Sneakers', amount: 3999, category: 'shopping', date: getDateOffset(1), notes: 'Weekend mall sale' },
    { id: generateId(), type: 'expense', title: 'Pharmacy & Vitamins', amount: 950, category: 'healthcare', date: getDateOffset(0), notes: 'Health check supplements' }
  ];

  // Helper to resolve the current active user or guest
  const getCurrentUser = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('guest') === '1') {
        return { username: 'Guest', isGuest: true };
      }
      const rawUser = localStorage.getItem('clearspend_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && u.username) {
          return { username: u.username, isGuest: false, userId: u.userId, email: u.email };
        }
      }
    } catch {}
    return { username: 'Guest', isGuest: true };
  };

  // Helper to scope storage keys per user/guest
  const getUserStorageKey = (prefix) => {
    const user = getCurrentUser();
    const key = user.isGuest ? 'guest' : user.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `${prefix}_${key}`;
  };

  // Initialization: ensure user-scoped data structure exists (never auto-seed demo data)
  const init = () => {
    const user = getCurrentUser();
    const txKey = getUserStorageKey(STORAGE_KEYS.TRANSACTIONS);
    const budgetKey = getUserStorageKey(STORAGE_KEYS.BUDGET);

    // If transactions key doesn't exist for this user/guest, initialize to empty array []
    if (localStorage.getItem(txKey) === null) {
      if (!user.isGuest && localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
        // Migrate matching transactions for logged-in user if legacy storage exists
        try {
          const legacy = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS));
          if (Array.isArray(legacy)) {
            const userTx = legacy.filter(t => (t.username || '').toLowerCase() === user.username.toLowerCase());
            localStorage.setItem(txKey, JSON.stringify(userTx));
          } else {
            localStorage.setItem(txKey, JSON.stringify([]));
          }
        } catch {
          localStorage.setItem(txKey, JSON.stringify([]));
        }
      } else {
        // By default for new user or guest: empty array (ZERO)
        localStorage.setItem(txKey, JSON.stringify([]));
      }
    }

    // Initialize user-scoped budget if not present
    if (localStorage.getItem(budgetKey) === null) {
      const legacyBudget = !user.isGuest ? localStorage.getItem(STORAGE_KEYS.BUDGET) : null;
      localStorage.setItem(budgetKey, legacyBudget || '50000');
    }

    if (!localStorage.getItem(STORAGE_KEYS.CURRENCY)) {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, 'INR');
    }
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
      localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
    }
  };

  // Transactions CRUD
  const getTransactions = () => {
    try {
      const txKey = getUserStorageKey(STORAGE_KEYS.TRANSACTIONS);
      const data = localStorage.getItem(txKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse transactions:', e);
      return [];
    }
  };

  const saveTransactions = (transactions) => {
    const txKey = getUserStorageKey(STORAGE_KEYS.TRANSACTIONS);
    localStorage.setItem(txKey, JSON.stringify(transactions));
  };

  const addTransaction = (tx) => {
    const user = getCurrentUser();
    const defaultUsername = user.isGuest ? 'Guest' : (user.username || 'User');

    const transactions = getTransactions();
    const newTx = {
      id: generateId(),
      type: tx.type,
      title: tx.title.trim(),
      amount: parseFloat(tx.amount) || 0,
      category: tx.category,
      date: tx.date || new Date().toISOString().split('T')[0],
      notes: (tx.notes || '').trim(),
      username: tx.username || defaultUsername
    };
    transactions.unshift(newTx);
    saveTransactions(transactions);
    if (!user.isGuest) {
      syncTxToDatabase(newTx);
    }
    return newTx;
  };

  const updateTransaction = (id, updatedFields) => {
    const user = getCurrentUser();
    const defaultUsername = user.isGuest ? 'Guest' : (user.username || 'User');
    const transactions = getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = {
        ...transactions[index],
        type: updatedFields.type,
        title: updatedFields.title.trim(),
        amount: parseFloat(updatedFields.amount) || 0,
        category: updatedFields.category,
        date: updatedFields.date,
        notes: (updatedFields.notes || '').trim(),
        username: updatedFields.username || transactions[index].username || defaultUsername
      };
      saveTransactions(transactions);
      if (!user.isGuest) {
        syncTxToDatabase(transactions[index]);
      }
      return transactions[index];
    }
    return null;
  };

  const deleteTransaction = (id) => {
    const user = getCurrentUser();
    const transactions = getTransactions().filter(t => t.id !== id);
    saveTransactions(transactions);
    if (!user.isGuest) {
      deleteTxFromDatabase(id);
    }
  };

  const syncTxToDatabase = async (transaction) => {
    try {
      const user = getCurrentUser();
      if (user.isGuest) return false;
      const rawUser = localStorage.getItem('clearspend_user');
      if (!rawUser) return false;
      const parsed = JSON.parse(rawUser);
      if (!parsed) return false;

      const res = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parsed.userId,
          username: parsed.username,
          transaction: transaction
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const deleteTxFromDatabase = async (id) => {
    try {
      const user = getCurrentUser();
      if (user.isGuest) return;
      const rawUser = localStorage.getItem('clearspend_user');
      if (!rawUser) return;
      const parsed = JSON.parse(rawUser);
      if (!parsed) return;

      await fetch(`http://localhost:5000/api/transactions?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(parsed.userId || '')}&username=${encodeURIComponent(parsed.username || '')}`, {
        method: 'DELETE'
      });
    } catch {}
  };

  const syncAllToDatabase = async () => {
    try {
      const user = getCurrentUser();
      if (user.isGuest) return { success: false, reason: 'guest_mode' };
      const rawUser = localStorage.getItem('clearspend_user');
      if (!rawUser) return { success: false, reason: 'no_user' };
      const parsedUser = JSON.parse(rawUser);
      const transactions = getTransactions();
      if (!transactions || transactions.length === 0) return { success: true, count: 0 };

      const res = await fetch('http://localhost:5000/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parsedUser.userId,
          username: parsedUser.username,
          transactions: transactions
        })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, count: data.syncedCount || transactions.length };
      }
      return { success: false, reason: 'server_error' };
    } catch (e) {
      return { success: false, reason: 'network_error' };
    }
  };

  const syncFromDatabase = async (userFilter = 'all') => {
    try {
      const user = getCurrentUser();
      if (user.isGuest) return { success: false, reason: 'guest_mode' };

      const targetFilter = userFilter && userFilter !== 'all' ? userFilter : user.username;
      const url = targetFilter && targetFilter !== 'all'
        ? `http://localhost:5000/api/transactions?user=${encodeURIComponent(targetFilter)}`
        : 'http://localhost:5000/api/transactions';

      const res = await fetch(url);
      if (!res.ok) return { success: false };

      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        const dbTransactions = data.transactions.map(t => ({
          id: t.TransactionId,
          userId: t.UserId,
          username: t.Username || user.username || 'User',
          type: t.Type,
          title: t.Title,
          amount: parseFloat(t.Amount) || 0,
          category: t.Category,
          date: t.Date,
          notes: t.Notes || ''
        }));

        const currentLocal = getTransactions();
        const dbIdMap = new Set(dbTransactions.map(t => t.id));
        const localOnly = currentLocal.filter(t => !dbIdMap.has(t.id));

        const merged = [...dbTransactions, ...localOnly];
        saveTransactions(merged);
        return { success: true, count: merged.length, transactions: merged };
      }
      return { success: false };
    } catch (e) {
      return { success: false, error: e };
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users');
      if (!res.ok) return [];
      const data = await res.json();
      return data.success && Array.isArray(data.users) ? data.users : [];
    } catch {
      return [];
    }
  };

  // Budget
  const getBudget = () => {
    const budgetKey = getUserStorageKey(STORAGE_KEYS.BUDGET);
    const stored = localStorage.getItem(budgetKey);
    return stored !== null ? parseFloat(stored) || 50000 : 50000;
  };

  const setBudget = (amount) => {
    const budgetKey = getUserStorageKey(STORAGE_KEYS.BUDGET);
    const num = Math.max(0, parseFloat(amount) || 0);
    localStorage.setItem(budgetKey, num.toString());
    return num;
  };

  // Currency
  const getCurrency = () => {
    return localStorage.getItem(STORAGE_KEYS.CURRENCY) || 'INR';
  };

  const getCurrencySymbol = () => {
    const code = getCurrency();
    return CURRENCY_SYMBOLS[code] || '$';
  };

  const setCurrency = (code) => {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, code);
  };

  // Theme
  const getTheme = () => {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  };

  const setTheme = (theme) => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  };

  // Format money helper
  const formatMoney = (amount) => {
    const symbol = getCurrencySymbol();
    const num = Number(amount) || 0;
    return symbol + num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Find Category info
  const getCategoryInfo = (type, categoryId) => {
    const list = CATEGORIES[type] || [];
    const found = list.find(c => c.id === categoryId);
    if (found) return found;

    // Fallback: search both lists
    const inExpense = CATEGORIES.expense.find(c => c.id === categoryId);
    if (inExpense) return inExpense;

    const inIncome = CATEGORIES.income.find(c => c.id === categoryId);
    if (inIncome) return inIncome;

    return { id: categoryId, name: categoryId, icon: '🏷️', color: '#94a3b8' };
  };

  // Reset to Demo Data
  const loadSampleData = () => {
    const user = getCurrentUser();
    const defaultUsername = user.isGuest ? 'Guest' : (user.username || 'User');
    // Regenerate dates to be current relative
    const freshSample = SAMPLE_TRANSACTIONS.map((tx, idx) => ({
      ...tx,
      id: generateId(),
      date: getDateOffset(idx),
      username: defaultUsername
    }));
    saveTransactions(freshSample);
    return freshSample;
  };

  // Clear All Data
  const clearAll = () => {
    saveTransactions([]);
  };

  // Export as CSV
  const exportToCSV = () => {
    const transactions = getTransactions();
    if (transactions.length === 0) return false;

    const headers = ['ID', 'Type', 'Title', 'Amount', 'Category', 'Date', 'Notes'];
    const rows = transactions.map(t => [
      `"${t.id}"`,
      `"${t.type}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${t.category}"`,
      `"${t.date}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clearspend_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  // Export as JSON backup
  const exportToJSON = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      currency: getCurrency(),
      monthlyBudget: getBudget(),
      transactions: getTransactions()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clearspend_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  // Import from JSON backup
  const importFromJSON = (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data)) {
        // Simple array of transactions
        saveTransactions(data);
      } else if (data && Array.isArray(data.transactions)) {
        // Full backup schema
        saveTransactions(data.transactions);
        if (data.monthlyBudget) setBudget(data.monthlyBudget);
        if (data.currency) setCurrency(data.currency);
      } else {
        throw new Error('Unrecognized file structure');
      }
      return { success: true, count: getTransactions().length };
    } catch (err) {
      console.error('Import error:', err);
      return { success: false, error: err.message };
    }
  };

  // Run initial setup
  init();

  return {
    CATEGORIES,
    CURRENCY_SYMBOLS,
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getBudget,
    setBudget,
    getCurrency,
    getCurrencySymbol,
    setCurrency,
    getTheme,
    setTheme,
    formatMoney,
    getCategoryInfo,
    loadSampleData,
    clearAll,
    exportToCSV,
    exportToJSON,
    importFromJSON,
    syncAllToDatabase,
    getCurrentUser,
    getUserStorageKey,
    syncFromDatabase,
    fetchAllUsers
  };
})();
