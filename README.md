# Clear Spend: Personal Spend and Expense Tracker

A modern, responsive, privacy-focused personal finance and expense tracking web application. Built with vanilla HTML5, CSS3, JavaScript (ES6+), and Chart.js.

Designed to run completely in the browser with `localStorage` persistence and **zero configuration deployment to GitHub Pages (100% free)**.

---

## ✨ Features

- **Dashboard Metrics**: Real-time Net Balance, Monthly Income, Monthly Spending, and Budget Remaining.
- **Budget Health Tracking**: Visual monthly budget progress bar with automatic alerts when approaching or exceeding limits.
- **Interactive Visualizations**:
  - **Category Spending Donut Chart**: See your expense distribution across categories.
  - **6-Month Income vs. Spent Trend Chart**: Track your cash flow over time.
- **Transaction Management**: Add, edit, and delete transactions with categories, dates, amounts, and notes.
- **Advanced Filtering & Search**:
  - Filter by date range: *This Month, Today, This Week, Last Month, This Year, All Time*.
  - Filter by transaction type (*Expenses*, *Income*).
  - Filter by category with icons & color-coded badges.
  - Live search by title or notes.
- **Multi-Currency Support**: Switch between INR (₹), USD ($), EUR (€), GBP (£), CAD ($), AUD ($), and JPY (¥).
- **Theme Switching**: Sleek Dark Mode (default) and Light Mode.
- **Data Portability & Privacy**:
  - 100% private: All data stays in your browser's `localStorage`.
  - **Export to CSV**: Spreadsheet-compatible data export.
  - **Backup & Restore**: Export and import full JSON backups.
  - **Demo Data**: One-click demo dataset generation for testing.

---

## 🚀 How to Run Locally

You don't need Node.js or any build tools to run ClearSpend:

1. Navigate to this folder:
   ```
   C:\Users\LeelaSaiKiranYenduri\.gemini\antigravity\scratch\spent-tracker
   ```
2. Double-click **`index.html`** to open it directly in any modern web browser (Chrome, Edge, Firefox, Brave, Safari).
3. *(Optional)* Or run a quick local HTTP server using Python or VS Code Live Server:
   ```bash
   python -m http.server 8000
   ```
   and visit `http://localhost:8000`.

---

## 🌐 How to Host on GitHub Pages (100% Free)

Follow these simple steps to put your Spent Tracker online for free on GitHub:

### Step 1: Create a GitHub Repository
1. Log in to [GitHub](https://github.com/).
2. Click the **+** icon in the top right &rarr; select **New repository**.
3. Name your repository `spent-tracker`.
4. Make sure it is set to **Public** (GitHub Pages is free for public repositories).
5. Leave "Add a README file" unchecked, and click **Create repository**.

---

### Step 2: Upload Your Files (2 Easy Options)

#### Option A: Drag-and-Drop on GitHub Web (No Git installation needed)
1. On your newly created repository page, click the link: **"uploading an existing file"**.
2. Select all files and folders from `C:\Users\LeelaSaiKiranYenduri\.gemini\antigravity\scratch\spent-tracker`:
   - `index.html`
   - `README.md`
   - `css` folder (with `styles.css`)
   - `js` folder (with `app.js`, `charts.js`, `store.js`, `ui.js`)
3. Drag and drop them into the GitHub page.
4. Click **Commit changes**.

#### Option B: Using Git CLI (if Git is installed)
```bash
cd "C:\Users\LeelaSaiKiranYenduri\.gemini\antigravity\scratch\spent-tracker"
git init
git add .
git commit -m "Initial commit: ClearSpend app"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/spent-tracker.git
git push -u origin main
```
*(Replace `<YOUR-USERNAME>` with your actual GitHub username).*

---

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub.
2. Click the **Settings** tab at the top.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment > Source**, choose **Deploy from a branch**.
5. Under **Branch**, select `main` and folder `/ (root)`, then click **Save**.

---

### Step 4: Visit Your Live Website!
In about 1 to 2 minutes, refresh the **Pages** settings page. You will see:
> **"Your site is live at https://<YOUR-USERNAME>.github.io/spent-tracker/"**

Share the link with anyone or bookmark it on your phone/laptop to track your daily expenses!

---

## 📂 Project Structure

```
spent-tracker/
├── assets/
│   └── clearspend_logo.jpg # Brand logo asset (inspired by modern SaaS aesthetic)
├── index.html         # Main application UI with embedded SVG logo & favicon
├── css/
│   └── styles.css     # CSS styling, dark/light theme, responsive grid
├── js/
│   ├── store.js       # LocalStorage data persistence, calculations & import/export
│   ├── charts.js      # Chart.js donut and bar chart visualizations
│   ├── ui.js          # DOM rendering, metric cards, modals & toasts
│   └── app.js         # Main controller, filters & event handlers
└── README.md          # Documentation & GitHub Pages guide
```
