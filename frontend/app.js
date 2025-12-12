let API_BASE_URL = window.location.origin;
if (API_BASE_URL === 'null' || API_BASE_URL.startsWith('file:')) {
    API_BASE_URL = 'http://127.0.0.1:8000';
}

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

// DOM Elements
const galleryGrid = document.getElementById('gallery-grid');
const basketCount = document.getElementById('basket-count');
const btnSafePdf = document.getElementById('btn-safe-pdf');
const btnGeneratePdf = btnSafePdf; // Alias for compatibility
const btnShowQuestions = document.getElementById('btn-show-questions');
const chkIncludeAnswers = document.getElementById('chk-include-answers');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadFilters();
    updateBasketUI();
    uploadManager.refreshAll();

    // Edit Manager
    const editManager = new CascadingDropdownManager({
        curriculum: 'edit-curriculum',
        subject: 'edit-subject',
        year: 'edit-year',
        month: 'edit-month',
        paper: 'edit-paper',
        tagCategory: 'edit-tag-category',
        tagName: 'edit-tag-name'
    });
    // We don't refreshAll immediately for edit because it depends on the opened question
    window.editManager = editManager; // Global access for modal opening

    // "Create New" Handlers for Edit Modal
    handleNewInput('edit-tag-category', 'new-edit-tag-category');
    handleNewInput('edit-tag-name', 'new-edit-tag-name');

    // Initial Load
    loadQuestions();
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

        // Load Papers
        const paperResponse = await fetch(`${API_BASE_URL}/papers/`);
        const papers = await paperResponse.json();
        const paperSelect = document.getElementById('filter-paper');
        if (paperSelect) {
            paperSelect.innerHTML = '<option value="">All</option>';
            papers.forEach(p => {
                const option = document.createElement('option');
                option.value = p;
                option.textContent = p;
                paperSelect.appendChild(option);
            });
        }

        // Load Tags
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
    return {
        curriculum: document.getElementById('filter-curriculum').value,
        subject: document.getElementById('filter-subject').value,
        year: document.getElementById('filter-year') ? document.getElementById('filter-year').value : '',
        month: document.getElementById('filter-month').value,
        paper: document.getElementById('filter-paper') ? document.getElementById('filter-paper').value : '',
        difficulty: document.getElementById('filter-difficulty').value,
        tag_category: document.getElementById('filter-tag-category').value,
        tag_name: document.getElementById('filter-tag-name').value
    };
}

