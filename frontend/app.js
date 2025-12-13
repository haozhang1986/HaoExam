let API_BASE_URL = window.location.origin;
if (API_BASE_URL === 'null' || API_BASE_URL.startsWith('file:')) {
    API_BASE_URL = 'http://127.0.0.1:8000';
}

// GLOBAL ERROR HANDLER (silent in production)
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error('JS Error:', msg, 'at line', lineNo);
    return false;
};

// State
let basket = new Set();
let currentFilters = {
    curriculum: '',
    subject: '',
    year: '',
    month: '',
    difficulty: '',
    tag_category: '',
    tag_name: ''
};

// Auth State
// DOM Elements - Defined Globally to avoid Reference Errors
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');
const btnLogin = document.getElementById('btn-login'); // Header button
const btnLoginModal = document.getElementById('btn-login-modal'); // Modal submit button
const btnRegisterSwitch = document.getElementById('btn-register-switch');
const btnLoginSwitch = document.getElementById('btn-login-switch');
const userDisplay = document.getElementById('user-display');
const userRoleDisplay = document.getElementById('user-role');
const navRegister = document.getElementById('nav-register'); // If exists
const galleryGrid = document.getElementById('gallery-grid');
const basketCount = document.getElementById('basket-count');
const btnSafePdf = document.getElementById('btn-safe-pdf');
const btnGeneratePdf = btnSafePdf; // Alias
const btnResetFilters = document.getElementById('btn-reset-filters');
const chkIncludeAnswers = document.getElementById('chk-include-answers');

const modalLogin = document.getElementById('modal-login');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const regError = document.getElementById('reg-error');
const btnOpenLogin = document.getElementById('btn-open-login');
const btnCloseLogin = document.getElementById('btn-close-login');

let authToken = localStorage.getItem('auth_token');
let authRole = localStorage.getItem('auth_role') || 'student'; // Default to student/guest
let authUsername = localStorage.getItem('auth_username');

// Strict Auth wrapper (throws if no token)
async function authFetch(url, options = {}) {
    if (!authToken) {
        showLoginModal();
        throw new Error("No auth token");
    }
    return apiFetch(url, options); // Reuse apiFetch logic
}

// Public/Optional Auth wrapper (adds token if present, no error if missing)
async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    let finalHeaders;

    if (headers instanceof Headers) {
        finalHeaders = headers;
        if (authToken) finalHeaders.append('Authorization', `Bearer ${authToken}`);
    } else {
        finalHeaders = { ...headers };
        if (authToken) finalHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = finalHeaders;

    const response = await fetch(url, options);
    if (response.status === 401) {
        // Only if we SENT a token and it expired, we might want to logout.
        // But if we didn't send a token, 401 means "Login Required" for this endpoint.
        if (authToken) {
            logout();
            throw new Error("Unauthorized (Token Expired)");
        }
        // If we represent Guest, 401 just means forbidden action.
    }
    return response;
}

// Modal Logic
// (DOM Elements moved to top)

// Initial Setup

// Initial Setup
if (btnOpenLogin) btnOpenLogin.addEventListener('click', showLoginModal);
if (btnCloseLogin) btnCloseLogin.addEventListener('click', hideLoginModal);

// Tab Switching
if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabRegister.addEventListener('click', () => switchAuthTab('register'));
}

function switchAuthTab(mode) {
    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabLogin.style.color = 'var(--primary)';
        tabRegister.classList.remove('active');
        tabRegister.style.color = 'var(--text-muted)';

        formLogin.hidden = false;
        formRegister.hidden = true;
    } else {
        tabRegister.classList.add('active');
        tabRegister.style.color = 'var(--primary)';
        tabLogin.classList.remove('active');
        tabLogin.style.color = 'var(--text-muted)';

        formRegister.hidden = false;
        formLogin.hidden = true;
    }
}

function showLoginModal() {
    if (modalLogin) {
        modalLogin.hidden = false;
        switchAuthTab('login'); // Default to login
    }
}

function hideLoginModal() {
    if (modalLogin) modalLogin.hidden = true;
}

