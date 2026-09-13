/**
 * ClearSpend - Charts Module
 * Manages Chart.js visualizations for category breakdown and monthly income/expense trends.
 */

const Charts = (() => {
  let categoryChartInstance = null;
  let trendChartInstance = null;

  // Chart theme colors
  const getThemeColors = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      cardBg: isDark ? '#111827' : '#ffffff'
    };
  };

  /**
   * Render or update Category Distribution Donut Chart
   */
  const updateCategoryChart = (filteredTransactions) => {
    const canvas = document.getElementById('categoryChart');
    const emptyState = document.getElementById('categoryChartEmpty');
    if (!canvas) return;

    // Filter only expenses from the passed filtered transactions
    const expenses = filteredTransactions.filter(t => t.type === 'expense');

    if (expenses.length === 0) {
      if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
      }
      canvas.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Aggregate by category
    const categoryTotals = {};
    expenses.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const labels = [];
    const data = [];
    const backgroundColors = [];

    Object.keys(categoryTotals).forEach(catId => {
      const catInfo = Store.getCategoryInfo('expense', catId);
      labels.push(`${catInfo.icon} ${catInfo.name}`);
      data.push(categoryTotals[catId]);
      backgroundColors.push(catInfo.color);
    });

    const theme = getThemeColors();

    if (categoryChartInstance) {
      categoryChartInstance.data.labels = labels;
      categoryChartInstance.data.datasets[0].data = data;
      categoryChartInstance.data.datasets[0].backgroundColor = backgroundColors;
      categoryChartInstance.options.plugins.legend.labels.color = theme.textColor;
      categoryChartInstance.update();
    } else {
      const ctx = canvas.getContext('2d');
      categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderWidth: 2,
            borderColor: theme.cardBg,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: theme.textColor,
                font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' },
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((val / total) * 100) : 0;
                  return ` ${Store.formatMoney(val)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  };

  /**
   * Render or update 6-Month Income vs Expense Trend Bar Chart
   */
  const updateTrendChart = () => {
    const canvas = document.getElementById('trendChart');
    const emptyState = document.getElementById('trendChartEmpty');
    if (!canvas) return;

    const allTransactions = Store.getTransactions();
    if (allTransactions.length === 0) {
      if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
      }
      canvas.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Generate last 6 months keys (e.g., "2026-04", "2026-05", etc.)
    const months = [];
    const monthLabels = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
      monthLabels.push(d.toLocaleString('default', { month: 'short' }));
    }

    const incomeMap = {};
    const expenseMap = {};
    months.forEach(m => {
      incomeMap[m] = 0;
      expenseMap[m] = 0;
    });

    allTransactions.forEach(t => {
      if (!t.date) return;
      const mKey = t.date.substring(0, 7);
      if (months.includes(mKey)) {
        if (t.type === 'income') {
          incomeMap[mKey] += t.amount;
        } else {
          expenseMap[mKey] += t.amount;
        }
      }
    });

    const incomeData = months.map(m => incomeMap[m]);
    const expenseData = months.map(m => expenseMap[m]);

    const theme = getThemeColors();

    if (trendChartInstance) {
      trendChartInstance.data.labels = monthLabels;
      trendChartInstance.data.datasets[0].data = incomeData;
      trendChartInstance.data.datasets[1].data = expenseData;
      trendChartInstance.options.scales.x.ticks.color = theme.textColor;
      trendChartInstance.options.scales.x.grid.color = theme.gridColor;
      trendChartInstance.options.scales.y.ticks.color = theme.textColor;
      trendChartInstance.options.scales.y.grid.color = theme.gridColor;
      trendChartInstance.options.plugins.legend.labels.color = theme.textColor;
      trendChartInstance.update();
    } else {
      const ctx = canvas.getContext('2d');
      trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'Income',
              data: incomeData,
              backgroundColor: '#10b981',
              borderRadius: 6,
              barPercentage: 0.6,
              categoryPercentage: 0.7
            },
            {
              label: 'Spent',
              data: expenseData,
              backgroundColor: '#ef4444',
              borderRadius: 6,
              barPercentage: 0.6,
              categoryPercentage: 0.7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: theme.gridColor },
              ticks: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            y: {
              grid: { color: theme.gridColor },
              ticks: {
                color: theme.textColor,
                font: { family: 'Plus Jakarta Sans', size: 11 },
                callback: (val) => {
                  const sym = Store.getCurrencySymbol();
                  if (val >= 1000) return `${sym}${(val / 1000).toFixed(0)}k`;
                  return `${sym}${val}`;
                }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: theme.textColor,
                font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.dataset.label}: ${Store.formatMoney(context.raw)}`
              }
            }
          }
        }
      });
    }
  };

  /**
   * Refreshes chart colors on theme toggle
   */
  const refreshTheme = () => {
    if (categoryChartInstance) {
      const theme = getThemeColors();
      categoryChartInstance.options.plugins.legend.labels.color = theme.textColor;
      categoryChartInstance.data.datasets[0].borderColor = theme.cardBg;
      categoryChartInstance.update();
    }
    if (trendChartInstance) {
      const theme = getThemeColors();
      trendChartInstance.options.scales.x.ticks.color = theme.textColor;
      trendChartInstance.options.scales.x.grid.color = theme.gridColor;
      trendChartInstance.options.scales.y.ticks.color = theme.textColor;
      trendChartInstance.options.scales.y.grid.color = theme.gridColor;
      trendChartInstance.options.plugins.legend.labels.color = theme.textColor;
      trendChartInstance.update();
    }
  };

  return {
    updateCategoryChart,
    updateTrendChart,
    refreshTheme
  };
})();
