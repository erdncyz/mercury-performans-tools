// Prevent React DevTools errors
if (typeof window !== 'undefined') {
    window.addEventListener('error', function(e) {
        if (e.message && e.message.includes('React')) {
            e.preventDefault();
            return false;
        }
    });
}

// Global variables
let selectedBrowser = 'chrome';
let currentAnalysis = null;
let analysisInterval = null;

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Browser selection buttons
    document.querySelectorAll('.browser-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const browser = this.getAttribute('data-browser');
            selectBrowser(browser);
        });
    });

    // URL input enter key
    const urlInput = document.getElementById('web-url');
    if (urlInput) {
        urlInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                startBrowserAnalysis();
            }
        });
    }

    // Start analysis button
    const startBtn = document.getElementById('start-analysis-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startBrowserAnalysis);
    }

    // Stop analysis button
    const stopBtn = document.getElementById('stop-analysis-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopAnalysis);
    }

    console.log('Event listeners initialized');
});

// Browser selection
function selectBrowser(browser) {
    selectedBrowser = browser;
    
    // Update active button
    document.querySelectorAll('.browser-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-browser="${browser}"]`).classList.add('active');
    
    console.log('Selected browser:', browser);
}

// Start browser analysis
function startBrowserAnalysis() {
    const url = document.getElementById('web-url').value.trim();
    
    if (!url) {
        showErrorModal('Please enter a URL!');
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showErrorModal('Please enter a valid URL (must start with http:// or https://)!');
        return;
    }
    
    console.log('=== Starting Browser Analysis ===');
    console.log('Browser:', selectedBrowser);
    console.log('URL:', url);
    
    // Show analysis status
    document.getElementById('analysis-status').style.display = 'block';
    document.getElementById('analysis-message').textContent = `Opening ${selectedBrowser} browser...`;
    
    // Start analysis via API
    fetch('/api/web/browser/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            browser: selectedBrowser
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentAnalysis = data.sessionId;
            document.getElementById('analysis-message').textContent = `${selectedBrowser} browser opened! You can start browsing the site.`;
            document.getElementById('analysis-session-info').textContent = `Session ID: ${data.sessionId}\nURL: ${url}\nBrowser: ${selectedBrowser}`;
            
            // Start progress animation
            startProgressAnimation();
            
            // Start monitoring
            startAnalysisMonitoring();
        } else {
            document.getElementById('analysis-message').textContent = `Error: ${data.message}`;
        }
    })
    .catch(error => {
        console.error('Analysis start error:', error);
        document.getElementById('analysis-message').textContent = 'Error occurred while starting analysis!';
    });
};