// Login Submit
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/token`, { method: 'POST', body: formData });

            if (response.ok) {
                handleAuthSuccess(await response.json(), username);
            } else {
                loginError.textContent = "Invalid credentials";
                loginError.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            loginError.textContent = "Login error";
            loginError.style.display = 'block';
        }
    });
}

// Register Submit
if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        regError.style.display = 'none';
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;

        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            if (response.ok) {
                handleAuthSuccess(await response.json(), username);
            } else {
                const data = await response.json();
                regError.textContent = data.detail || "Registration failed";
                regError.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            regError.textContent = "Registration error";
            regError.style.display = 'block';
        }
    });
}

function handleAuthSuccess(data, username) {
    authToken = data.access_token;
    authRole = data.role;
    authUsername = username;

    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_role', authRole);
    localStorage.setItem('auth_username', authUsername);

    hideLoginModal();
    updateUIByRole();
    if (document.getElementById('view-manage').classList.contains('active')) {
        loadManageView();
    } else {
        loadQuestions();
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_username');
    location.reload();
}

if (btnLogout) {
    btnLogout.addEventListener('click', logout);
}

// Role-Based UI (Updated for Guest/Student default)
function updateUIByRole() {
    const userDisplay = document.getElementById('user-display');
    const btnOpenLogin = document.getElementById('btn-open-login');
    const btnLogout = document.getElementById('btn-logout');

    // Default Role if not logged in
    const effectiveRole = authRole || 'student';

    // Toggle Login/Logout buttons
    // Toggle Login/Logout buttons
    // Toggle Login/Logout buttons
    // Toggle Login/Logout buttons
    if (authToken) {
        if (userDisplay) {
            userDisplay.textContent = `${authUsername} (${effectiveRole})`;
            userDisplay.hidden = false;
            userDisplay.style.display = '';
        }
        if (btnLogout) {
            btnLogout.hidden = false;
            btnLogout.style.display = '';
        }
        if (btnOpenLogin) {
            btnOpenLogin.hidden = true;
            btnOpenLogin.style.display = 'none';
        }
    } else {
        if (userDisplay) {
            userDisplay.hidden = true;
            userDisplay.style.display = 'none';
        }
        if (btnLogout) {
            btnLogout.hidden = true;
            btnLogout.style.display = 'none';
        }
        if (btnOpenLogin) {
            btnOpenLogin.hidden = false;
            btnOpenLogin.style.display = '';
        }
    }

    // Strict Access Control: Admin Only
    const isAdmin = (authToken && effectiveRole === 'admin');
    const basketSection = document.querySelector('.basket-section');

    if (isAdmin) {
        document.getElementById('nav-upload').style.display = '';
        document.getElementById('nav-manage').style.display = '';
        if (basketSection) basketSection.style.display = '';
    } else {
        document.getElementById('nav-upload').style.display = 'none';
        document.getElementById('nav-manage').style.display = 'none';
        // Basket allowed for Teachers? Or only Admin too?
        // User said "only use admin account can upload and manage".
        // Basket is part of "Management" or "Gallery"? Usually Teachers need Basket.
        // Assuming Basket logic remains: Student hidden, others show.
        // But requested specifically "Upload and Management" buttons.
        if (effectiveRole === 'student') {
            if (basketSection) basketSection.style.display = 'none';
        } else {
            if (basketSection) basketSection.style.display = '';
        }
    }
}

function checkLogin() {
    updateUIByRole(); // Just update UI, don't force modal
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkLogin(); // Check auth first
    loadQuestions(); // Load initial questions
    loadFilters();
    updateBasketUI();

    // Managers are initialized at the bottom of the file (Lines 1670+) to ensure all classes are defined.
});

// --- Navigation Logic ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(viewId).classList.add('active');

    // Update active nav button
    const navId = 'nav-' + viewId.replace('view-', '');
    const navBtn = document.getElementById(navId);
    if (navBtn) navBtn.classList.add('active');
}

document.getElementById('nav-gallery').addEventListener('click', () => switchView('view-gallery'));

// --- ID Search Listener (Top Level) ---
const headerSearchId = document.getElementById('header-search-id');
const btnClearSearch = document.getElementById('btn-clear-search');

// Show/hide clear button based on input content
function updateClearBtnVisibility() {
    if (btnClearSearch && headerSearchId) {
        btnClearSearch.style.display = headerSearchId.value ? 'block' : 'none';
    }
}

if (headerSearchId) {
    // Input event - fires when user types
    headerSearchId.addEventListener('input', () => {
        updateClearBtnVisibility();

        // If user is typing an ID, clear all sidebar filters
        if (headerSearchId.value) {
            const filterSelects = document.querySelectorAll('.filters-section select');
            filterSelects.forEach(select => {
                if (select.multiple) {
                    Array.from(select.options).forEach(opt => opt.selected = false);
                    if (select.multiSelectInstance) {
                        select.multiSelectInstance.refresh();
                    }
                } else {
                    select.value = '';
                }
            });
        }

        // Check which view is active and call appropriate load function
        const viewManage = document.getElementById('view-manage');
        const isManageActive = viewManage && viewManage.classList.contains('active');

        if (isManageActive) {
            currentFilters = getFilters();
            loadManageView();
        } else {
            loadQuestions();
        }
    });
}

// Clear button click handler
if (btnClearSearch && headerSearchId) {
    btnClearSearch.addEventListener('click', () => {
        headerSearchId.value = '';
        updateClearBtnVisibility();
        headerSearchId.focus();

        // Reload questions/manage view
        const viewManage = document.getElementById('view-manage');
        const isManageActive = viewManage && viewManage.classList.contains('active');
        if (isManageActive) {
            currentFilters = getFilters();
            loadManageView();
        } else {
            loadQuestions();
        }
    });
}

document.getElementById('nav-upload').addEventListener('click', () => switchView('view-upload'));
document.getElementById('nav-manage').addEventListener('click', () => {
    switchView('view-manage');
    // Default to questions tab
    switchTab('questions');
});

// --- Tab Logic ---
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`content-${tabName}`).classList.add('active');

    // Load content
    if (tabName === 'questions') {
        loadManageView();
    } else if (tabName === 'tags') {
        loadTagsView();
    }
}

document.getElementById('tab-questions').addEventListener('click', () => switchTab('questions'));
document.getElementById('tab-tags').addEventListener('click', () => switchTab('tags'));

// --- Filter Logic ---
async function loadFilters() {
    try {
        // Load Curriculums
        const currResponse = await fetch(`${API_BASE_URL}/curriculums/`);
        const curriculums = await currResponse.json();
        const currSelect = document.getElementById('filter-curriculum');
        // Keep "All" option
        currSelect.innerHTML = '<option value="">All</option>';
        curriculums.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            currSelect.appendChild(option);
        });

        // Load Subjects
        const subjResponse = await fetch(`${API_BASE_URL}/subjects/`);
        const subjects = await subjResponse.json();
        const subjSelect = document.getElementById('filter-subject');
        // Keep "All" option
        subjSelect.innerHTML = '<option value="">All</option>';
        subjects.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            subjSelect.appendChild(option);
        });


        // Auto-refresh questions on filter change
        const filterIds = [
            'filter-curriculum', 'filter-subject', 'filter-year',
            'filter-month', 'filter-difficulty',
            'filter-tag-category', 'filter-tag-name',
        ];

        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // For text input, use 'input' event (maybe debounce?)
                // For Selects, use 'change'
                const eventType = el.tagName === 'INPUT' ? 'input' : 'change';

                el.addEventListener(eventType, () => {
                    // If user selects a filter, clear the ID search box
                    const headerSearch = document.getElementById('header-search-id');
                    if (headerSearch && headerSearch.value) {
                        headerSearch.value = '';

                    }

                    // Check which view is active
                    const viewManage = document.getElementById('view-manage');
                    const isManageActive = viewManage && viewManage.classList.contains('active');

                    if (isManageActive) {
                        currentFilters = getFilters();
                        loadManageView();
                    } else {
                        loadQuestions();
                    }
                });
            }
        });

        // Search ID Listener (New Header Input)
        const searchIdInput = document.getElementById('header-search-id');
        // ID search input listener (attached in ID search section above)

        // Upload Managers
        const tagsResponse = await fetch(`${API_BASE_URL}/tags/`);
        const tags = await tagsResponse.json();

        const categorySelect = document.getElementById('filter-tag-category');
        const nameSelect = document.getElementById('filter-tag-name');

        // Reset options
        categorySelect.innerHTML = '<option value="">All</option>';
        nameSelect.innerHTML = '<option value="">All</option>';

        const categories = new Set(tags.map(t => t.category));
        const names = new Set(tags.map(t => t.name));

        categories.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            categorySelect.appendChild(option);
        });

        names.forEach(n => {
            const option = document.createElement('option');
            option.value = n;
            option.textContent = n;
            nameSelect.appendChild(option);
        });

    } catch (e) {
        console.error("Error loading filters:", e);
    }
}

function getFilters() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        // Check for multi-select
        if (el.multiple) {
            const values = Array.from(el.selectedOptions).map(opt => opt.value).filter(v => v);
            return values.length > 0 ? values : '';
        }
        return el.value;
    };

    return {
        id: getValue('header-search-id'),
        curriculum: getValue('filter-curriculum'),
        subject: getValue('filter-subject'),
        year: getValue('filter-year'),
        month: getValue('filter-month'),
        difficulty: getValue('filter-difficulty'),
        tag_category: getValue('filter-tag-category'),
        tag_name: getValue('filter-tag-name')
    };
}

// Manual Search Trigger
// Added debug for filter verification
if (btnResetFilters) {
    btnResetFilters.addEventListener('click', async () => {
        // 1. Clear all Select inputs in filters section
        const filtersDiv = document.querySelector('.filters-section');
        if (filtersDiv) {
            const selects = filtersDiv.querySelectorAll('select');
            selects.forEach(s => {
                if (s.multiple) {
                    // For multi-select, deselect all options
                    Array.from(s.options).forEach(opt => opt.selected = false);
                    // Refresh the MultiSelectDropdown visual component if it exists
                    if (s.multiSelectInstance) {
                        s.multiSelectInstance.refresh();
                    }
                } else {
                    s.value = "";
                }
            });
        }

        // Also clear the ID search box
        const headerSearch = document.getElementById('header-search-id');
        if (headerSearch) headerSearch.value = '';

        // 2. Refresh Cascade Options (to restore "All")
        await loadFilters(); // Assuming this fetches defaults when inputs are empty

        // 3. Update global currentFilters
        currentFilters = getFilters();

        // 4. Reload results
        if (document.getElementById('view-manage').classList.contains('active')) {
            loadManageView();
        } else {
            loadQuestions();
        }
    });
}


// --- Gallery Logic ---

// --- Gallery Logic ---
async function loadQuestions() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    // Get filters
    const filters = getFilters();
    const params = new URLSearchParams();

    // Map filters to params (supporting Arrays for Multi-Select)
    // Map filters to params (supporting Arrays for Multi-Select)

    // STRICT SEARCH: If ID is present, ignore other filters

    if (filters.id) {
        params.append('id', filters.id);

        // Clear other params to ensure exact match? 
        // Or should we allow drilling down? 
        // User requested "precise search... displayed many other questions".
        // This implies they want ONLY that question.
        // So we skip appending others.
    } else {
        for (const [key, value] of Object.entries(filters)) {
            // Skip empty values and skip 'id' (handled above)
            if (!value || key === 'id' || (Array.isArray(value) && value.length === 0)) continue;

            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else {
                params.append(key, value);
            }
        }
    }

    try {
        galleryGrid.innerHTML = '<div class="loading-state">Loading questions...</div>';

        // USE apiFetch (Optional Auth)
        const response = await apiFetch(`${API_BASE_URL}/questions/?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const questions = await response.json();

        galleryGrid.innerHTML = '';

        if (questions.length === 0) {
            galleryGrid.innerHTML = '<div style="text-align:center; grid-column: 1/-1; padding: 2rem;">No questions found matching your criteria</div>';
            return;
        }

        questions.forEach(q => {
            const card = createQuestionCard(q);
            galleryGrid.appendChild(card);
        });

    } catch (e) {
        console.error("Error loading questions:", e);
        galleryGrid.innerHTML = '<div style="color:red; text-align:center; grid-column: 1/-1;">Error loading questions</div>';
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.title = `ID: ${question.id}`; // Show ID on hover

    const isSelected = basket.has(question.id);

    // Deduplicate tags
    const uniqueTags = [];
    const seenTags = new Set();
    if (question.tags) {
        question.tags.forEach(tag => {
            const key = `${tag.category}:${tag.name}`;
            if (!seenTags.has(key)) {
                seenTags.add(key);
                uniqueTags.push(tag);
            }
        });
    }

    // Format tags
    const tagBadges = uniqueTags.map(tag =>
        `<span class="tag">${tag.category}: ${tag.name}</span>`
    ).join('');

    // Role-Based Button Visibility
    let showAnswerBtn = '';
    let basketBtn = '';

    // Student: No Answer, No Basket
    if (authRole === 'student') {
        showAnswerBtn = `
            <button class="btn-primary" disabled style="flex: 1; background-color: #ccc; cursor: not-allowed; font-size: 0.875rem;" title="Students cannot view answers">
                Answer Hidden
            </button>`;
        // Basket button hidden for students
    } else {
        // Teacher/Admin
        showAnswerBtn = `
            <button class="btn-primary" style="flex: 1; background-color: #6366f1; font-size: 0.875rem;" onclick="viewAnswer('${question.answer_image_path}')">
                Show Answer
            </button>`;

        // Basket available for Teacher/Admin
        basketBtn = `
            <button class="btn-basket ${isSelected ? 'selected' : ''}" style="flex: 1; font-size: 0.875rem;" 
                    onclick="toggleBasket(${question.id}, this)">
                ${isSelected ? 'Remove' : 'Add to Basket'}
            </button>`;
    }

    card.innerHTML = `
        <div class="card-img">
            <img src="${API_BASE_URL}/${question.question_image_path}" loading="lazy" alt="Question ${question.id}">
        </div>
        <div class="card-body">
            <div class="card-tags">
                ${tagBadges}
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                ${showAnswerBtn}
                ${basketBtn}
            </div>
        </div>
    `;

    return card;
}

