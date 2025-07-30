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
    
    console.log('Seçilen tarayıcı:', browser);
}

// Start browser analysis
function startBrowserAnalysis() {
    const url = document.getElementById('web-url').value.trim();
    
    if (!url) {
        alert('Lütfen bir URL girin!');
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Lütfen geçerli bir URL girin (http:// veya https:// ile başlamalı)!');
        return;
    }
    
    console.log('=== Tarayıcı Analizi Başlatılıyor ===');
    console.log('Tarayıcı:', selectedBrowser);
    console.log('URL:', url);
    
    // Show analysis status
    document.getElementById('analysis-status').style.display = 'block';
    document.getElementById('analysis-message').textContent = `${selectedBrowser} tarayıcısı açılıyor...`;
    
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
            document.getElementById('analysis-message').textContent = `${selectedBrowser} tarayıcısı açıldı! Siteyi gezinmeye başlayabilirsiniz.`;
            document.getElementById('analysis-session-info').textContent = `Session ID: ${data.sessionId}\nURL: ${url}\nTarayıcı: ${selectedBrowser}`;
            
            // Start progress animation
            startProgressAnimation();
            
            // Start monitoring
            startAnalysisMonitoring();
        } else {
            document.getElementById('analysis-message').textContent = `Hata: ${data.message}`;
        }
    })
    .catch(error => {
        console.error('Analiz başlatma hatası:', error);
        document.getElementById('analysis-message').textContent = 'Analiz başlatılırken hata oluştu!';
    });
};

// Stop analysis
function stopAnalysis() {
    if (!currentAnalysis) return;
    
    console.log('=== Analiz Durduruluyor ===');
    
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
        if (data.success) {
            document.getElementById('analysis-message').textContent = 'Analiz tamamlandı! Rapor hazır.';
            
            // Rapor verilerini doğrudan kullan
            const reportData = data.data;
            if (reportData) {
                // Detaylı analiz sonuçlarını göster
                const navigationEvents = reportData.metrics.navigationEvents || [];
                const resourceTiming = reportData.metrics.resourceTiming || [];
                const errors = reportData.metrics.errors || [];
                const performanceMetrics = reportData.metrics.performanceMetrics || {};
                
                // Kaynak tiplerini analiz et
                const resourceTypes = {};
                resourceTiming.forEach(resource => {
                    const type = getResourceType(resource.url);
                    resourceTypes[type] = (resourceTypes[type] || 0) + 1;
                });
                
                // Hata tiplerini analiz et
                const errorTypes = {};
                errors.forEach(error => {
                    const type = error.type || 'unknown';
                    errorTypes[type] = (errorTypes[type] || 0) + 1;
                });
                
                document.getElementById('analysis-session-info').innerHTML = `
                    <div class="analysis-results">
                        <div class="results-header">
                            <h4><i class="fas fa-chart-bar"></i> Analiz Sonuçları</h4>
                        </div>
                        
                        <div class="results-grid">
                            <div class="result-card">
                                <div class="result-title">📄 Sayfa Analizi</div>
                                <div class="result-value">${navigationEvents.length} sayfa ziyaret edildi</div>
                                ${navigationEvents.length > 0 ? `
                                    <div class="result-details">
                                        ${navigationEvents.slice(0, 3).map(event => `
                                            <div class="detail-item">• ${event.url || 'Bilinmeyen URL'}</div>
                                        `).join('')}
                                        ${navigationEvents.length > 3 ? `<div class="detail-item">... ve ${navigationEvents.length - 3} sayfa daha</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">🔧 Kaynak Analizi</div>
                                <div class="result-value">${resourceTiming.length} kaynak yüklendi</div>
                                ${Object.keys(resourceTypes).length > 0 ? `
                                    <div class="result-details">
                                        ${Object.entries(resourceTypes).slice(0, 3).map(([type, count]) => `
                                            <div class="detail-item">• ${type}: ${count}</div>
                                        `).join('')}
                                        ${Object.keys(resourceTypes).length > 3 ? `<div class="detail-item">... ve ${Object.keys(resourceTypes).length - 3} tip daha</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">⚠️ Hata Analizi</div>
                                <div class="result-value ${errors.length > 0 ? 'error' : 'success'}">${errors.length} hata bulundu</div>
                                ${errors.length > 0 ? `
                                    <div class="result-details">
                                        ${Object.entries(errorTypes).slice(0, 2).map(([type, count]) => `
                                            <div class="detail-item">• ${type}: ${count}</div>
                                        `).join('')}
                                        ${Object.keys(errorTypes).length > 2 ? `<div class="detail-item">... ve ${Object.keys(errorTypes).length - 2} tip daha</div>` : ''}
                                    </div>
                                ` : '<div class="detail-item success">✅ Hiç hata bulunamadı!</div>'}
                            </div>
                            
                            <div class="result-card">
                                <div class="result-title">⚡ Performans</div>
                                <div class="result-value">${performanceMetrics.pageLoadTime || 0}ms</div>
                                <div class="result-details">
                                    <div class="detail-item">• Sayfa yükleme: ${performanceMetrics.pageLoadTime || 0}ms</div>
                                    <div class="detail-item">• DOM hazır: ${performanceMetrics.domContentLoaded || 0}ms</div>
                                    <div class="detail-item">• İlk boyama: ${performanceMetrics.firstPaint || 0}ms</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="download-section">
                            <button class="btn btn-primary" onclick="downloadReport('${reportData.sessionId}', 'html')">
                                <i class="fas fa-download"></i> Mercury Raporu İndir
                            </button>
                            ${reportData.pagespeed ? `
                            <button class="btn btn-success" onclick="downloadReport('${reportData.sessionId}', 'pagespeed')">
                                <i class="fas fa-chart-line"></i> PageSpeed Raporu İndir
                            </button>
                            ` : ''}
                            ${reportData.gemini ? `
                            <button class="btn btn-info" onclick="downloadReport('${reportData.sessionId}', 'gemini')">
                                <i class="fas fa-robot"></i> AI Analiz Raporu İndir
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
            document.getElementById('analysis-message').textContent = `Hata: ${data.message}`;
            currentAnalysis = null;
        }
    })
    .catch(error => {
        console.error('Analiz durdurma hatası:', error);
        document.getElementById('analysis-message').textContent = 'Analiz durdurulurken hata oluştu!';
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
                document.getElementById('analysis-message').textContent = `Analiz hatası: ${data.message}`;
            }
        })
        .catch(error => {
            console.error('Monitoring hatası:', error);
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
            document.getElementById('analysis-message').textContent = 'Analiz tamamlandı! Rapor hazır.';
            document.getElementById('analysis-session-info').innerHTML = `
                <strong>Analiz Tamamlandı!</strong><br>
                Ziyaret edilen sayfalar: ${data.data.navigationEvents.length}<br>
                Toplam kaynak: ${data.data.resourceTiming.length}<br>
                Hatalar: ${data.data.errors.length}<br>
                <button class="btn btn-sm btn-success" onclick="downloadReport('${sessionId}')">
                    <i class="fas fa-download"></i> Raporu İndir
                </button>
            `;
            
            // Complete progress bar
            document.getElementById('analysis-progress').style.width = '100%';
            
            // Clear current analysis
            currentAnalysis = null;
        } else {
            document.getElementById('analysis-message').textContent = `Rapor hatası: ${data.message}`;
            currentAnalysis = null;
        }
    })
    .catch(error => {
        console.error('Rapor alma hatası:', error);
        document.getElementById('analysis-message').textContent = 'Rapor alınırken hata oluştu!';
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
    
    // Özel rapor türleri için farklı endpoint'ler
    if (type === 'pagespeed') {
        url = `/api/web/browser/download/${sessionId}?type=pagespeed`;
    } else if (type === 'gemini') {
        url = `/api/web/browser/download/${sessionId}?type=gemini`;
    }
    
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
                alert('Raporlar yüklenirken hata oluştu: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Raporlar yükleme hatası:', error);
            alert('Raporlar yüklenirken hata oluştu!');
        });
};

