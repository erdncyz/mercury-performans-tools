const fs = require('fs').promises;
const path = require('path');

class LighthouseReportGenerator {
    constructor() {
        this.templateDir = path.join(__dirname, '../templates');
    }

    async generateHTMLReport(sessionData) {
        const {
            sessionId,
            browserType,
            url,
            startTime,
            endTime,
            duration,
            metrics
        } = sessionData;

        const reportData = this.processMetrics(metrics);
        const html = this.generateHTML(sessionData, reportData);
        
        const reportsDir = path.join(__dirname, '../../reports');
        await fs.mkdir(reportsDir, { recursive: true });
        
        const filename = `lighthouse-report-${sessionId}-${Date.now()}.html`;
        const reportPath = path.join(reportsDir, filename);
        
        await fs.writeFile(reportPath, html);
        return reportPath;
    }

    processMetrics(metrics) {
        const navigationEvents = metrics.navigationEvents || [];
        const resourceTiming = metrics.resourceTiming || [];
        const errors = metrics.errors || [];
        const consoleLogs = metrics.consoleLogs || [];
        const clicks = metrics.clicks || [];
        const performanceMetrics = metrics.performanceMetrics || {};

        // Sayfa yükleme süreleri
        const pageLoadTimes = navigationEvents
            .filter(event => event.type === 'page_load')
            .map(event => ({
                url: event.url,
                timestamp: event.timestamp,
                loadTime: event.loadTime || 0
            }));

        // Kaynak yükleme istatistikleri
        const resourceStats = {
            total: resourceTiming.length,
            byStatus: {},
            byType: {},
            averageSize: 0,
            totalSize: 0,
            slowestResources: []
        };

        resourceTiming.forEach(resource => {
            const status = resource.status;
            const type = this.getResourceType(resource.url);
            const size = resource.size || 0;
            
            resourceStats.byStatus[status] = (resourceStats.byStatus[status] || 0) + 1;
            resourceStats.byType[type] = (resourceStats.byType[type] || 0) + 1;
            resourceStats.totalSize += size;
        });

        if (resourceTiming.length > 0) {
            resourceStats.averageSize = Math.round(resourceStats.totalSize / resourceTiming.length);
            
            // En yavaş 5 kaynağı bul
            resourceStats.slowestResources = resourceTiming
                .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                .slice(0, 5);
        }

        // Hata analizi
        const errorStats = {
            total: errors.length,
            byType: {},
            critical: errors.filter(e => e.type === 'page_error').length,
            bySeverity: {
                critical: 0,
                warning: 0,
                info: 0
            }
        };

        errors.forEach(error => {
            const type = error.type;
            errorStats.byType[type] = (errorStats.byType[type] || 0) + 1;
            
            // Hata şiddetini belirle
            if (type === 'page_error') {
                errorStats.bySeverity.critical++;
            } else if (type === 'console_error') {
                errorStats.bySeverity.warning++;
            } else {
                errorStats.bySeverity.info++;
            }
        });

        // Performans skorları (Lighthouse benzeri)
        const performanceScores = this.calculatePerformanceScores(performanceMetrics, resourceStats, errorStats);

        return {
            pageLoadTimes,
            resourceStats,
            errorStats,
            consoleLogs,
            clicks,
            performanceMetrics,
            performanceScores,
            summary: {
                totalPages: pageLoadTimes.length,
                totalResources: resourceStats.total,
                totalErrors: errorStats.total,
                totalClicks: clicks.length,
                totalConsoleLogs: consoleLogs.length,
                averageLoadTime: pageLoadTimes.length > 0 
                    ? Math.round(pageLoadTimes.reduce((sum, p) => sum + p.loadTime, 0) / pageLoadTimes.length)
                    : 0,
                totalSize: resourceStats.totalSize
            }
        };
    }

    calculatePerformanceScores(performanceMetrics, resourceStats, errorStats) {
        // Lighthouse benzeri skor hesaplama
        let performanceScore = 100;
        let accessibilityScore = 100;
        let bestPracticesScore = 100;
        let seoScore = 100;

        // Performans skoru
        const loadTime = performanceMetrics.pageLoadTime || 0;
        if (loadTime > 3000) performanceScore -= 30;
        else if (loadTime > 2000) performanceScore -= 20;
        else if (loadTime > 1000) performanceScore -= 10;

        const resourceCount = resourceStats.total;
        if (resourceCount > 100) performanceScore -= 20;
        else if (resourceCount > 50) performanceScore -= 10;

        // En iyi uygulamalar skoru
        if (errorStats.total > 10) bestPracticesScore -= 40;
        else if (errorStats.total > 5) bestPracticesScore -= 20;
        else if (errorStats.total > 0) bestPracticesScore -= 10;

        // SEO skoru
        if (resourceStats.total === 0) seoScore -= 30;
        if (performanceMetrics.pageLoadTime > 3000) seoScore -= 20;

        return {
            performance: Math.max(0, performanceScore),
            accessibility: Math.max(0, accessibilityScore),
            bestPractices: Math.max(0, bestPracticesScore),
            seo: Math.max(0, seoScore)
        };
    }