// Answer Viewer Logic
const modalViewAnswer = document.getElementById('modal-view-answer');
const answerImgView = document.getElementById('answer-img-view');
const btnCloseAnswer = document.getElementById('btn-close-answer');

window.viewAnswer = (path) => {
    answerImgView.src = `${API_BASE_URL}/${path}`;
    modalViewAnswer.hidden = false;
};

// Close on 'x' button
if (btnCloseAnswer) {
    btnCloseAnswer.addEventListener('click', () => {
        modalViewAnswer.hidden = true;
        answerImgView.src = '';
    });
}

// Close on background click
if (modalViewAnswer) {
    modalViewAnswer.addEventListener('click', (e) => {
        if (e.target === modalViewAnswer) {
            modalViewAnswer.hidden = true;
            answerImgView.src = '';
        }
    });
}

// --- Basket Logic ---
function toggleBasket(questionId, btnElement) {
    if (basket.has(questionId)) {
        basket.delete(questionId);
        btnElement.textContent = 'Add to Basket';
        btnElement.classList.remove('selected');
    } else {
        basket.add(questionId);
        btnElement.textContent = 'Remove from Basket';
        btnElement.classList.add('selected');
    }
    updateBasketUI();
}

function updateBasketUI() {
    basketCount.textContent = basket.size;
    btnSafePdf.disabled = basket.size === 0;
}