// Stop analysis
function stopAnalysis() {
    if (!currentAnalysis) return;
    
    console.log('=== Stopping Analysis ===');
    
    // Show loading state
    document.getElementById('analysis-message').textContent = 'Stopping analysis and generating report...';
    document.getElementById('stop-analysis-btn').disabled = true;
    document.getElementById('stop-analysis-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.add('show');
    
    // Helper function to hide loading overlay and reset button
    const hideLoadingAndReset = () => {
        clearTimeout(loadingTimeout);
        loadingOverlay.classList.remove('show');
        document.getElementById('stop-analysis-btn').disabled = false;
        document.getElementById('stop-analysis-btn').innerHTML = '<i class="fas fa-stop"></i> Stop Analysis';
    };
    
    // Set a timeout to ensure loading overlay doesn't get stuck
    const loadingTimeout = setTimeout(() => {
        console.log('Loading timeout reached, hiding overlay');
        hideLoadingAndReset();
    }, 15000); // 15 seconds timeout
    
    fetch('/api/web/browser/stop', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sessionId: currentAnalysis
        })
    })
    .then(response => response.json())
    .then(data => {
        // Hide loading overlay and reset button
        hideLoadingAndReset();
        
        if (data.success) {
            document.getElementById('analysis-message').textContent = 'Analysis completed! Report ready.';
            
            // Use report data directly
            const reportData = data.data;
            if (reportData) {
                // Show detailed analysis results
                const navigationEvents = reportData.metrics.navigationEvents || [];
                const resourceTiming = reportData.metrics.resourceTiming || [];
                const errors = reportData.metrics.errors || [];
                const performanceMetrics = reportData.metrics.performanceMetrics || {};
                
                // Analyze resource types
                const resourceTypes = {};
                resourceTiming.forEach(resource => {
                    const type = getResourceType(resource.url);
                    resourceTypes[type] = (resourceTypes[type] || 0) + 1;
                });
                
                // Analyze error types
                const errorTypes = {};
                errors.forEach(error => {
                    const type = error.type || 'unknown';
                    errorTypes[type] = (errorTypes[type] || 0) + 1;
                });
                
                document.getElementById('analysis-session-info').innerHTML = `
                    <div class="analysis-results">
                        <div class="results-header">
                            <h4><i class="fas fa-chart-bar"></i> Analysis Results</h4>
                        </div>
                        
                        <div class="results-grid">
                            <div class="result-card">
                                <div class="result-title">📄 Page Analysis</div>
                                <div class="result-value">${navigationEvents.length} pages visited</div>
                                ${navigationEvents.length > 0 ? `
                                    <div class="result-details">
                                        ${navigationEvents.slice(0, 3).map(event => `
                                            <div class="detail-item">• ${event.url || 'Unknown URL'}</div>
                                        `).join('')}
                                        ${navigationEvents.length > 3 ? `<div class="detail-item">... and ${navigationEvents.length - 3} more pages</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">🔧 Resource Analysis</div>
                                <div class="result-value">${resourceTiming.length} resources loaded</div>
                                ${Object.keys(resourceTypes).length > 0 ? `
                                    <div class="result-details">
                                        ${Object.entries(resourceTypes).slice(0, 3).map(([type, count]) => `
                                            <div class="detail-item">• ${type}: ${count}</div>
                                        `).join('')}
                                        ${Object.keys(resourceTypes).length > 3 ? `<div class="detail-item">... and ${Object.keys(resourceTypes).length - 3} more types</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">⚠️ Error Analysis</div>
                                <div class="result-value ${errors.length > 0 ? 'error' : 'success'}">${errors.length} errors found</div>
                                ${errors.length > 0 ? `
                                    <div class="result-details">
                                        ${Object.entries(errorTypes).slice(0, 2).map(([type, count]) => `
                                            <div class="detail-item">• ${type}: ${count}</div>
                                        `).join('')}
                                        ${Object.keys(errorTypes).length > 2 ? `<div class="detail-item">... and ${Object.keys(errorTypes).length - 2} more types</div>` : ''}
                                    </div>
                                ` : '<div class="detail-item success">✅ No errors found!</div>'}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">⚡ Performance</div>
                                <div class="result-value">${performanceMetrics.pageLoadTime || 0}ms</div>
                                <div class="result-details">
                                    <div class="detail-item">• Page load: ${performanceMetrics.pageLoadTime || 0}ms</div>
                                    <div class="detail-item">• DOM ready: ${performanceMetrics.domContentLoaded || 0}ms</div>
                                    <div class="detail-item">• First paint: ${performanceMetrics.firstPaint || 0}ms</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="download-section">
                            <button class="btn btn-primary" onclick="downloadReport('${reportData.sessionId}', 'html')">
                                <i class="fas fa-download"></i> Download Mercury Report
                            </button>
                            ${reportData.pagespeed ? `
                            <button class="btn btn-success" onclick="downloadReport('${reportData.sessionId}', 'pagespeed')">
                                <i class="fas fa-chart-line"></i> Download PageSpeed Report
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Complete progress bar
                document.getElementById('analysis-progress').style.width = '100%';
            }
            
            // Clear current analysis
            currentAnalysis = null;
        } else {
            document.getElementById('analysis-message').textContent = `Error: ${data.message}`;
            currentAnalysis = null;
        }
    })
    .catch(error => {
        console.error('Analysis stop error:', error);
        document.getElementById('analysis-message').textContent = 'Error occurred while stopping analysis!';
        
        // Hide loading overlay and reset button
        hideLoadingAndReset();
        
        currentAnalysis = null;
    });
    
    // Clear intervals
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
};

// Start progress animation
function startProgressAnimation() {
    const progressBar = document.getElementById('analysis-progress');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress > 90) progress = 90;
        progressBar.style.width = progress + '%';
    }, 1000);
    
    // Store interval for cleanup
    analysisInterval = interval;
}

