const fs = require('fs').promises;
const path = require('path');

class GatlingReportGenerator {
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
        
        const filename = `gatling-report-${sessionId}-${Date.now()}.html`;
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
            averageSize: 0
        };

        resourceTiming.forEach(resource => {
            const status = resource.status;
            const type = this.getResourceType(resource.url);
            
            resourceStats.byStatus[status] = (resourceStats.byStatus[status] || 0) + 1;
            resourceStats.byType[type] = (resourceStats.byType[type] || 0) + 1;
        });

        if (resourceTiming.length > 0) {
            const totalSize = resourceTiming.reduce((sum, r) => sum + (r.size || 0), 0);
            resourceStats.averageSize = Math.round(totalSize / resourceTiming.length);
        }

        // Hata analizi
        const errorStats = {
            total: errors.length,
            byType: {},
            critical: errors.filter(e => e.type === 'page_error').length
        };

        errors.forEach(error => {
            const type = error.type;
            errorStats.byType[type] = (errorStats.byType[type] || 0) + 1;
        });

        return {
            pageLoadTimes,
            resourceStats,
            errorStats,
            consoleLogs,
            clicks,
            performanceMetrics,
            summary: {
                totalPages: pageLoadTimes.length,
                totalResources: resourceStats.total,
                totalErrors: errorStats.total,
                totalClicks: clicks.length,
                totalConsoleLogs: consoleLogs.length,
                averageLoadTime: pageLoadTimes.length > 0 
                    ? Math.round(pageLoadTimes.reduce((sum, p) => sum + p.loadTime, 0) / pageLoadTimes.length)
                    : 0
            }
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
        const { summary } = reportData;

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gatling Performance Report - ${sessionId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
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

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .summary-card {
            background: white;
            border-radius: 10px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
        }

        .summary-card h3 {
            color: #667eea;
            margin-bottom: 0.5rem;
        }

        .summary-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
        }

        .summary-card .label {
            color: #666;
            font-size: 0.9rem;
        }

        .section {
            background: white;
            border-radius: 10px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .section h2 {
            color: #667eea;
            margin-bottom: 1rem;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 0.5rem;
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
        }

        .table tr:hover {
            background: #f8f9fa;
        }

        .status-success { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }

        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
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
            color: #667eea;
            margin-bottom: 0.5rem;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            border-top: 1px solid #eee;
            margin-top: 2rem;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
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
        <h1>☿ Mercury Performance Report</h1>
        <div class="subtitle">Gatling Style Performance Analysis</div>
    </div>

    <div class="container">
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Toplam Sayfa</h3>
                <div class="value">${summary.totalPages}</div>
                <div class="label">Ziyaret Edilen Sayfalar</div>
            </div>
            <div class="summary-card">
                <h3>Kaynaklar</h3>
                <div class="value">${summary.totalResources}</div>
                <div class="label">Yüklenen Kaynaklar</div>
            </div>
            <div class="summary-card">
                <h3>Hatalar</h3>
                <div class="value status-${summary.totalErrors > 0 ? 'error' : 'success'}">${summary.totalErrors}</div>
                <div class="label">Toplam Hata</div>
            </div>
            <div class="summary-card">
                <h3>Ortalama Süre</h3>
                <div class="value">${summary.averageLoadTime}ms</div>
                <div class="label">Sayfa Yükleme</div>
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="section">
            <h2>📊 Performans Metrikleri</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Sayfa Yükleme Süreleri</h4>
                    <div class="chart-container">
                        <canvas id="loadTimeChart"></canvas>
                    </div>
                </div>
                <div class="metric-card">
                    <h4>Kaynak Dağılımı</h4>
                    <div class="chart-container">
                        <canvas id="resourceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resource Analysis -->
        <div class="section">
            <h2>🔧 Kaynak Analizi</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Kaynak Tipi</th>
                        <th>Sayı</th>
                        <th>Yüzde</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(reportData.resourceStats.byType).map(([type, count]) => `
                        <tr>
                            <td>${type}</td>
                            <td>${count}</td>
                            <td>${Math.round((count / reportData.resourceStats.total) * 100)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Error Analysis -->
        <div class="section">
            <h2>⚠️ Hata Analizi</h2>
            ${reportData.errorStats.total > 0 ? `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Hata Tipi</th>
                            <th>Sayı</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(reportData.errorStats.byType).map(([type, count]) => `
                            <tr>
                                <td>${type}</td>
                                <td>${count}</td>
                                <td><span class="status-error">Kritik</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="status-success">✅ Hiç hata bulunamadı!</p>'}
        </div>

        <!-- Session Details -->
        <div class="section">
            <h2>📋 Oturum Detayları</h2>
            <table class="table">
                <tr>
                    <td><strong>Session ID:</strong></td>
                    <td>${sessionId}</td>
                </tr>
                <tr>
                    <td><strong>Tarayıcı:</strong></td>
                    <td>${browserType}</td>
                </tr>
                <tr>
                    <td><strong>URL:</strong></td>
                    <td>${url}</td>
                </tr>
                <tr>
                    <td><strong>Başlangıç:</strong></td>
                    <td>${new Date(startTime).toLocaleString('tr-TR')}</td>
                </tr>
                <tr>
                    <td><strong>Bitiş:</strong></td>
                    <td>${new Date(endTime).toLocaleString('tr-TR')}</td>
                </tr>
                <tr>
                    <td><strong>Süre:</strong></td>
                    <td>${Math.round(duration / 1000)} saniye</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="footer">
        <p>☿ Mercury Performance Tools - Gatling Style Report</p>
        <p>Rapor oluşturulma zamanı: ${new Date().toLocaleString('tr-TR')}</p>
    </div>

    <script>
        // Load Time Chart
        const loadTimeCtx = document.getElementById('loadTimeChart').getContext('2d');
        new Chart(loadTimeCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(reportData.pageLoadTimes.map((_, i) => `Sayfa ${i + 1}`))},
                datasets: [{
                    label: 'Yükleme Süresi (ms)',
                    data: ${JSON.stringify(reportData.pageLoadTimes.map(p => p.loadTime))},
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
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
                            text: 'Süre (ms)'
                        }
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
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#f5576c',
                        '#4facfe',
                        '#00f2fe'
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
}

module.exports = GatlingReportGenerator; 