btnSafePdf.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();



    if (basket.size === 0) return;

    const btn = btnSafePdf;
    const includeAnswers = chkIncludeAnswers.checked;

    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const response = await fetch(`${API_BASE_URL}/worksheet/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_ids: Array.from(basket),
                include_answers: includeAnswers
            })
        });
        if (response.ok) {
            // Parse JSON response
            const data = await response.json();

            // 1. Check for success
            if (!data.file_id) {
                document.getElementById('pdf-status').textContent = 'Server Error: No file ID returned.';
                document.getElementById('pdf-status').style.color = 'red';
                return;
            }

            // 2. Calculate Filename: date + worksheet
            const today = new Date().toISOString().split('T')[0];
            const filename = `${today}_HaoExam_Worksheet.pdf`;

            // 3. Request Static Link (The "Physical Rename" Strategy - ORIGINAL WORKING CODE)
            const statusEl = document.getElementById('pdf-status');
            statusEl.textContent = "Preparing download...";

            try {
                const linkResponse = await fetch(`${API_BASE_URL}/worksheet/prepare-download/${data.file_id}?name=${encodeURIComponent(filename)}`);
                if (!linkResponse.ok) throw new Error("Failed to prepare download link");

                const linkData = await linkResponse.json();
                if (!linkData.url) throw new Error("No URL returned");

                let finalUrl = linkData.url;
                // Ensure absolute URL
                if (finalUrl.startsWith('/') && API_BASE_URL) {
                    finalUrl = API_BASE_URL.replace(/\/$/, '') + finalUrl;
                }


                // Use hidden iframe for download - most reliable method
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = finalUrl;
                document.body.appendChild(iframe);

                // Remove iframe after a delay
                setTimeout(() => document.body.removeChild(iframe), 10000);

                statusEl.textContent = "Download started! Check your Downloads folder.";
                statusEl.style.color = "green";
            } catch (linkErr) {
                console.error('Download error:', linkErr);
                statusEl.textContent = "Download Error: " + linkErr.message;
                statusEl.style.color = "red";
            }

        } else {
            document.getElementById('pdf-status').textContent = "Server Error: Failed to generate.";
            document.getElementById('pdf-status').style.color = "red";
        }
    } catch (e) {
        console.error(e);
        document.getElementById('pdf-status').textContent = "Network Error: " + e.message;
        document.getElementById('pdf-status').style.color = "red";
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate PDF (Safe)';
    }
});

// --- Upload Logic ---

// State to store files
let questionFiles = [];
let answerFiles = [];

// Helper: Add file to state and preview
function addFile(file, type) {
    if (type === 'q') {
        questionFiles.push(file);
        renderPreview(file, 'upload-box-q', 'clear-q');
        document.getElementById('upload-box-q').classList.add('has-files');
    } else {
        answerFiles.push(file);
        renderPreview(file, 'upload-box-a', 'clear-a');
        document.getElementById('upload-box-a').classList.add('has-files');
    }
}

// Render Preview
function renderPreview(file, containerId, clearBtnId) {
    const container = document.getElementById(containerId);
    const clearBtn = document.getElementById(clearBtnId);

    const reader = new FileReader();
    reader.onload = function (event) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'preview-img-container';

        const img = document.createElement('img');
        img.src = event.target.result;
        img.className = 'preview-img';

        imgContainer.appendChild(img);
        container.appendChild(imgContainer);
        clearBtn.hidden = false;
    };
    reader.readAsDataURL(file);
}

// File Input Handling
document.getElementById('file-input-q').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => addFile(file, 'q'));
    // Reset input so same file can be selected again if needed
    e.target.value = '';
});

document.getElementById('file-input-a').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => addFile(file, 'a'));
    e.target.value = '';
});



// Image Paste Handling
function handlePaste(e, type) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasImage = false;
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            addFile(blob, type);
            hasImage = true;
        }
    }
    if (hasImage) e.preventDefault();
}

document.getElementById('upload-box-q').addEventListener('paste', (e) => handlePaste(e, 'q'));
document.getElementById('upload-box-a').addEventListener('paste', (e) => handlePaste(e, 'a'));

// Clear Buttons
function clearImages(containerId, clearBtnId, type) {
    const container = document.getElementById(containerId);
    const images = container.querySelectorAll('.preview-img-container');
    images.forEach(img => img.remove());
    document.getElementById(clearBtnId).hidden = true;

    // Clear state
    if (type === 'q') questionFiles = [];
    if (type === 'a') answerFiles = [];

    // Remove styling class
    container.classList.remove('has-files');
}

document.getElementById('clear-q').addEventListener('click', (e) => {
    e.stopPropagation();
    clearImages('upload-box-q', 'clear-q', 'q');
});

document.getElementById('clear-a').addEventListener('click', (e) => {
    e.stopPropagation();
    clearImages('upload-box-a', 'clear-a', 'a');
});

// Dynamic Tag Loading for Upload Form


// Dynamic Month Logic
function updateMonthOptions(curriculumSelectId, monthSelectId) {
    const curriculum = document.getElementById(curriculumSelectId).value;
    const monthSelect = document.getElementById(monthSelectId);

    monthSelect.innerHTML = ''; // Clear options

    // Check if we should add "Create New" (only for upload input)
    const isUpload = monthSelectId.startsWith('input-');

    let options = '';
    if (['A-Level', 'IGCSE'].includes(curriculum)) {
        options = `
            <option value="Spring">Spring (Feb/Mar)</option>
            <option value="Summer">Summer (May/Jun)</option>
            <option value="Autumn">Autumn (Oct/Nov)</option>
        `;
    } else if (['AP', 'IB'].includes(curriculum)) {
        options = `<option value="Summer" selected>Summer (May)</option>`;
    } else {
        // Default or Custom
        options = `
            <option value="">Select...</option>
            <option value="Spring">Spring</option>
            <option value="Summer">Summer</option>
            <option value="Autumn">Autumn</option>
            <option value="Winter">Winter</option>
        `;
    }

    monthSelect.innerHTML = options;

    if (isUpload) {
        // Append Create New
        const newOpt = document.createElement('option');
        newOpt.value = '__new__';
        newOpt.textContent = '+ Create New';
        monthSelect.appendChild(newOpt);
    }
}

document.getElementById('input-curriculum').addEventListener('change', () => updateMonthOptions('input-curriculum', 'input-month'));
document.getElementById('edit-curriculum').addEventListener('change', () => updateMonthOptions('edit-curriculum', 'edit-month'));

// Trigger once on init (though usually empty)
updateMonthOptions('input-curriculum', 'input-month');

// Note: loadUploadTags is removed in favor of CascadingDropdownManager

// Handle "Create New" selection
function handleNewInput(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);

    if (!select || !input) return;

    select.addEventListener('change', () => {
        if (select.value === '__new__') {
            input.hidden = false;
            input.focus();
            // Reset input value when showing
            input.value = '';
        } else {
            input.hidden = true;
        }
    });
}

handleNewInput('input-tag-category', 'new-tag-category');
handleNewInput('input-tag-name', 'new-tag-name');
handleNewInput('input-curriculum', 'new-curriculum');
handleNewInput('input-subject', 'new-subject');
handleNewInput('input-year', 'new-year');
handleNewInput('input-month', 'new-month');


// Submit Upload
document.getElementById('btn-submit-upload').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit-upload');

    // Validation
    if (questionFiles.length === 0 || answerFiles.length === 0) {
        alert('Please upload both Question and Answer images.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const formData = new FormData();

        // Append files from state
        questionFiles.forEach((file, i) => {
            formData.append('question_images', file, `q_${i}.png`);
        });

        answerFiles.forEach((file, i) => {
            formData.append('answer_images', file, `a_${i}.png`);
        });

        // Metadata
        // Handle Custom Inputs
        let curriculum = document.getElementById('input-curriculum').value;
        if (curriculum === '__new__') curriculum = document.getElementById('new-curriculum').value;

        let subject = document.getElementById('input-subject').value;
        if (subject === '__new__') subject = document.getElementById('new-subject').value;

        let tagCategory = document.getElementById('input-tag-category').value;
        if (tagCategory === '__new__') tagCategory = document.getElementById('new-tag-category').value;

        let tagName = document.getElementById('input-tag-name').value;
        if (tagName === '__new__') tagName = document.getElementById('new-tag-name').value;

        let year = document.getElementById('input-year').value;
        if (year === '__new__') year = document.getElementById('new-year').value;

        formData.append('curriculum', curriculum);
        formData.append('subject', subject);
        formData.append('year', year);
        formData.append('month', document.getElementById('input-month').value);
        formData.append('difficulty', document.getElementById('input-difficulty').value);
        formData.append('question_number', document.getElementById('input-qno').value);

        if (tagCategory) formData.append('tag_category', tagCategory);
        if (tagName) formData.append('tag_name', tagName);

        const response = await authFetch(`${API_BASE_URL}/questions/`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            // Show Success Overlay
            const overlay = document.getElementById('overlay');
            overlay.hidden = false;
            setTimeout(() => {
                overlay.hidden = true;
            }, 2000);

            // Clear Form
            document.getElementById('file-input-q').value = '';
            document.getElementById('file-input-a').value = '';
            clearImages('upload-box-q', 'clear-q', 'q');
            clearImages('upload-box-a', 'clear-a', 'a');
            document.getElementById('input-qno').value = '';

            // Reload Gallery
            loadQuestions();

            // Reset Tag inputs
            document.getElementById('input-tag-category').value = '';
            document.getElementById('new-tag-category').hidden = true;
            document.getElementById('new-tag-category').value = '';

            document.getElementById('input-tag-name').value = '';
            document.getElementById('new-tag-name').hidden = true;
            document.getElementById('new-tag-name').value = '';

            // Refresh actions
            // loadFilters(); 
            // Note: Cascade logic handles dropdowns. We might need to reset them to defaults.
            // For now, reloading questions is enough visual feedback.
        } else {
            const errData = await response.json().catch(() => ({}));
            alert(`Error uploading question: ${response.status} ${response.statusText}\n${JSON.stringify(errData)}`);
        }

    } catch (e) {
        console.error(e);
        alert('Error uploading question');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Question';
    }
});

// --- Manage View Logic ---
async function loadManageView() {
    const grid = document.getElementById('manage-grid');
    grid.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

    try {
        const params = new URLSearchParams();

        if (typeof currentFilters !== 'undefined') {
            for (const [key, value] of Object.entries(currentFilters)) {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else if (value) {
                    params.append(key, value);
                }
            }
        }


        let url = `${API_BASE_URL}/questions/?${params.toString()}`;
        if (!params.toString()) {
            url += 'limit=50'; // Default if no filter
        }

        const response = await authFetch(url);
        const questions = await response.json();
        // Cache for access by ID
        window.currentManagedQuestions = questions;

        grid.innerHTML = '';
        if (questions.length === 0) {
            grid.innerHTML = '<tr><td colspan="5" style="text-align: center;">No questions found.</td></tr>';
            return;
        }

        questions.forEach(q => {
            const row = document.createElement('tr');

            const tags = q.tags.map(t => `${t.category}: ${t.name}`).join(', ');

            row.innerHTML = `
                <td>${q.id}</td>
                <td><img src="${API_BASE_URL}/${q.question_image_path}" loading="lazy" class="manage-img"></td>
                <td>
                    <div><strong>${q.curriculum} ${q.subject}</strong></div>
                    <div style="font-size: 0.875rem; color: #6b7280;">${q.year} ${q.month || ''} ${q.paper ? '- ' + q.paper : ''} - Q${q.question_number || '?'}</div>
                </td>
                <td>${tags}</td>
                <td>
                    <button type="button" class="btn-delete-action" style="background-color: #e0f2fe; color: #0284c7; margin-right: 0.5rem;" onclick="openEditQuestionModalById(event, ${q.id})">Edit</button>
                    <button type="button" class="btn-delete-action btn-delete-item" data-id="${q.id}">Delete</button>
                </td>
            `;
            grid.appendChild(row);
        });
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading questions.</td></tr>';
    }
}

// Custom Delete Modal Logic
const modalConfirmDelete = document.getElementById('modal-confirm-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
let questionToDeleteId = null;

if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', () => {
        modalConfirmDelete.hidden = true;
        questionToDeleteId = null;
    });
}

if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
        if (questionToDeleteId) {
            btnConfirmDelete.disabled = true;
            btnConfirmDelete.textContent = 'Deleting...';

            await deleteQuestion(questionToDeleteId);

            modalConfirmDelete.hidden = true;
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.textContent = 'Delete';
            questionToDeleteId = null;
        }
    });
}

// Event Delegation for Delete (opens custom modal)
document.getElementById('manage-grid').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-item')) {
        e.preventDefault();
        e.stopPropagation();

        const id = e.target.getAttribute('data-id');
        questionToDeleteId = id;

        modalConfirmDelete.hidden = false;
    }
});

async function deleteQuestion(id) {
    try {
        const response = await authFetch(`${API_BASE_URL}/questions/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove row from table
            loadManageView(); // Reload list

            // Also remove from basket if present
            if (basket.has(id)) {
                basket.delete(id);
                updateBasketUI();
            }
        } else {
            alert('Failed to delete question');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting question');
    }
}