// Start analysis monitoring
function startAnalysisMonitoring() {
    if (!currentAnalysis) return;
    
    // Monitor analysis status every 5 seconds
    const monitorInterval = setInterval(() => {
        if (!currentAnalysis) {
            clearInterval(monitorInterval);
            return;
        }
        
        fetch(`/api/web/browser/status/${currentAnalysis}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'completed') {
                clearInterval(monitorInterval);
                getAnalysisReport();
            } else if (data.status === 'error') {
                clearInterval(monitorInterval);
                document.getElementById('analysis-message').textContent = `Analysis error: ${data.message}`;
            }
        })
        .catch(error => {
            console.error('Monitoring error:', error);
        });
    }, 5000);
}

// Get analysis report
function getAnalysisReport() {
    if (!currentAnalysis) return;
    
    const sessionId = currentAnalysis; // Store session ID before clearing
    
    fetch(`/api/web/browser/report/${sessionId}`)
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('analysis-message').textContent = 'Analysis completed! Report ready.';
            document.getElementById('analysis-session-info').innerHTML = `
                <strong>Analysis Completed!</strong><br>
                Pages visited: ${data.data.navigationEvents.length}<br>
                Total resources: ${data.data.resourceTiming.length}<br>
                Errors: ${data.data.errors.length}<br>
                <button class="btn btn-sm btn-success" onclick="downloadReport('${sessionId}')">
                    <i class="fas fa-download"></i> Download Report
                </button>
            `;
            
            // Complete progress bar
            document.getElementById('analysis-progress').style.width = '100%';
            
            // Clear current analysis
            currentAnalysis = null;
        } else {
            document.getElementById('analysis-message').textContent = `Report error: ${data.message}`;
            currentAnalysis = null;
        }
    })
    .catch(error => {
        console.error('Report retrieval error:', error);
        document.getElementById('analysis-message').textContent = 'Error occurred while getting report!';
        currentAnalysis = null;
    });
}

// Get resource type helper function
function getResourceType(url) {
    const ext = url.split('.').pop().toLowerCase();
    const types = {
        'js': 'JavaScript',
        'css': 'CSS',
        'png': 'Image',
        'jpg': 'Image',
        'jpeg': 'Image',
        'gif': 'Image',
        'svg': 'Image',
        'woff': 'Font',
        'woff2': 'Font',
        'ttf': 'Font',
        'eot': 'Font',
        'json': 'JSON',
        'xml': 'XML'
    };
    return types[ext] || 'Other';
}

// Download report
window.downloadReport = function(sessionId, type = 'html') {
    let url = `/api/web/browser/download/${sessionId}?type=${type}`;
    
    // Different endpoints for special report types
    if (type === 'pagespeed') {
        url = `/api/web/browser/download/${sessionId}?type=pagespeed`;
    } else if (type === 'gemini') {
        url = `/api/web/browser/download/${sessionId}?type=gemini`;
    }
    
    // Add timestamp to prevent browser caching
    url += `&t=${Date.now()}`;
    
    window.open(url, '_blank');
};

// Show reports
window.showReports = function() {
    fetch('/api/reports')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayReports(data.reports);
            } else {
                showErrorModal('Error loading reports: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Reports loading error:', error);
            showErrorModal('Error occurred while loading reports!');
        });
};

// Display reports
function displayReports(reports) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = '📊 Analysis Reports';
    
    if (reports.length === 0) {
        modalBody.innerHTML = `
            <div class="no-reports">
                <div class="no-reports-icon">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="no-reports-content">
                    <h3>No Reports Available</h3>
                    <p>No analysis reports have been generated yet.</p>
                    <p>Start a new analysis to generate your first report!</p>
            </div>
            </div>
        `;
    } else {
        modalBody.innerHTML = `
        <div class="reports-container">
                <div class="reports-header">
                    <div class="reports-summary">
                        <div class="reports-count">
                            <i class="fas fa-chart-bar"></i>
                            <span class="count-number">${reports.length}</span>
                            <span class="count-label">Report${reports.length > 1 ? 's' : ''}</span>
                        </div>
                        <div class="reports-stats">
                            <div class="stat-item">
                                <i class="fas fa-clock"></i>
                                <span>Total Duration: ${Math.round(reports.reduce((sum, r) => sum + r.duration, 0) / 1000)}s</span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-globe"></i>
                                <span>${new Set(reports.map(r => r.url)).size} Unique Sites</span>
            </div>
        </div>
                    </div>
                    <div class="reports-actions">
                        <button class="btn btn-danger btn-sm" onclick="deleteAllReports()">
                            <i class="fas fa-trash-alt"></i>
                            <span>Delete All</span>
                        </button>
                    </div>
                </div>
                
                <div class="reports-list">
                    ${reports.map(report => `
                        <div class="report-card" data-session-id="${report.id}">
                            <div class="report-card-header">
                                <div class="report-main-info">
                                    <div class="report-url">
                                        <i class="fas fa-link"></i>
                                        <span class="url-text">${report.url}</span>
                                    </div>
                                    <div class="report-browser-badge">
                                        <i class="fas fa-browser"></i>
                                        <span>${report.browserType}</span>
                                    </div>
                                </div>
                                <div class="report-timestamp">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>${new Date(report.startTime).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}</span>
                                </div>
                                <div class="report-actions">
                                    <button class="btn btn-danger btn-sm delete-btn" onclick="deleteReport('${report.id}')">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                            <div class="report-card-body">
                                <div class="report-metrics-grid">
                                    <div class="metric-item">
                                        <div class="metric-icon">
                                            <i class="fas fa-file-alt"></i>
                                        </div>
                                        <div class="metric-content">
                                            <div class="metric-value">${report.metrics.pages}</div>
                                            <div class="metric-label">Pages</div>
                                        </div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-icon">
                                            <i class="fas fa-cogs"></i>
                                        </div>
                                        <div class="metric-content">
                                            <div class="metric-value">${report.metrics.resources}</div>
                                            <div class="metric-label">Resources</div>
                                        </div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-icon ${report.metrics.errors > 0 ? 'error' : 'success'}">
                                            <i class="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div class="metric-content">
                                            <div class="metric-value ${report.metrics.errors > 0 ? 'error' : 'success'}">${report.metrics.errors}</div>
                                            <div class="metric-label">Errors</div>
                                        </div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-icon">
                                            <i class="fas fa-stopwatch"></i>
                                        </div>
                                        <div class="metric-content">
                                            <div class="metric-value">${Math.round((report.duration || 0) / 1000)}s</div>
                                            <div class="metric-label">Duration</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    modal.classList.add('show');
};

// Modern Modal Functions
window.showConfirmModal = function(title, message, description, actionText, onConfirm) {
    document.getElementById('confirm-title').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-description').textContent = description;
    document.getElementById('confirm-action-btn').innerHTML = `<i class="fas fa-trash"></i> ${actionText}`;
    
    // Set up confirm action
    const confirmBtn = document.getElementById('confirm-action-btn');
    confirmBtn.onclick = () => {
        closeConfirmModal();
        onConfirm();
    };
    
    document.getElementById('confirm-modal').classList.add('show');
};

window.closeConfirmModal = function() {
    document.getElementById('confirm-modal').classList.remove('show');
};

window.showSuccessModal = function(message) {
    document.getElementById('success-message').textContent = message;
    document.getElementById('success-modal').classList.add('show');
};

window.closeSuccessModal = function() {
    document.getElementById('success-modal').classList.remove('show');
};

window.showErrorModal = function(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-modal').classList.add('show');
};

window.closeErrorModal = function() {
    document.getElementById('error-modal').classList.remove('show');
};

// Delete single report
window.deleteReport = function(sessionId) {
    showConfirmModal(
        'Delete Report',
        'Are you sure you want to delete this report?',
        'This action cannot be undone.',
        'Delete Report',
        () => {
            fetch(`/api/reports/${sessionId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showSuccessModal('Report deleted successfully!');
                    showReports(); // Refresh the list
                } else {
                    showErrorModal('Error deleting report: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Delete report error:', error);
                showErrorModal('Error occurred while deleting report!');
            });
        }
    );
};

// Delete all reports
window.deleteAllReports = function() {
    showConfirmModal(
        'Delete All Reports',
        'Are you sure you want to delete ALL reports?',
        'This action cannot be undone and will permanently remove all analysis reports.',
        'Delete All',
        () => {
            fetch('/api/reports', {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showSuccessModal('All reports deleted successfully!');
                    showReports(); // Refresh the list
                } else {
                    showErrorModal('Error deleting reports: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Delete all reports error:', error);
                showErrorModal('Error occurred while deleting reports!');
            });
        }
    );
};

// Close modal
window.closeModal = function() {
    document.getElementById('modal').classList.remove('show');
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== Mercury Performance Tools JavaScript loaded ===');
    console.log('Browser selection system ready');
    
    // Set default browser
    selectBrowser('chrome');
}); 