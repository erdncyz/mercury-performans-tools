const fs = require('fs').promises;
const path = require('path');

class LighthouseCIReport {
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
        
        const filename = `mercury-performance-report-${sessionId}-${Date.now()}.html`;
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
        const memoryUsage = metrics.memoryUsage || [];

        // Tüm sayfa gezinmelerini analiz et
        const allNavigations = navigationEvents.filter(e => 
            e.type === 'page_load' || e.type === 'navigation' || e.type === 'spa_navigation' || e.type === 'url_change'
        );
        
        // Sayfa yükleme analizi
        const pageLoads = navigationEvents.filter(e => e.type === 'page_load');
        const detailedNavigations = navigationEvents.filter(e => e.type === 'detailed_navigation');
        
        // Yükleme sürelerini hesapla
        let pageLoadTimes = [];
        if (pageLoads.length > 0) {
            pageLoadTimes = pageLoads.map(p => p.loadTime || 0).filter(t => t > 0);
        } else if (detailedNavigations.length > 0) {
            // Detailed navigation'dan yükleme süresini hesapla
            pageLoadTimes = detailedNavigations.map(nav => {
                const data = nav.data;
                return data ? (data.loadEventEnd - data.loadEventStart) : 0;
            }).filter(t => t > 0);
        }
        
        // Kaynak analizi
        const resourceStats = this.analyzeResources(resourceTiming);
        
        // Hata analizi
        const errorStats = this.analyzeErrors(errors);
        
        // Performans skorları
        const performanceScores = this.calculatePerformanceScores(pageLoadTimes, resourceStats, errorStats);