// --- Mobile Sidebar Logic ---
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// Close sidebar when clicking a nav item on mobile
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    });
});

// --- Tag Management Logic ---
const tagsGrid = document.getElementById('tags-grid');
const modalEditTag = document.getElementById('modal-edit-tag');
const editTagIdInput = document.getElementById('edit-tag-id');
const editTagCategoryInput = document.getElementById('edit-tag-category');
const editTagNameInput = document.getElementById('edit-tag-name');
const btnSaveTag = document.getElementById('btn-save-tag');
const btnCancelTag = document.getElementById('btn-cancel-tag');

async function loadTagsView() {
    tagsGrid.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';
    try {
        const response = await fetch(`${API_BASE_URL}/tags/`);
        const tags = await response.json();

        tagsGrid.innerHTML = '';
        if (tags.length === 0) {
            tagsGrid.innerHTML = '<tr><td colspan="4" style="text-align: center;">No tags found.</td></tr>';
            return;
        }

        tags.forEach(tag => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tag.id}</td>
                <td>${tag.category}</td>
                <td>${tag.name}</td>
                <td>
                    <button class="btn-delete-action" style="background-color: #e0f2fe; color: #0284c7; margin-right: 0.5rem;" onclick="openEditTagModal(${tag.id}, '${tag.category}', '${tag.name}')">Edit</button>
                    <button class="btn-delete-action" onclick="confirmDeleteTag(${tag.id})">Delete</button>
                </td>
            `;
            tagsGrid.appendChild(row);
        });
    } catch (e) {
        console.error(e);
        tagsGrid.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error loading tags.</td></tr>';
    }
}

window.openEditTagModal = (id, category, name) => {
    editTagIdInput.value = id;
    editTagCategoryInput.value = category;
    editTagNameInput.value = name;
    modalEditTag.hidden = false;
};

if (btnCancelTag) {
    btnCancelTag.addEventListener('click', () => {
        modalEditTag.hidden = true;
    });
}

if (btnSaveTag) {
    btnSaveTag.addEventListener('click', async () => {
        const id = editTagIdInput.value;
        const category = editTagCategoryInput.value;
        const name = editTagNameInput.value;

        if (!category || !name) {
            alert('Please fill in both fields');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/tags/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category, name })
            });

            if (response.ok) {
                modalEditTag.hidden = true;
                loadTagsView(); // Reload list
                loadFilters();
                loadUploadTags(); // Reload upload form tags
            } else {
                alert('Failed to update tag');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating tag');
        }
    });
}

// Ensure global scope
window.confirmDeleteTag = async function (id) {
    if (confirm('Are you sure you want to delete this tag? This will remove it from all associated questions.')) {
        try {
            const response = await authFetch(`${API_BASE_URL}/tags/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadTagsView();
                loadFilters();
                loadUploadTags(); // Reload upload form tags
            } else {
                alert('Failed to delete tag');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting tag');
        }
    }
};