// Manual Search Trigger
// Added debug for filter verification
const btnResetFilters = document.getElementById('btn-reset-filters');
if (btnResetFilters) {
    btnResetFilters.addEventListener('click', async () => {
        // 1. Clear all Select inputs in filters section
        const filtersDiv = document.querySelector('.filters-section');
        if (filtersDiv) {
            const selects = filtersDiv.querySelectorAll('select');
            selects.forEach(s => s.value = "");
        }

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

btnShowQuestions.addEventListener('click', () => {
    currentFilters = getFilters();

    // Check which view is active
    if (document.getElementById('view-manage').classList.contains('active')) {
        loadManageView();
    } else {
        loadQuestions();
    }
});

// --- Gallery Logic ---
async function loadQuestions() {
    galleryGrid.innerHTML = '<div class="loading-state">Loading questions...</div>';

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentFilters)) {
        if (value) params.append(key, value);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/questions/?${params.toString()}`);
        const questions = await response.json();

        galleryGrid.innerHTML = '';

        if (questions.length === 0) {
            galleryGrid.innerHTML = '<div class="loading-state">No questions found matching your filters.</div>';
            return;
        }

        questions.forEach(q => {
            const card = createQuestionCard(q);
            galleryGrid.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading questions:", e);
        galleryGrid.innerHTML = `
            <div class="loading-state" style="color: red; text-align: left; white-space: pre-wrap;">
                Error loading questions. 
                Debug Info:
                ${e.message}
                API: ${API_BASE_URL}
            </div>`;
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-card';

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

    // Format tags: "Topic: Sub-topic"
    const tagBadges = uniqueTags.map(tag =>
        `<span class="tag">${tag.category}: ${tag.name}</span>`
    ).join('');

    card.innerHTML = `
        <div class="card-img">
            <img src="${API_BASE_URL}/${question.question_image_path}" loading="lazy" alt="Question ${question.id}">
        </div>
        <div class="card-body">
            <div class="card-tags">
                ${tagBadges}
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <button class="btn-primary" style="flex: 1; background-color: #6366f1; font-size: 0.875rem;" onclick="viewAnswer('${question.answer_image_path}')">
                    Show Answer
                </button>
                <button class="btn-basket ${isSelected ? 'selected' : ''}" style="flex: 1; font-size: 0.875rem;" 
                        onclick="toggleBasket(${question.id}, this)">
                    ${isSelected ? 'Remove' : 'Add to Basket'}
                </button>
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

            // 2. Calculate Filename EARLY (for URL construction)
            let filename = "HaoExam_Worksheet.pdf";
            try {
                const topicEl = document.getElementById('filter-tag-category');
                const subtopicEl = document.getElementById('filter-tag-name');
                const topic = topicEl ? topicEl.value : "";
                const subtopic = subtopicEl ? subtopicEl.value : "";

                const sanitize = (str) => (str || "").replace(/[\\/:*?"<>|]/g, '_');
                const today = new Date().toISOString().split('T')[0];

                if (topic && subtopic) {
                    filename = `${today}_${sanitize(topic)}_${sanitize(subtopic)}.pdf`;
                } else if (topic) {
                    filename = `${today}_${sanitize(topic)}.pdf`;
                } else {
                    filename = `${today}_HaoExam_Worksheet.pdf`;
                }
            } catch (err) {
                console.error("Filename generation error:", err);
            }

            // 3. Request Static Link (The "Physical Rename" Strategy)
            document.getElementById('pdf-status').textContent = "Preparing secure download link...";

            try {
                const linkResponse = await fetch(`${API_BASE_URL}/worksheet/prepare-download/${data.file_id}?name=${encodeURIComponent(filename)}`);
                if (!linkResponse.ok) throw new Error("Failed to prepare download link");

                const linkData = await linkResponse.json();

                if (!linkData.url) throw new Error("No URL returned");

                let finalUrl = linkData.url;
                // Ensure absolute URL if API_BASE_URL is defined
                if (finalUrl.startsWith('/') && API_BASE_URL) {
                    finalUrl = API_BASE_URL.replace(/\/$/, '') + finalUrl;
                }

                const a = document.createElement('a');

                // Auto-Download Strategy (Restored)
                const oldLink = document.getElementById('manual-pdf-link');
                if (oldLink) oldLink.remove();

                a.href = finalUrl;
                a.download = filename;
                a.target = "_blank";
                a.style.display = 'none'; // Hidden

                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                }, 1000);

                // Success Message (Simple)
                document.getElementById('pdf-status').textContent = "Download started!";
                document.getElementById('pdf-status').style.color = "green";
            } catch (linkErr) {
                console.error(linkErr);
                document.getElementById('pdf-status').textContent = "Link Error: " + linkErr.message;
                document.getElementById('pdf-status').style.color = "red";
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


// Handle "Create New" selection
function handleNewInput(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);

    select.addEventListener('change', () => {
        if (select.value === '__new__') {
            input.hidden = false;
            input.focus();
        } else {
            input.hidden = true;
        }
    });
}

handleNewInput('input-tag-category', 'new-tag-category');
handleNewInput('input-tag-name', 'new-tag-name');
handleNewInput('input-curriculum', 'new-curriculum');
handleNewInput('input-subject', 'new-subject');
handleNewInput('input-paper', 'new-paper');

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
handleNewInput('input-paper', 'new-paper');
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

        let paper = document.getElementById('input-paper').value;
        if (paper === '__new__') paper = document.getElementById('new-paper').value;

        let year = document.getElementById('input-year').value;
        if (year === '__new__') year = document.getElementById('new-year').value;

        formData.append('curriculum', curriculum);
        formData.append('subject', subject);
        formData.append('year', year);
        formData.append('month', document.getElementById('input-month').value);
        formData.append('paper', paper);
        formData.append('difficulty', document.getElementById('input-difficulty').value);
        formData.append('question_number', document.getElementById('input-qno').value);

        if (tagCategory) formData.append('tag_category', tagCategory);
        if (tagName) formData.append('tag_name', tagName);

        const response = await fetch(`${API_BASE_URL}/questions/`, {
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
                if (value) params.append(key, value);
            }
        }

        let url = `${API_BASE_URL}/questions/?${params.toString()}`;
        if (!params.toString()) {
            url += 'limit=50'; // Default if no filter
        }

        const response = await fetch(url);
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
        console.log("Delete popup requested for ID:", id);

        questionToDeleteId = id;
        modalConfirmDelete.hidden = false;
    }
});