        return {
            performanceScores,
            pageLoadAnalysis: {
                totalPages: allNavigations.length,
                totalPageLoads: pageLoads.length,
                averageLoadTime: pageLoadTimes.length > 0 ? 
                    Math.round(pageLoadTimes.reduce((sum, t) => sum + t, 0) / pageLoadTimes.length) : 0,
                fastestLoad: pageLoadTimes.length > 0 ? Math.min(...pageLoadTimes) : 0,
                slowestLoad: pageLoadTimes.length > 0 ? Math.max(...pageLoadTimes) : 0,
                pages: allNavigations.map(nav => ({
                    url: nav.url,
                    type: nav.type,
                    timestamp: nav.timestamp,
                    loadTime: nav.loadTime || 0,
                    firstPaint: nav.firstPaint || 0,
                    firstContentfulPaint: nav.firstContentfulPaint || 0,
                    detailedData: nav.data || null
                }))
            },
            resourceStats,
            errorStats,
            summary: {
                totalPages: allNavigations.length,
                totalResources: resourceTiming.length,
                totalErrors: errors.length,
                totalClicks: clicks.length,
                totalSize: resourceStats.totalSize,
                averageMemoryUsage: memoryUsage.length > 0 ? 
                    Math.round(memoryUsage.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / memoryUsage.length) : 0
            }
        };
    }

    analyzeResources(resourceTiming) {
        if (resourceTiming.length === 0) {
            return {
                totalSize: 0,
                averageSize: 0,
                byType: {},
                byStatus: {},
                slowestResources: [],
                largestResources: []
            };
        }

        const byType = {};
        const byStatus = {};
        let totalSize = 0;
        const resources = [];

        resourceTiming.forEach(resource => {
            const type = this.getResourceType(resource.url);
            const size = resource.size || 0;
            const duration = resource.duration || 0;

            byType[type] = (byType[type] || 0) + 1;
            byStatus[resource.status] = (byStatus[resource.status] || 0) + 1;
            totalSize += size;

            resources.push({
                url: resource.url,
                type,
                size,
                duration,
                status: resource.status
            });
        });

        const slowestResources = resources
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);

        const largestResources = resources
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);

        return {
            totalSize,
            averageSize: Math.round(totalSize / resourceTiming.length),
            byType,
            byStatus,
            slowestResources,
            largestResources
        };
    }

    analyzeErrors(errors) {
        if (errors.length === 0) {
            return {
                totalErrors: 0,
                byType: {},
                bySeverity: {}
            };
        }

        const byType = {};
        const bySeverity = {
            critical: 0,
            warning: 0,
            info: 0
        };

        errors.forEach(error => {
            const type = error.type;
            byType[type] = (byType[type] || 0) + 1;

            if (type === 'page_error') bySeverity.critical++;
            else if (type === 'console_error') bySeverity.warning++;
            else bySeverity.info++;
        });

        return {
            totalErrors: errors.length,
            byType,
            bySeverity
        };
    }

    calculatePerformanceScores(pageLoadTimes, resourceStats, errorStats) {
        // Performance Score (0-100)
        let performanceScore = 100;
        const avgLoadTime = pageLoadTimes.length > 0 ? 
            pageLoadTimes.reduce((sum, t) => sum + t, 0) / pageLoadTimes.length : 0;
        
        if (avgLoadTime > 3000) performanceScore -= 40;
        else if (avgLoadTime > 2000) performanceScore -= 25;
        else if (avgLoadTime > 1000) performanceScore -= 15;

        // Accessibility Score (0-100)
        let accessibilityScore = 100;
        if (errorStats.totalErrors > 10) accessibilityScore -= 30;
        else if (errorStats.totalErrors > 5) accessibilityScore -= 20;
        else if (errorStats.totalErrors > 0) accessibilityScore -= 10;

        // Best Practices Score (0-100)
        let bestPracticesScore = 100;
        if (resourceStats.totalSize > 5000000) bestPracticesScore -= 30; // 5MB
        else if (resourceStats.totalSize > 2000000) bestPracticesScore -= 20; // 2MB
        else if (resourceStats.totalSize > 1000000) bestPracticesScore -= 10; // 1MB

        // SEO Score (0-100)
        let seoScore = 100;
        if (pageLoadTimes.length === 0) seoScore -= 50;
        else if (pageLoadTimes.length < 2) seoScore -= 20;

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

    getScoreColor(score) {
        if (score >= 90) return '#0cce6b';
        if (score >= 50) return '#ffa400';
        return '#f44336';
    }

    getScoreLabel(score) {
        if (score >= 90) return 'Good';
        if (score >= 50) return 'Needs improvement';
        return 'Poor';
    }

    generateHTML(sessionData, reportData) {
        const { sessionId, browserType, url, startTime, endTime, duration } = sessionData;
        const { performanceScores, pageLoadAnalysis, resourceStats, errorStats, summary } = reportData;

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mercury Performance Report - ${sessionId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Google Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8f9fa;
            color: #202124;
            line-height: 1.6;
        }

        .header {
            background: #fff;
            border-bottom: 1px solid #dadce0;
            padding: 1rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 500;
            color: #202124;
        }

        .header .meta {
            font-size: 0.875rem;
            color: #5f6368;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .score-card {
            background: #fff;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            text-align: center;
        }

        .score-circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: bold;
            color: #fff;
        }

        .score-label {
            font-size: 0.875rem;
            font-weight: 500;
            color: #5f6368;
            margin-bottom: 0.5rem;
        }

        .score-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .score-status {
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section {
            background: #fff;
            border-radius: 8px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .section h2 {
            font-size: 1.25rem;
            font-weight: 500;
            color: #202124;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
        }

        .section h2::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #1a73e8;
            margin-right: 0.75rem;
            border-radius: 2px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .metric {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 1rem;
            text-align: center;
        }

        .metric .value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #202124;
            margin-bottom: 0.25rem;
        }

        .metric .label {
            font-size: 0.75rem;
            color: #5f6368;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
            border-bottom: 1px solid #e8eaed;
        }

        .table th {
            background: #f8f9fa;
            font-weight: 500;
            color: #5f6368;
            font-size: 0.875rem;
        }

        .table tr:hover {
            background: #f8f9fa;
        }

        .status-good { color: #0cce6b; }
        .status-warning { color: #ffa400; }
        .status-error { color: #f44336; }

        .chart-container {
            height: 300px;
            margin: 1rem 0;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #5f6368;
            font-size: 0.875rem;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .scores-grid {
                grid-template-columns: 1fr;
            }
            
            .header {
                padding: 1rem;
            }
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <h1>☿ Mercury Performance Report</h1>
        <div class="meta">
            ${new Date().toLocaleString('tr-TR')} | ${browserType} | ${url}
        </div>
    </div>

    <div class="container">
        <!-- Performance Scores -->
        <div class="scores-grid">
            <div class="score-card">
                <div class="score-circle" style="background: ${this.getScoreColor(performanceScores.performance)}">
                    ${performanceScores.performance}
                </div>
                <div class="score-label">Performance</div>
                <div class="score-value">${performanceScores.performance}</div>
                <div class="score-status" style="color: ${this.getScoreColor(performanceScores.performance)}">
                    ${this.getScoreLabel(performanceScores.performance)}
                </div>
            </div>
            
            <div class="score-card">
                <div class="score-circle" style="background: ${this.getScoreColor(performanceScores.accessibility)}">
                    ${performanceScores.accessibility}
                </div>
                <div class="score-label">Accessibility</div>
                <div class="score-value">${performanceScores.accessibility}</div>
                <div class="score-status" style="color: ${this.getScoreColor(performanceScores.accessibility)}">
                    ${this.getScoreLabel(performanceScores.accessibility)}
                </div>
            </div>
            
            <div class="score-card">
                <div class="score-circle" style="background: ${this.getScoreColor(performanceScores.bestPractices)}">
                    ${performanceScores.bestPractices}
                </div>
                <div class="score-label">Best Practices</div>
                <div class="score-value">${performanceScores.bestPractices}</div>
                <div class="score-status" style="color: ${this.getScoreColor(performanceScores.bestPractices)}">
                    ${this.getScoreLabel(performanceScores.bestPractices)}
                </div>
            </div>
            
            <div class="score-card">
                <div class="score-circle" style="background: ${this.getScoreColor(performanceScores.seo)}">
                    ${performanceScores.seo}
                </div>
                <div class="score-label">SEO</div>
                <div class="score-value">${performanceScores.seo}</div>
                <div class="score-status" style="color: ${this.getScoreColor(performanceScores.seo)}">
                    ${this.getScoreLabel(performanceScores.seo)}
                </div>
            </div>
        </div>

        <!-- Summary Metrics -->
        <div class="section">
            <h2>📊 Summary Metrics</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="value">${summary.totalPages}</div>
                    <div class="label">Pages Analyzed</div>
                </div>
                <div class="metric">
                    <div class="value">${summary.totalResources}</div>
                    <div class="label">Resources Loaded</div>
                </div>
                <div class="metric">
                    <div class="value">${this.formatBytes(summary.totalSize)}</div>
                    <div class="label">Total Size</div>
                </div>
                <div class="metric">
                    <div class="value">${summary.totalErrors}</div>
                    <div class="label">Errors Found</div>
                </div>
            </div>
        </div>

        <!-- Page Load Analysis -->
        <div class="section">
            <h2>⚡ Page Load Analysis</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="value">${pageLoadAnalysis.averageLoadTime}ms</div>
                    <div class="label">Average Load Time</div>
                </div>
                <div class="metric">
                    <div class="value">${pageLoadAnalysis.fastestLoad}ms</div>
                    <div class="label">Fastest Load</div>
                </div>
                <div class="metric">
                    <div class="value">${pageLoadAnalysis.slowestLoad}ms</div>
                    <div class="label">Slowest Load</div>
                </div>
            </div>
            
                         ${pageLoadAnalysis.pages.length > 0 ? `
             <table class="table">
                 <thead>
                     <tr>
                         <th>Page URL</th>
                         <th>Type</th>
                         <th>Load Time</th>
                         <th>First Paint</th>
                         <th>First Contentful Paint</th>
                         <th>Timestamp</th>
                     </tr>
                 </thead>
                 <tbody>
                     ${pageLoadAnalysis.pages.map(page => {
                         const loadTime = page.detailedData ? 
                             Math.round(page.detailedData.loadEventEnd - page.detailedData.loadEventStart) : 
                             page.loadTime;
                         const time = new Date(page.timestamp).toLocaleTimeString('tr-TR');
                         return `
                         <tr>
                             <td>${page.url}</td>
                             <td><span class="status-${page.type === 'page_load' ? 'good' : 'warning'}">${page.type}</span></td>
                             <td>${loadTime}ms</td>
                             <td>${page.firstPaint}ms</td>
                             <td>${page.firstContentfulPaint}ms</td>
                             <td>${time}</td>
                         </tr>
                     `}).join('')}
                 </tbody>
             </table>
             ` : '<p>No page load data available.</p>'}
        </div>

        <!-- Resource Analysis -->
        <div class="section">
            <h2>🔧 Resource Analysis</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="value">${this.formatBytes(resourceStats.totalSize)}</div>
                    <div class="label">Total Size</div>
                </div>
                <div class="metric">
                    <div class="value">${this.formatBytes(resourceStats.averageSize)}</div>
                    <div class="label">Average Size</div>
                </div>
                <div class="metric">
                    <div class="value">${Object.keys(resourceStats.byType).length}</div>
                    <div class="label">Resource Types</div>
                </div>
            </div>
            
            ${Object.keys(resourceStats.byType).length > 0 ? `
            <div class="chart-container">
                <canvas id="resourceChart"></canvas>
            </div>
            ` : ''}
        </div>

        <!-- Error Analysis -->
        <div class="section">
            <h2>⚠️ Error Analysis</h2>
            ${errorStats.totalErrors > 0 ? `
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="value status-error">${errorStats.totalErrors}</div>
                        <div class="label">Total Errors</div>
                    </div>
                    <div class="metric">
                        <div class="value status-warning">${errorStats.bySeverity.critical}</div>
                        <div class="label">Critical</div>
                    </div>
                    <div class="metric">
                        <div class="value status-warning">${errorStats.bySeverity.warning}</div>
                        <div class="label">Warnings</div>
                    </div>
                </div>
            ` : '<p class="status-good">✅ No errors found during analysis!</p>'}
        </div>
    </div>

    <div class="footer">
        <p>☿ Mercury Performance Report generated by Mercury Performance Tools</p>
        <p>Session ID: ${sessionId} | Duration: ${Math.round(duration / 1000)}s</p>
    </div>

    <script>
        ${Object.keys(resourceStats.byType).length > 0 ? `
        // Resource Types Chart
        const resourceCtx = document.getElementById('resourceChart').getContext('2d');
        new Chart(resourceCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Object.keys(resourceStats.byType))},
                datasets: [{
                    data: ${JSON.stringify(Object.values(resourceStats.byType))},
                    backgroundColor: [
                        '#1a73e8',
                        '#34a853',
                        '#fbbc04',
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
        ` : ''}
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

module.exports = LighthouseCIReport; 