// Update nav listener to load tags
// const navTags = document.getElementById('nav-tags');
// if (navTags) {
//     navTags.addEventListener('click', () => {
//         switchView('view-tags');
//         loadTagsView();
//     });
// }

// --- Edit Question Logic ---
const modalEditQuestion = document.getElementById('modal-edit-question');
const btnCancelQuestion = document.getElementById('btn-cancel-question');
const btnSaveQuestion = document.getElementById('btn-save-question');

// --- Cascading Metadata Logic ---

class CascadingDropdownManager {
    constructor(config) {
        this.config = config; // { curriculum: 'input-curriculum', subject: 'input-subject', ... }
        this.initListeners();
    }

    initListeners() {

        const { curriculum, subject, year, month, tag_category, tag_name } = this.config;

        if (!curriculum) console.error("Config missing: curriculum");
        if (!subject) console.error("Config missing: subject");
        if (!year) console.error("Config missing: year");
        if (!month) console.error("Config missing: month");
        if (!tag_category) console.error("Config missing: tag_category");

        this.attachListener(curriculum, () => this.updateOptions('subject'));
        this.attachListener(subject, () => {
            this.updateOptions('year');
            this.updateOptions('tag_category'); // Topic depends on Subject
        });
        this.attachListener(year, () => this.updateOptions('month'));
        this.attachListener(tag_category, () => this.updateOptions('tag_name'));
    }

