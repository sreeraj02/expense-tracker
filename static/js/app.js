// Expense Tracker Frontend Logic
let currentUser = null;
let currentCategories = [];
let currentPage = 1;
const pageLimit = 10;
let categoryChartInstance = null;
let monthlyChartInstance = null;

// Helpers
function formatINR(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

// Auth Lifecycle
async function checkAuth() {
    try {
        const data = await apiRequest('/api/auth/me');
        currentUser = data.user;
        renderAuthenticatedState();
    } catch {
        currentUser = null;
        renderUnauthenticatedState();
    }
}

function renderAuthenticatedState() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('nav-user-section').style.display = 'flex';
    document.getElementById('current-username').textContent = currentUser.username;
    
    // Initial fetch of data
    loadCategories().then(() => {
        loadExpenses();
        loadDashboardSummary();
    });
}

function renderUnauthenticatedState() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('nav-user-section').style.display = 'none';
}

// Categories Management
async function loadCategories() {
    try {
        const data = await apiRequest('/api/categories');
        currentCategories = data.categories || [];
        populateCategoryDropdowns();
        renderCategoriesListModal();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function populateCategoryDropdowns() {
    const filterSelect = document.getElementById('filter-category');
    const expenseFormSelect = document.getElementById('expense-category');

    const filterVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Categories</option>';
    expenseFormSelect.innerHTML = '';

    currentCategories.forEach(cat => {
        const optFilter = document.createElement('option');
        optFilter.value = cat.id;
        optFilter.textContent = cat.name;
        filterSelect.appendChild(optFilter);

        const optForm = document.createElement('option');
        optForm.value = cat.id;
        optForm.textContent = cat.name;
        expenseFormSelect.appendChild(optForm);
    });

    filterSelect.value = filterVal;
}

function renderCategoriesListModal() {
    const list = document.getElementById('categories-list');
    list.innerHTML = '';

    if (currentCategories.length === 0) {
        list.innerHTML = '<li style="color:var(--text-muted); padding:1rem; text-align:center;">No categories found.</li>';
        return;
    }

    currentCategories.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${cat.name}</strong></span>
            <button class="btn-danger-sm delete-cat-btn" data-id="${cat.id}">Delete</button>
        `;
        list.appendChild(li);
    });

    list.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const catId = e.target.dataset.id;
            if (!confirm('Are you sure you want to delete this category? Associated expenses will become Uncategorized.')) return;
            try {
                await apiRequest(`/api/categories/${catId}`, { method: 'DELETE' });
                showToast('Category deleted', 'success');
                await loadCategories();
                loadExpenses();
                loadDashboardSummary();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

// Expenses
async function loadExpenses(page = currentPage) {
    currentPage = page;
    const search = document.getElementById('filter-search').value.trim();
    const catId = document.getElementById('filter-category').value;
    const method = document.getElementById('filter-payment').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    const params = new URLSearchParams({
        page: currentPage,
        limit: pageLimit
    });

    if (search) params.append('search', search);
    if (catId) params.append('category_id', catId);
    if (method) params.append('payment_method', method);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const tbody = document.getElementById('expenses-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading expenses...</td></tr>';

    try {
        const data = await apiRequest(`/api/expenses?${params.toString()}`);
        const expenses = data.expenses || [];
        const totalCount = data.total_count || 0;
        const totalPages = data.total_pages || 1;

        if (expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4" style="color: var(--text-muted);">No expenses found matching the criteria.</td></tr>';
        } else {
            tbody.innerHTML = '';
            expenses.forEach(exp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="white-space:nowrap;">${exp.expense_date}</td>
                    <td>
                        <div class="expense-title-cell">${escapeHtml(exp.title)}</div>
                        ${exp.note ? `<div class="expense-note-text">${escapeHtml(exp.note)}</div>` : ''}
                    </td>
                    <td><span class="badge badge-cat">${escapeHtml(exp.category_name)}</span></td>
                    <td><span class="badge badge-method">${escapeHtml(exp.payment_method)}</span></td>
                    <td class="text-right amount-val">${formatINR(exp.amount)}</td>
                    <td class="text-center" style="white-space:nowrap;">
                        <button class="btn-edit-sm edit-expense-btn" data-id="${exp.id}">Edit</button>
                        <button class="btn-danger-sm delete-expense-btn" data-id="${exp.id}">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Attach action events
        tbody.querySelectorAll('.edit-expense-btn').forEach(b => {
            b.addEventListener('click', () => openEditExpenseModal(b.dataset.id));
        });
        tbody.querySelectorAll('.delete-expense-btn').forEach(b => {
            b.addEventListener('click', () => handleDeleteExpense(b.dataset.id));
        });

        // Pagination UI
        const fromIdx = totalCount === 0 ? 0 : (currentPage - 1) * pageLimit + 1;
        const toIdx = Math.min(currentPage * pageLimit, totalCount);
        document.getElementById('pagination-info').textContent = `Showing ${fromIdx}-${toIdx} of ${totalCount} expenses`;
        document.getElementById('current-page-display').textContent = `Page ${currentPage} of ${totalPages}`;

        document.getElementById('prev-page-btn').disabled = currentPage <= 1;
        document.getElementById('next-page-btn').disabled = currentPage >= totalPages;

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color: var(--danger);">${err.message}</td></tr>`;
        showToast(err.message, 'error');
    }
}

async function handleDeleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
        await apiRequest(`/api/expenses/${id}`, { method: 'DELETE' });
        showToast('Expense deleted successfully', 'success');
        loadExpenses();
        loadDashboardSummary();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openEditExpenseModal(id) {
    try {
        const data = await apiRequest(`/api/expenses/${id}`);
        const exp = data.expense;

        document.getElementById('modal-expense-title').textContent = 'Edit Expense';
        document.getElementById('expense-id').value = exp.id;
        document.getElementById('expense-title').value = exp.title;
        document.getElementById('expense-amount').value = exp.amount;
        document.getElementById('expense-date').value = exp.expense_date;
        document.getElementById('expense-category').value = exp.category_id || '';
        document.getElementById('expense-method').value = exp.payment_method;
        document.getElementById('expense-note').value = exp.note || '';

        document.getElementById('expense-modal').style.display = 'flex';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openAddExpenseModal() {
    document.getElementById('modal-expense-title').textContent = 'Add New Expense';
    document.getElementById('expense-id').value = '';
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').value = getTodayDateString();
    if (currentCategories.length > 0) {
        document.getElementById('expense-category').value = currentCategories[0].id;
    }
    document.getElementById('expense-modal').style.display = 'flex';
}

// Dashboard Summary & Charts
async function loadDashboardSummary() {
    try {
        const data = await apiRequest('/api/expenses/summary');
        
        // Metrics
        document.getElementById('metric-this-month').textContent = formatINR(data.total_this_month);
        document.getElementById('metric-all-time').textContent = formatINR(data.total_all_time);
        document.getElementById('metric-count').textContent = data.total_count;

        // Category Chart
        renderCategoryChart(data.category_breakdown || []);

        // Monthly Summary Chart
        renderMonthlyChart(data.monthly_trend || []);
    } catch (err) {
        console.error('Failed to load summary:', err);
    }
}

function renderCategoryChart(breakdown) {
    const canvas = document.getElementById('categoryChart');
    const emptyMsg = document.getElementById('chart-empty-msg');

    if (!breakdown || breakdown.length === 0) {
        canvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
            categoryChartInstance = null;
        }
        return;
    }

    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const labels = breakdown.map(b => b.category);
    const dataVals = breakdown.map(b => b.amount);

    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899', 
        '#8b5cf6', '#14b8a6', '#6366f1', '#f97316'
    ];

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 12, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ` ${ctx.label}: ${formatINR(ctx.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderMonthlyChart(trend) {
    const canvas = document.getElementById('monthlyChart');
    const emptyMsg = document.getElementById('monthly-empty-msg');

    if (!trend || trend.length === 0) {
        canvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        if (monthlyChartInstance) {
            monthlyChartInstance.destroy();
            monthlyChartInstance = null;
        }
        return;
    }

    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const labels = trend.map(t => t.month);
    const dataVals = trend.map(t => t.amount);

    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }

    monthlyChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Spending (₹)',
                data: dataVals,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3b82f6',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                },
                y: {
                    ticks: {
                        color: '#94a3b8',
                        callback: val => '₹' + val
                    },
                    grid: { color: '#334155' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ` Spending: ${formatINR(ctx.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Auth Tab switching
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
    });

    // Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username_or_email = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const data = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username_or_email, password })
            });
            currentUser = data.user;
            showToast('Welcome back, ' + currentUser.username, 'success');
            renderAuthenticatedState();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Register Submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        try {
            const data = await apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
            currentUser = data.user;
            showToast('Account created successfully!', 'success');
            renderAuthenticatedState();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
            showToast('Logged out', 'info');
            currentUser = null;
            renderUnauthenticatedState();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Open Modals
    document.getElementById('open-add-expense-btn').addEventListener('click', openAddExpenseModal);
    document.getElementById('open-categories-btn').addEventListener('click', () => {
        document.getElementById('categories-modal').style.display = 'flex';
    });

    // Close Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            document.getElementById(modalId).style.display = 'none';
        });
    });

    // Save Expense (Add or Edit)
    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const expenseId = document.getElementById('expense-id').value;
        const title = document.getElementById('expense-title').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const expense_date = document.getElementById('expense-date').value;
        const category_id = document.getElementById('expense-category').value;
        const payment_method = document.getElementById('expense-method').value;
        const note = document.getElementById('expense-note').value.trim();

        if (!title) {
            showToast('Title is required', 'error');
            return;
        }
        if (!amount || amount <= 0) {
            showToast('Amount must be greater than ₹0', 'error');
            return;
        }

        const payload = {
            title,
            amount,
            expense_date,
            category_id: category_id || null,
            payment_method,
            note
        };

        try {
            if (expenseId) {
                await apiRequest(`/api/expenses/${expenseId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                showToast('Expense updated successfully', 'success');
            } else {
                await apiRequest('/api/expenses', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                showToast('Expense added successfully', 'success');
            }
            document.getElementById('expense-modal').style.display = 'none';
            loadExpenses();
            loadDashboardSummary();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Add Category
    document.getElementById('add-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if (!name) return;

        try {
            await apiRequest('/api/categories', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            input.value = '';
            showToast('Category created', 'success');
            await loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Filters
    let debounceTimer = null;
    document.getElementById('filter-search').addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            loadExpenses(1);
        }, 300);
    });

    ['filter-category', 'filter-payment', 'filter-start-date', 'filter-end-date'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            currentPage = 1;
            loadExpenses(1);
        });
    });

    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-category').value = '';
        document.getElementById('filter-payment').value = '';
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        currentPage = 1;
        loadExpenses(1);
    });

    // Pagination
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            loadExpenses(currentPage - 1);
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        loadExpenses(currentPage + 1);
    });

    // Export CSV
    document.getElementById('export-csv-btn').addEventListener('click', () => {
        const search = document.getElementById('filter-search').value.trim();
        const catId = document.getElementById('filter-category').value;
        const method = document.getElementById('filter-payment').value;
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (catId) params.append('category_id', catId);
        if (method) params.append('payment_method', method);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        window.location.href = `/api/expenses/export?${params.toString()}`;
    });

    // Check initial auth
    checkAuth();
});