    getResourceType(url) {
        const ext = path.extname(url).toLowerCase();
        const types = {
            '.js': 'JavaScript',
            '.css': 'CSS',
            '.png': 'Image',
            '.jpg': 'Image',
            '.jpeg': 'Image',
            '.gif': 'Image',
            '.svg': 'Image',
            '.woff': 'Font',
            '.woff2': 'Font',
            '.ttf': 'Font',
            '.eot': 'Font',
            '.json': 'JSON',
            '.xml': 'XML'
        };
        return types[ext] || 'Other';
    }

    generateHTML(sessionData, reportData) {
        const { sessionId, browserType, url, startTime, endTime, duration } = sessionData;
        const { summary, performanceScores } = reportData;

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lighthouse Performance Report - ${sessionId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Google Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }

        .header {
            background: linear-gradient(135deg, #4285f4 0%, #34a853 50%, #fbbc05 75%, #ea4335 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 300;
        }

        .header .subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .score-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: 3px solid transparent;
        }

        .score-card.performance { border-color: #4285f4; }
        .score-card.accessibility { border-color: #34a853; }
        .score-card.best-practices { border-color: #fbbc05; }
        .score-card.seo { border-color: #ea4335; }

        .score-card h3 {
            color: #333;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .score-card .score {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .score-card.performance .score { color: #4285f4; }
        .score-card.accessibility .score { color: #34a853; }
        .score-card.best-practices .score { color: #fbbc05; }
        .score-card.seo .score { color: #ea4335; }

        .score-card .label {
            color: #666;
            font-size: 0.8rem;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .summary-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .summary-card h3 {
            color: #4285f4;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .summary-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 0.5rem;
        }

        .summary-card .label {
            color: #666;
            font-size: 0.9rem;
        }

        .section {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .section h2 {
            color: #4285f4;
            margin-bottom: 1.5rem;
            font-size: 1.5rem;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 0.5rem;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }

        .metric-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1rem;
        }

        .metric-card h4 {
            color: #4285f4;
            margin-bottom: 0.5rem;
        }

        .chart-container {
            height: 300px;
            margin: 1rem 0;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }

        .table th,
        .table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #4285f4;
        }

        .table tr:hover {
            background: #f8f9fa;
        }

        .status-success { color: #34a853; }
        .status-warning { color: #fbbc05; }
        .status-error { color: #ea4335; }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin: 0.5rem 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4285f4, #34a853);
            transition: width 0.3s ease;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            border-top: 1px solid #eee;
            margin-top: 2rem;
        }

        .audit-item {
            display: flex;
            align-items: center;
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            background: #f8f9fa;
        }

        .audit-icon {
            margin-right: 0.75rem;
            font-size: 1.2rem;
        }

        .audit-content {
            flex: 1;
        }

        .audit-title {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .audit-description {
            font-size: 0.9rem;
            color: #666;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .scores-grid,
            .summary-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <h1>🔍 Lighthouse Performance Report</h1>
        <div class="subtitle">Google Lighthouse Style Analysis</div>
    </div>

    <div class="container">
        <!-- Performance Scores -->
        <div class="scores-grid">
            <div class="score-card performance">
                <h3>Performance</h3>
                <div class="score">${performanceScores.performance}</div>
                <div class="label">Performance Score</div>
            </div>
            <div class="score-card accessibility">
                <h3>Accessibility</h3>
                <div class="score">${performanceScores.accessibility}</div>
                <div class="label">Accessibility Score</div>
            </div>
            <div class="score-card best-practices">
                <h3>Best Practices</h3>
                <div class="score">${performanceScores.bestPractices}</div>
                <div class="label">Best Practices Score</div>
            </div>
            <div class="score-card seo">
                <h3>SEO</h3>
                <div class="score">${performanceScores.seo}</div>
                <div class="label">SEO Score</div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>📄 Pages Analyzed</h3>
                <div class="value">${summary.totalPages}</div>
                <div class="label">Total Pages Visited</div>
            </div>
            <div class="summary-card">
                <h3>🔧 Resources Loaded</h3>
                <div class="value">${summary.totalResources}</div>
                <div class="label">Total Resources</div>
            </div>
            <div class="summary-card">
                <h3>⚠️ Errors Found</h3>
                <div class="value status-${summary.totalErrors > 0 ? 'error' : 'success'}">${summary.totalErrors}</div>
                <div class="label">Total Errors</div>
            </div>
            <div class="summary-card">
                <h3>📊 Total Size</h3>
                <div class="value">${this.formatBytes(summary.totalSize)}</div>
                <div class="label">Total Resource Size</div>
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Page Load Times</h4>
                    <div class="chart-container">
                        <canvas id="loadTimeChart"></canvas>
                    </div>
                </div>
                <div class="metric-card">
                    <h4>Resource Distribution</h4>
                    <div class="chart-container">
                        <canvas id="resourceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resource Analysis -->
        <div class="section">
            <h2>🔧 Resource Analysis</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Resource Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Average Size</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(reportData.resourceStats.byType).map(([type, count]) => `
                        <tr>
                            <td>${type}</td>
                            <td>${count}</td>
                            <td>${Math.round((count / reportData.resourceStats.total) * 100)}%</td>
                            <td>${this.formatBytes(reportData.resourceStats.averageSize)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Error Analysis -->
        <div class="section">
            <h2>⚠️ Error Analysis</h2>
            ${reportData.errorStats.total > 0 ? `
                <div class="audit-item">
                    <div class="audit-icon status-error">⚠️</div>
                    <div class="audit-content">
                        <div class="audit-title">${reportData.errorStats.total} Errors Found</div>
                        <div class="audit-description">
                            Critical: ${reportData.errorStats.bySeverity.critical} | 
                            Warning: ${reportData.errorStats.bySeverity.warning} | 
                            Info: ${reportData.errorStats.bySeverity.info}
                        </div>
                    </div>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Error Type</th>
                            <th>Count</th>
                            <th>Severity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(reportData.errorStats.byType).map(([type, count]) => `
                            <tr>
                                <td>${type}</td>
                                <td>${count}</td>
                                <td><span class="status-error">Critical</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : `
                <div class="audit-item">
                    <div class="audit-icon status-success">✅</div>
                    <div class="audit-content">
                        <div class="audit-title">No Errors Found</div>
                        <div class="audit-description">Great! No errors were detected during the analysis.</div>
                    </div>
                </div>
            `}
        </div>

        <!-- Session Details -->
        <div class="section">
            <h2>📋 Session Details</h2>
            <table class="table">
                <tr>
                    <td><strong>Session ID:</strong></td>
                    <td>${sessionId}</td>
                </tr>
                <tr>
                    <td><strong>Browser:</strong></td>
                    <td>${browserType}</td>
                </tr>
                <tr>
                    <td><strong>URL:</strong></td>
                    <td>${url}</td>
                </tr>
                <tr>
                    <td><strong>Start Time:</strong></td>
                    <td>${new Date(startTime).toLocaleString('tr-TR')}</td>
                </tr>
                <tr>
                    <td><strong>End Time:</strong></td>
                    <td>${new Date(endTime).toLocaleString('tr-TR')}</td>
                </tr>
                <tr>
                    <td><strong>Duration:</strong></td>
                    <td>${Math.round(duration / 1000)} seconds</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="footer">
        <p>🔍 Mercury Performance Tools - Lighthouse Style Report</p>
        <p>Generated on: ${new Date().toLocaleString('tr-TR')}</p>
    </div>

    <script>
        // Load Time Chart
        const loadTimeCtx = document.getElementById('loadTimeChart').getContext('2d');
        new Chart(loadTimeCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(reportData.pageLoadTimes.map((_, i) => `Page ${i + 1}`))},
                datasets: [{
                    label: 'Load Time (ms)',
                    data: ${JSON.stringify(reportData.pageLoadTimes.map(p => p.loadTime))},
                    borderColor: '#4285f4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Time (ms)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        // Resource Chart
        const resourceCtx = document.getElementById('resourceChart').getContext('2d');
        new Chart(resourceCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Object.keys(reportData.resourceStats.byType))},
                datasets: [{
                    data: ${JSON.stringify(Object.values(reportData.resourceStats.byType))},
                    backgroundColor: [
                        '#4285f4',
                        '#34a853',
                        '#fbbc05',
                        '#ea4335',
                        '#9c27b0',
                        '#ff9800'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
</body>
</html>`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = LighthouseReportGenerator; 