    attachListener(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', callback);
        } else {
            console.error(`Missing element: ${id}`);
        }
    }

    async updateOptions(targetField) {
        const targetIdMap = {
            'subject': this.config.subject,
            'year': this.config.year,
            'month': this.config.month,
            'tag_category': this.config.tag_category,
            'tag_name': this.config.tag_name
        };

        const targetId = targetIdMap[targetField];
        if (!targetId) {
            return;
        }

        // Build query params from current values
        const params = new URLSearchParams();
        // ...
        const { curriculum, subject, year, month, tag_category } = this.config;

        const addParam = (key, id) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'SELECT') {
                    // Support Multi-Select
                    const values = Array.from(el.selectedOptions).map(o => o.value).filter(v => v && v !== '__new__');
                    // console.log(`DEBUG: addParam ${key} from ${id} found values:`, values);
                    values.forEach(v => params.append(key, v));
                } else {
                    // Handle standard inputs (text/number)
                    if (el.value) params.append(key, el.value);
                }
            } else {
                console.warn(`DEBUG: addParam ${key} element ${id} NOT FOUND`);
            }
        };

        // Hierarchy assumption: simpler fields depend on broader ones
        addParam('curriculum', curriculum);
        if (targetField !== 'subject') addParam('subject', subject);

        // Time filters apply to Papers, but NOT to Tags (Taxonomy is global)
        const isTagUpdate = targetField === 'tag_category' || targetField === 'tag_name';

        if (!isTagUpdate) {
            if (targetField !== 'year') addParam('year', year);
        }

        if (targetField === 'tag_name') {
            addParam('tag_category', tag_category);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/metadata/distinct/${targetField}?${params.toString()}`);
            if (response.ok) {
                const values = await response.json();
                this.populateDropdown(targetId, values);
            } else {
                console.warn(`Fetch failed for ${targetField}, defaulting to empty list.`);
                this.populateDropdown(targetId, []);
            }
        } catch (e) {
            console.error(`Error updating ${targetField}`, e);
            this.populateDropdown(targetId, []);
        }
    }

    populateDropdown(elementId, values) {
        const select = document.getElementById(elementId);
        if (!select) return;

        // Guard against non-select elements (e.g. edit-year is an input)
        if (select.tagName !== 'SELECT') {
            // console.warn(`Skipping populateDropdown for non-select element: ${elementId}`);
            return;
        }

        // Treat both 'input-' (upload) and 'edit-' (edit modal) as forms needing "Create New"
        const isUpload = elementId.startsWith('input-') || elementId.startsWith('edit-');

        // Save previously selected values to restore them if possible
        const oldValues = Array.from(select.selectedOptions).map(o => o.value);

        let optionsHtml = '';

        if (isUpload) {
            optionsHtml += '<option value="">Select...</option>';
            optionsHtml += '<option value="__new__">+ Create New</option>';
        } else {
            // For Filter, "All" is redundant if we assume "Empty Selection" == "All", 
            // but standard UI usually keeps an empty option or "All".
            // For Multi-Select, we usually don't need a specific "All" option if checkboxes are used.
            // But let's keep it for compatibility with single select fallback.
            optionsHtml += '<option value="">All</option>';
        }

        if (Array.isArray(values)) {
            values.forEach(val => {
                optionsHtml += `<option value="${val}">${val}</option>`;
            });
        }

        select.innerHTML = optionsHtml;

        // Restore values
        oldValues.forEach(val => {
            // Basic restoration
            const opt = select.querySelector(`option[value="${val}"]`);
            if (opt) opt.selected = true;
        });

        // Notify MultiSelect Wrapper if exists
        if (select.multiSelectInstance) {
            select.multiSelectInstance.refresh();
        }
    }

    // Trigger initial updates based on default values
    refreshAll() {
        const { curriculum, subject, year, month, tag_category, tag_name } = this.config;

        // Trigger updates in order of hierarchy
        if (curriculum) this.updateOptions('subject');
        if (subject) {
            this.updateOptions('year');
            this.updateOptions('tag_category');
        }
        if (year) this.updateOptions('month');
        if (tag_category) this.updateOptions('tag_name');
    }
}


// --- MultiSelect Dropdown Component ---
class MultiSelectDropdown {
    constructor(selectId) {
        this.selectInfo = document.getElementById(selectId);
        if (!this.selectInfo) return;

        this.selectInfo.multiple = true; // Force underlying select to likely handle multiple
        this.selectInfo.style.display = 'none'; // Hide original

        this.container = document.createElement('div');
        this.container.className = 'multiselect-container';

        this.btn = document.createElement('button');
        this.btn.className = 'multiselect-btn';
        this.btn.type = 'button';
        this.btn.textContent = 'All'; // Default
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.dropdown = document.createElement('div');
        this.dropdown.className = 'multiselect-dropdown';
        this.dropdown.hidden = true;

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.dropdown.hidden = true;
            }
        });

        this.container.appendChild(this.btn);
        this.container.appendChild(this.dropdown);

        this.selectInfo.parentNode.insertBefore(this.container, this.selectInfo.nextSibling); // Insert after select

        // Link instance for external refresh
        this.selectInfo.multiSelectInstance = this;

        this.refresh();
    }

    toggle() {
        this.dropdown.hidden = !this.dropdown.hidden;
    }

    refresh() {
        // Build checkboxes from select options
        this.dropdown.innerHTML = '';
        const options = Array.from(this.selectInfo.options);

        let selectedCount = 0;
        let selectedLabels = [];

        options.forEach(opt => {
            if (!opt.value || opt.value === '__new__') return; // Skip placeholders

            const item = document.createElement('label');
            item.className = 'multiselect-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt.value;
            checkbox.checked = opt.selected;

            checkbox.addEventListener('change', () => {
                opt.selected = checkbox.checked;
                this.updateButton();
                // Trigger change on original select
                this.selectInfo.dispatchEvent(new Event('change'));
            });

            if (opt.selected) {
                selectedCount++;
                selectedLabels.push(opt.text);
            }

            item.appendChild(checkbox);
            item.appendChild(document.createTextNode(opt.text));
            this.dropdown.appendChild(item);
        });

        this.updateButton();
    }

    updateButton() {
        const selected = Array.from(this.selectInfo.selectedOptions).filter(o => o.value);
        if (selected.length === 0) {
            this.btn.textContent = 'All';
            this.btn.classList.remove('active');
        } else if (selected.length <= 2) {
            this.btn.textContent = selected.map(o => o.text).join(', ');
            this.btn.classList.add('active');
        } else {
            this.btn.textContent = `${selected.length} Selected`;
            this.btn.classList.add('active');
        }
    }
}

// Initialize Managers
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Filter Manager
        const filterManager = new CascadingDropdownManager({
            curriculum: 'filter-curriculum',
            subject: 'filter-subject',
            year: 'filter-year',
            month: 'filter-month',
            tag_category: 'filter-tag-category',
            tag_name: 'filter-tag-name'
        });
        window.filterManager = filterManager; // Global access

        // Initialize Multi-Select support
        const msFields = ['filter-difficulty', 'filter-tag-category', 'filter-tag-name'];
        msFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) new MultiSelectDropdown(id);
        });

        filterManager.refreshAll();

        // Upload Manager
        // Note: input-month logic is currently custom (seasonal). 
        // We might override it or integrate it. For now, let's focus on Subject/Topic chains.
        const uploadManager = new CascadingDropdownManager({
            curriculum: 'input-curriculum',
            subject: 'input-subject',
            year: 'input-year',
            month: 'input-month', // Be careful with conflict
            tag_category: 'input-tag-category', // Topic
            tag_name: 'input-tag-name' // Sub-topic
        });
        window.uploadManager = uploadManager; // Global access
        // Upload inputs have defaults (A-Level, Math), so this is CRITICAL.
        uploadManager.refreshAll();

        // Edit Manager
        const editManager = new CascadingDropdownManager({
            curriculum: 'edit-curriculum',
            subject: 'edit-subject',
            year: 'edit-year',
            month: 'edit-month',
            tag_category: 'edit-tag-category',
            tag_name: 'edit-tag-name'
        });
        window.editManager = editManager; // Global access

        // "Create New" Handlers for Edit Modal
        handleNewInput('edit-tag-category', 'new-edit-tag-category');
        handleNewInput('edit-tag-name', 'new-edit-tag-name');
        handleNewInput('edit-curriculum', 'new-edit-curriculum');
        handleNewInput('edit-subject', 'new-edit-subject');

        // Initial Load
        // loadQuestions(); // Disabled: User must explicitly search
        // Check basket state
        updateBasketUI();

    } catch (e) {
        console.error("Critical Error during initialization:", e);
        alert("App Initialization Failed: " + e.message);
    }
});

window.openEditQuestionModalById = (event, id) => {
    // 1. Prevent Default Behavior explicitly
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // console.log('Edit clicked for ID:', id);

    if (!window.currentManagedQuestions) {
        console.error("Error: Cache empty");
        return;
    }

    const q = window.currentManagedQuestions.find(item => item.id === id);
    if (!q) {
        console.error("Error: Question not found");
        return;
    }

    // 2. Lazy Initialization of editManager if missing
    if (!window.editManager) {
        console.warn("editManager missing, attempting lazy initialization...");
        try {
            window.editManager = new CascadingDropdownManager({
                curriculum: 'edit-curriculum',
                subject: 'edit-subject',
                year: 'edit-year',
                month: 'edit-month',
                tag_category: 'edit-tag-category',
                tag_name: 'edit-tag-name'
            });
            // Also init "Create New" handlers if needed, though they might be duplicate
            handleNewInput('edit-tag-category', 'new-edit-tag-category');
            handleNewInput('edit-tag-name', 'new-edit-tag-name');
        } catch (e) {
            console.error("Lazy init failed:", e);
            alert("System Error: Could not initialize editor. " + e.message);
            return;
        }
    }

    if (window.editManager) {
        window.openEditQuestionModal(q).catch(err => {
            console.error("Error in openEditQuestionModal:", err);
            alert("Error opening modal: " + err.message);
        });
    }
};

window.openEditQuestionModal = async (q) => {
    // Populate fields

    document.getElementById('edit-question-id').value = q.id;

    document.getElementById('edit-curriculum').value = q.curriculum || 'A-Level';

    // Trigger updates sequence for edit modal
    // Note: Curriculum -> Subject -> Topic -> Subtopic
    // We assume default Subject is Math if not present, but updateOptions reads current value.

    // 1. Update Subject options (if curriculum changed)

    try {
        await window.editManager.updateOptions('subject');
    } catch (e) { console.error(e); }


    document.getElementById('edit-subject').value = q.subject || 'Math';

    // 2. Set Year/Month

    document.getElementById('edit-year').value = q.year || '';

    // 3. Trigger Month Updated

    await window.editManager.updateOptions('month');

    document.getElementById('edit-month').value = q.month || '';

    // 3.5 Trigger Paper Update - REMOVED but checking if safe
    // console.log("DEBUG: openEditQuestionModal Step 8 (Update Paper)");
    // await window.editManager.updateOptions('paper'); 

    // 4. Populate Tags

    document.getElementById('edit-difficulty').value = q.difficulty || 'Medium';

    document.getElementById('edit-qno').value = q.question_number || '';

    // 3. Populate Topic (Category)

    try {
        await window.editManager.updateOptions('tag_category');
    } catch (e) {
        console.error("Error fetching categories:", e);
    }

    const tagCategoryInput = document.getElementById('edit-tag-category');
    const tagNameInput = document.getElementById('edit-tag-name');
    const newTagCategoryInput = document.getElementById('new-edit-tag-category');
    const newTagNameInput = document.getElementById('new-edit-tag-name');

    // Reset "Create New" inputs
    newTagCategoryInput.hidden = true;
    newTagNameInput.hidden = true;

    if (q.tags && q.tags.length > 0) {
        const cat = q.tags[0].category;
        const name = q.tags[0].name;

        // Set Category
        tagCategoryInput.value = cat || '';

        // 4. Populate Sub-topic (Name)
        await window.editManager.updateOptions('tag_name'); // Fetches based on current Category

        tagNameInput.value = name || '';
    } else {
        tagCategoryInput.value = '';
        // Clear subtopics if no category
        await window.editManager.updateOptions('tag_name');
        tagNameInput.value = '';
    }

    modalEditQuestion.hidden = false;
};



if (btnCancelQuestion) {
    btnCancelQuestion.addEventListener('click', () => {
        modalEditQuestion.hidden = true;
    });
}

if (btnSaveQuestion) {
    btnSaveQuestion.addEventListener('click', async () => {
        const id = document.getElementById('edit-question-id').value;
        let curriculum = document.getElementById('edit-curriculum').value;
        if (curriculum === '__new__') {
            curriculum = document.getElementById('new-edit-curriculum').value;
        }

        let subject = document.getElementById('edit-subject').value;
        if (subject === '__new__') {
            subject = document.getElementById('new-edit-subject').value;
        }
        const year = document.getElementById('edit-year').value;
        const month = document.getElementById('edit-month').value;
        const difficulty = document.getElementById('edit-difficulty').value;
        const qno = document.getElementById('edit-qno').value;

        let tagCategory = document.getElementById('edit-tag-category').value;
        if (tagCategory === '__new__') {
            tagCategory = document.getElementById('new-edit-tag-category').value;
        }

        let tagName = document.getElementById('edit-tag-name').value;
        if (tagName === '__new__') {
            tagName = document.getElementById('new-edit-tag-name').value;
        }

        // Construct update data
        const updateData = {
            curriculum,
            subject,
            year: year ? parseInt(year) : null,
            month,
            difficulty,
            question_number: qno
        };

        // Add tags only if both fields are present (or clear them if empty?)
        // Strategy: If user inputs tags, send them. If cleared, send empty list?
        // Let's assume user wants to set this specific tag.
        if (tagCategory && tagName) {
            updateData.tags = [{ category: tagCategory, name: tagName }];
        } else if (!tagCategory && !tagName) {
            // If both are empty, maybe user wants to clear them?
            // Let's explicitly send empty list to clear if intended
            updateData.tags = [];
        }
        // If partial input (one empty), maybe don't update tags to avoid accidental clear or error?
        // Or better: require both if either is set.
        // For now, let's go with: if specified, replace. If both empty, clear.

        try {
            const response = await authFetch(`${API_BASE_URL}/questions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                modalEditQuestion.hidden = true;
                loadManageView(); // Reload list

                // Refresh other views to pick up new Tags
                if (window.filterManager) window.filterManager.updateOptions('tag_category');
                if (window.uploadManager) window.uploadManager.updateOptions('tag_category');
            } else {
                alert('Failed to update question');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating question');
        }
    });
}