// Display reports
function displayReports(reports) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = '📊 Analiz Raporları';
    
    if (reports.length === 0) {
        modalBody.innerHTML = '<p>Henüz rapor bulunmuyor.</p>';
    } else {
        modalBody.innerHTML = `
            <div class="reports-list">
                ${reports.map(report => `
                    <div class="report-item">
                        <div class="report-header">
                            <div class="report-title">
                                <strong>${report.url}</strong>
                                <span class="report-browser">${report.browserType}</span>
                            </div>
                            <div class="report-date">
                                ${new Date(report.startTime).toLocaleString('tr-TR')}
                            </div>
                        </div>
                        <div class="report-metrics">
                            <span class="metric">📄 ${report.metrics.pages} sayfa</span>
                            <span class="metric">🔧 ${report.metrics.resources} kaynak</span>
                            <span class="metric">⚠️ ${report.metrics.errors} hata</span>
                            <span class="metric">⏱️ ${Math.round(report.duration / 1000)}s</span>
                        </div>
                        <div class="report-actions">
                            <button class="btn btn-sm btn-primary" onclick="downloadReport('${report.id}', 'html')">
                                <i class="fas fa-download"></i> HTML Rapor
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    modal.classList.add('show');
};

// Close modal
window.closeModal = function() {
    document.getElementById('modal').classList.remove('show');
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== Mercury Performance Tools JavaScript yüklendi ===');
    console.log('Tarayıcı seçimi sistemi hazır');
    
    // Set default browser
    selectBrowser('chrome');
}); 