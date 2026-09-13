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

  // Initialization: check and seed default data if first visit
  const init = () => {
    // Migration from old keys if existing
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) && localStorage.getItem('spentwise_transactions')) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, localStorage.getItem('spentwise_transactions'));
      localStorage.setItem(STORAGE_KEYS.BUDGET, localStorage.getItem('spentwise_monthly_budget') || '50000');
      localStorage.setItem(STORAGE_KEYS.CURRENCY, localStorage.getItem('spentwise_currency') || 'INR');
      localStorage.setItem(STORAGE_KEYS.THEME, localStorage.getItem('spentwise_theme') || 'dark');
    }

    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SAMPLE_TRANSACTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.BUDGET)) {
      localStorage.setItem(STORAGE_KEYS.BUDGET, '50000');
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
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse transactions:', e);
      return [];
    }
  };

  const saveTransactions = (transactions) => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  };

  const addTransaction = (tx) => {
    const transactions = getTransactions();
    const newTx = {
      id: generateId(),
      type: tx.type,
      title: tx.title.trim(),
      amount: parseFloat(tx.amount) || 0,
      category: tx.category,
      date: tx.date || new Date().toISOString().split('T')[0],
      notes: (tx.notes || '').trim()
    };
    transactions.unshift(newTx);
    saveTransactions(transactions);
    return newTx;
  };

  const updateTransaction = (id, updatedFields) => {
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
        notes: (updatedFields.notes || '').trim()
      };
      saveTransactions(transactions);
      return transactions[index];
    }
    return null;
  };

  const deleteTransaction = (id) => {
    const transactions = getTransactions().filter(t => t.id !== id);
    saveTransactions(transactions);
  };

  // Budget
  const getBudget = () => {
    return parseFloat(localStorage.getItem(STORAGE_KEYS.BUDGET)) || 50000;
  };

  const setBudget = (amount) => {
    const num = Math.max(0, parseFloat(amount) || 0);
    localStorage.setItem(STORAGE_KEYS.BUDGET, num.toString());
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
    // Regenerate dates to be current relative
    const freshSample = SAMPLE_TRANSACTIONS.map((tx, idx) => ({
      ...tx,
      id: generateId(),
      date: getDateOffset(idx)
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
    importFromJSON
  };
})();