async function deleteQuestion(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
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
            const response = await fetch(`${API_BASE_URL}/tags/${id}`, {
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
        const { curriculum, subject, year, month, paper, tag_category, tag_name } = this.config;

        this.attachListener(curriculum, () => this.updateOptions('subject'));
        this.attachListener(subject, () => {
            this.updateOptions('year');
            this.updateOptions('tag_category'); // Topic depends on Subject
        });
        this.attachListener(year, () => this.updateOptions('month'));
        // Month updates might affect Paper if strictly hierarchical, or just filter
        this.attachListener(month, () => this.updateOptions('paper'));
        this.attachListener(tag_category, () => this.updateOptions('tag_name'));
    }

    attachListener(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', callback);
        }
    }

    async updateOptions(targetField) {
        const targetIdMap = {
            'subject': this.config.subject,
            'year': this.config.year,
            'month': this.config.month,
            'paper': this.config.paper,
            'tag_category': this.config.tag_category,
            'tag_name': this.config.tag_name
        };

        const targetId = targetIdMap[targetField];
        if (!targetId) {
            return;
        }

        // Build query params from current values
        const params = new URLSearchParams();
        const { curriculum, subject, year, month, paper, tag_category } = this.config;

        const addParam = (key, id) => {
            const el = document.getElementById(id);
            if (el && el.value && el.value !== '__new__') {
                params.append(key, el.value);
            }
        };

        // Hierarchy assumption: simpler fields depend on broader ones
        addParam('curriculum', curriculum);
        if (targetField !== 'subject') addParam('subject', subject);

        // Time filters apply to Papers, but NOT to Tags (Taxonomy is global)
        const isTagUpdate = targetField === 'tag_category' || targetField === 'tag_name';

        if (!isTagUpdate) {
            if (targetField !== 'year') addParam('year', year);

            if (targetField === 'paper') {
                addParam('month', month);
            }
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
                // If fetch fails (e.g. 404 or 500), still populate to show "Create New" option
                console.warn(`Fetch failed for ${targetField}, defaulting to empty list.`);
                this.populateDropdown(targetId, []);
            }
        } catch (e) {
            console.error(`Error updating ${targetField}`, e);
            // Ensure dropdown is populated (empty) so "Create New" appears
            this.populateDropdown(targetId, []);
        }
    }

    populateDropdown(elementId, values) {
        // Trace 3
        const select = document.getElementById(elementId);
        if (!select) return;

        // Treat both 'input-' (upload) and 'edit-' (edit modal) as forms needing "Create New"
        const isUpload = elementId.startsWith('input-') || elementId.startsWith('edit-');
        const currentValue = select.value;

        let optionsHtml = '';

        if (isUpload) {
            optionsHtml += '<option value="">Select...</option>';
            optionsHtml += '<option value="__new__">+ Create New</option>';
        } else {
            optionsHtml += '<option value="">All</option>';
        }

        if (Array.isArray(values)) {
            values.forEach(val => {
                optionsHtml += `<option value="${val}">${val}</option>`;
            });
        }

        select.innerHTML = optionsHtml;

        // Restore value if possible
        if (values && (values.includes(currentValue) || values.includes(parseInt(currentValue)))) {
            select.value = currentValue;
        }
    }


    // Trigger initial updates based on default values
    refreshAll() {
        const { curriculum, subject, year, month, paper, tag_category, tag_name } = this.config;

        // Trigger updates in order of hierarchy
        if (curriculum) this.updateOptions('subject');
        if (subject) {
            this.updateOptions('year');
            this.updateOptions('tag_category');
        }
        if (year) this.updateOptions('month');
        if (month) this.updateOptions('paper');
        if (tag_category) this.updateOptions('tag_name');
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
            paper: 'filter-paper',
            tag_category: 'filter-tag-category',
            tag_name: 'filter-tag-name'
        });
        window.filterManager = filterManager; // Global access
        filterManager.refreshAll();

        // Upload Manager
        // Note: input-month logic is currently custom (seasonal). 
        // We might override it or integrate it. For now, let's focus on Subject/Topic chains.
        const uploadManager = new CascadingDropdownManager({
            curriculum: 'input-curriculum',
            subject: 'input-subject',
            year: 'input-year',
            month: 'input-month', // Be careful with conflict
            paper: 'input-paper',
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
            paper: 'edit-paper',
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
                paper: 'edit-paper',
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

    // 2. Set Year/Month/Paper
    document.getElementById('edit-year').value = q.year || '';

    // Month depends on Year? In filter yes. In edit... not strictly enforced by API but UI might need it.
    // Our CascadingDropdownManager links year -> month.
    // But month list is static? No, updateMonthOptions.
    // Let's manually trigger month options using existing helper
    updateMonthOptions('edit-curriculum', 'edit-month');
    document.getElementById('edit-month').value = q.month || '';

    document.getElementById('edit-paper').value = q.paper || '';
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
        const paper = document.getElementById('edit-paper').value;
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
            paper,
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
            const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
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
