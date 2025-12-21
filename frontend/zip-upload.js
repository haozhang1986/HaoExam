
// --- ZIP Upload Logic ---
(function initZipUpload() {
    const dropZone = document.getElementById('zip-drop-zone');
    const fileInput = document.getElementById('zip-file-input');
    const fileName = document.getElementById('zip-file-name');
    const uploadBtn = document.getElementById('btn-upload-zip');
    const progressContainer = document.getElementById('zip-progress-container');
    const progressBar = document.getElementById('zip-progress-bar');
    const progressText = document.getElementById('zip-progress-text');
    const resultsDiv = document.getElementById('zip-results');
    const resultsContent = document.getElementById('zip-results-content');

    let selectedFile = null;

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3b82f6';
        dropZone.style.background = '#eff6ff';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        dropZone.style.background = '#f8fafc';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        dropZone.style.background = '#f8fafc';

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.zip')) {
            handleFileSelected(files[0]);
        } else {
            alert('Please drop a ZIP file');
        }
    });

    // Click to select
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
        }
    });

    function handleFileSelected(file) {
        selectedFile = file;
        fileName.textContent = `📦 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        uploadBtn.disabled = false;

        // Reset previous results
        resultsDiv.style.display = 'none';
        progressContainer.style.display = 'none';
    }

    // Upload button handler
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Show progress
        progressContainer.style.display = 'block';
        resultsDiv.style.display = 'none';
        uploadBtn.disabled = true;
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressText.textContent = 'Uploading...';

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Simulate progress (since fetch doesn't support upload progress easily)
            let progress = 0;
            const progressInterval = setInterval(() => {
                if (progress < 90) {
                    progress += 10;
                    progressBar.style.width = progress + '%';
                    progressBar.textContent = progress + '%';
                }
            }, 200);

            const response = await authFetch(`${API_BASE_URL}/api/v1/ingest/zip`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressBar.textContent = '100%';
            progressText.textContent = 'Processing...';

            if (response.ok) {
                const result = await response.json();

                // Show results
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    resultsDiv.style.display = 'block';

                    resultsContent.innerHTML = `
                        <div style="display: grid; gap: 1rem;">
                            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f0fdf4; border-radius: 0.5rem;">
                                <div style="font-size: 2rem;">✅</div>
                                <div>
                                    <div style="font-weight: 600; color: #15803d;">Import Successful!</div>
                                    <div style="color: #16a34a; font-size: 0.875rem;">${result.message || 'Data imported successfully'}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Questions Created</div>
                                    <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${result.stats?.created || 0}</div>
                                </div>
                                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Tags Created</div>
                                    <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${result.stats?.tags_created || 0}</div>
                                </div>
                                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Errors</div>
                                    <div style="font-size: 2rem; font-weight: 700; color: ${result.stats?.errors > 0 ? '#ef4444' : '#10b981'}">${result.stats?.errors || 0}</div>
                                </div>
                                <div style="padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Processed</div>
                                    <div style="font-size: 2rem; font-weight: 700; color: #1e293b;">${result.stats?.total_questions || 0}</div>
                                </div>
                            </div>

                            <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">
                                View Questions
                            </button>
                        </div>
                    `;

                    // Reset for next upload
                    selectedFile = null;
                    fileName.textContent = '';
                    fileInput.value = '';
                    uploadBtn.disabled = true;
                }, 500);
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            progressContainer.style.display = 'none';
            resultsDiv.style.display = 'block';
            resultsContent.innerHTML = `
                <div style="padding: 1.5rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">❌</div>
                    <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem;">Upload Failed</div>
                    <div style="color: #dc2626; font-size: 0.875rem;">${error.message}</div>
                    <button onclick="document.getElementById('zip-results').style.display='none'" class="btn-secondary" style="margin-top: 1rem;">
                        Try Again
                    </button>
                </div>
            `;
            uploadBtn.disabled = false;
        }
    });
})();
