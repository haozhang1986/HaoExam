const API_BASE_URL = 'http://localhost:8000';

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
const btnGeneratePdf = document.getElementById('btn-generate-pdf');
const btnShowQuestions = document.getElementById('btn-show-questions');
const chkIncludeAnswers = document.getElementById('chk-include-answers');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadFilters();
    updateBasketUI();

    // Initial load of questions is now manual via "Show Questions" button
    // loadQuestions(); 
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
        year: document.getElementById('filter-year') ? document.getElementById('filter-year').value : '', // Year filter removed from UI but kept in logic just in case
        month: document.getElementById('filter-month').value,
        difficulty: document.getElementById('filter-difficulty').value,
        tag_category: document.getElementById('filter-tag-category').value,
        tag_name: document.getElementById('filter-tag-name').value
    };
}

// Manual Search Trigger
btnShowQuestions.addEventListener('click', () => {
    currentFilters = getFilters();
    loadQuestions();
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
        galleryGrid.innerHTML = '<div class="loading-state" style="color: red;">Error loading questions. Please try again.</div>';
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-card';

    const isSelected = basket.has(question.id);

    // Format tags: "Topic: Sub-topic"
    const tagBadges = question.tags.map(tag =>
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
            <button class="btn-basket ${isSelected ? 'selected' : ''}" 
                    onclick="toggleBasket(${question.id}, this)">
                ${isSelected ? 'Remove from Basket' : 'Add to Basket'}
            </button>
        </div>
    `;

    return card;
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
    btnGeneratePdf.disabled = basket.size === 0;
}

btnGeneratePdf.addEventListener('click', async () => {
    if (basket.size === 0) return;

    const includeAnswers = chkIncludeAnswers.checked;

    btnGeneratePdf.disabled = true;
    btnGeneratePdf.textContent = 'Generating...';

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
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Dynamic filename
            let filename = "worksheet.pdf";
            const topic = document.getElementById('filter-tag-category').value;
            const subtopic = document.getElementById('filter-tag-name').value;

            if (topic && subtopic) {
                filename = `${topic} - ${subtopic} Practice.pdf`;
            } else if (topic) {
                filename = `${topic} Practice.pdf`;
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            alert('Failed to generate PDF');
        }
    } catch (e) {
        console.error(e);
        alert('Error generating PDF');
    } finally {
        btnGeneratePdf.disabled = false;
        btnGeneratePdf.textContent = 'Generate PDF';
    }
});

// --- Upload Logic ---
// Image Paste Handling
function handlePaste(e, previewContainerId, clearBtnId) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const container = document.getElementById(previewContainerId);
    const clearBtn = document.getElementById(clearBtnId);

    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            const reader = new FileReader();

            reader.onload = function (event) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'preview-img-container';

                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'preview-img';

                imgContainer.appendChild(img);

                // Insert before the placeholder (which is the first child usually, or we append)
                // Actually, we want to append to the container but keep placeholder at bottom? 
                // CSS handles placeholder position. Let's just append.
                container.appendChild(imgContainer);

                // Hide placeholder text if needed, or just let it sit there.
                // Better: Hide placeholder content if images exist?
                // For now, just append.

                clearBtn.hidden = false;
            };

            reader.readAsDataURL(blob);
        }
    }
}

document.getElementById('upload-box-q').addEventListener('paste', (e) => handlePaste(e, 'upload-box-q', 'clear-q'));
document.getElementById('upload-box-a').addEventListener('paste', (e) => handlePaste(e, 'upload-box-a', 'clear-a'));

// Clear Buttons
function clearImages(containerId, clearBtnId) {
    const container = document.getElementById(containerId);
    // Remove all .preview-img-container
    const images = container.querySelectorAll('.preview-img-container');
    images.forEach(img => img.remove());
    document.getElementById(clearBtnId).hidden = true;
}

document.getElementById('clear-q').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering upload box click
    clearImages('upload-box-q', 'clear-q');
});

document.getElementById('clear-a').addEventListener('click', (e) => {
    e.stopPropagation();
    clearImages('upload-box-a', 'clear-a');
});

// Dynamic Tag Loading for Upload Form
async function loadUploadTags() {
    try {
        const response = await fetch(`${API_BASE_URL}/tags/`);
        const tags = await response.json();

        const categorySelect = document.getElementById('input-tag-category');
        const nameSelect = document.getElementById('input-tag-name');

        // Keep "Select or Type..." and add options
        // We need to handle "Create New" logic.
        // Let's simplify: Just show existing options. User can type new ones if we convert to datalist or handle "Other"

        // Current implementation: Select + "Create New" option
        categorySelect.innerHTML = '<option value="">Select...</option>';
        nameSelect.innerHTML = '<option value="">Select...</option>';

        const categories = new Set(tags.map(t => t.category));
        const names = new Set(tags.map(t => t.name));

        categories.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            categorySelect.appendChild(option);
        });
        categorySelect.innerHTML += '<option value="__new__">+ Create New</option>';

        names.forEach(n => {
            const option = document.createElement('option');
            option.value = n;
            option.textContent = n;
            nameSelect.appendChild(option);
        });
        nameSelect.innerHTML += '<option value="__new__">+ Create New</option>';

    } catch (e) {
        console.error("Error loading tags for upload:", e);
    }
}

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

loadUploadTags(); // Load on startup

// Submit Upload
document.getElementById('btn-submit-upload').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit-upload');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const formData = new FormData();

        // Get Images (convert base64/blob from preview back to file or just use what we have?)
        // The paste event gives us access to files, but we didn't store them.
        // We need to store the files when pasted.
        // Let's refactor paste handling to store files in an array.

        // REFACTOR: We need to capture the actual File objects.
        // For this prototype, let's assume the user pastes images and we can't easily get the File object back from DOM <img> src if it's base64.
        // Actually, we can convert base64 to blob.

        async function appendImagesFromContainer(containerId, fieldName) {
            const container = document.getElementById(containerId);
            const imgs = container.querySelectorAll('img');

            for (let i = 0; i < imgs.length; i++) {
                const src = imgs[i].src;
                const res = await fetch(src);
                const blob = await res.blob();
                formData.append(fieldName, blob, `image_${i}.png`);
            }
        }

        await appendImagesFromContainer('upload-box-q', 'question_images');
        await appendImagesFromContainer('upload-box-a', 'answer_images');

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

        formData.append('curriculum', curriculum);
        formData.append('subject', subject);
        formData.append('year', document.getElementById('input-year').value);
        formData.append('month', document.getElementById('input-month').value);
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

            // Clear Form but keep some fields (Curriculum, Subject, Year) for easier bulk upload
            clearImages('upload-box-q', 'clear-q');
            clearImages('upload-box-a', 'clear-a');
            document.getElementById('input-qno').value = '';

            // Reset Tag inputs
            document.getElementById('input-tag-category').value = '';
            document.getElementById('new-tag-category').hidden = true;
            document.getElementById('new-tag-category').value = '';

            document.getElementById('input-tag-name').value = '';
            document.getElementById('new-tag-name').hidden = true;
            document.getElementById('new-tag-name').value = '';

            // Refresh filters and tags
            loadFilters();
            loadUploadTags();
        } else {
            alert('Upload failed!');
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
        const response = await fetch(`${API_BASE_URL}/questions/?limit=50`); // Fetch recent 50
        const questions = await response.json();

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
                <td><img src="${API_BASE_URL}/${q.question_image_path}" loading="lazy"></td>
                <td>
                    <div><strong>${q.curriculum} ${q.subject}</strong></div>
                    <div style="font-size: 0.875rem; color: #6b7280;">${q.year} ${q.month || ''} - Q${q.question_number || '?'}</div>
                </td>
                <td>${tags}</td>
                <td>
                    <button class="btn-delete-action" style="background-color: #e0f2fe; color: #0284c7; margin-right: 0.5rem;" onclick='openEditQuestionModal(${JSON.stringify(q)})'>Edit</button>
                    <button class="btn-delete-action" onclick="confirmDelete(${q.id})">Delete</button>
                </td>
            `;
            grid.appendChild(row);
        });
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading questions.</td></tr>';
    }
}

window.confirmDelete = async (id) => {
    if (confirm('Are you sure you want to delete this question? This cannot be undone.')) {
        await deleteQuestion(id);
    }
};

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

window.confirmDeleteTag = async (id) => {
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

window.openEditQuestionModal = (q) => {
    // Populate fields
    document.getElementById('edit-question-id').value = q.id;
    document.getElementById('edit-curriculum').value = q.curriculum || 'A-Level';
    document.getElementById('edit-subject').value = q.subject || 'Math';
    document.getElementById('edit-year').value = q.year || '';
    document.getElementById('edit-month').value = q.month || '';
    document.getElementById('edit-difficulty').value = q.difficulty || 'Medium';
    document.getElementById('edit-qno').value = q.question_number || '';

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
        const updateData = {
            curriculum: document.getElementById('edit-curriculum').value,
            subject: document.getElementById('edit-subject').value,
            year: document.getElementById('edit-year').value,
            month: document.getElementById('edit-month').value,
            difficulty: document.getElementById('edit-difficulty').value,
            question_number: document.getElementById('edit-qno').value
        };

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
                loadFilters(); // Reload filters (in case subject/curriculum changed)
            } else {
                alert('Failed to update question');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating question');
        }
    });
}
