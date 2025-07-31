const fs = require('fs').promises;
const path = require('path');

class PageSpeedReport {
    constructor() {
        this.templateDir = path.join(__dirname, '../templates');
    }

    // Türkçe tarih formatı oluştur
    formatTurkishDate(date) {
        const months = [
            'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
        ];
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${day}-${month}-${year}-${hours}-${minutes}`;
    }

    async generateHTMLReport(pageSpeedData) {
        const { sessionData, mobileAnalysis, desktopAnalysis, generatedAt } = pageSpeedData;
        
        const html = this.generateHTML(pageSpeedData);
        
        const reportsDir = path.join(__dirname, '../../reports');
        await fs.mkdir(reportsDir, { recursive: true });
        
        const turkishDate = this.formatTurkishDate(new Date());
        const filename = `pagespeed-performans-${turkishDate}.html`;
        const reportPath = path.join(reportsDir, filename);
        
        await fs.writeFile(reportPath, html);
        return reportPath;
    }

    generateHTML(pageSpeedData) {
        const { sessionData, mobileAnalysis, desktopAnalysis, generatedAt } = pageSpeedData;
        const { url, browserType, startTime, endTime, duration } = sessionData;

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PageSpeed Insights Report - ${sessionData.sessionId}</title>
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
            display: flex;
            align-items: center;
        }

        .header .logo {
            width: 32px;
            height: 32px;
            margin-right: 0.75rem;
            background: #4285f4;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
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

        .strategy-tabs {
            display: flex;
            margin-bottom: 2rem;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .tab {
            flex: 1;
            padding: 1rem;
            text-align: center;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
        }

        .tab.active {
            border-bottom-color: #4285f4;
            background: #f8f9fa;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
            background: #4285f4;
            margin-right: 0.75rem;
            border-radius: 2px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .metric {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 1rem;
        }

        .metric .label {
            font-size: 0.875rem;
            color: #5f6368;
            margin-bottom: 0.5rem;
        }

        .metric .value {
            font-size: 1.25rem;
            font-weight: bold;
            color: #202124;
            margin-bottom: 0.25rem;
        }

        .metric .score {
            font-size: 0.75rem;
            color: #5f6368;
        }

        .opportunities {
            margin-top: 1rem;
        }

        .opportunity {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1rem;
            border-left: 4px solid #fbbc04;
        }

        .opportunity h4 {
            color: #202124;
            margin-bottom: 0.5rem;
        }

        .opportunity .description {
            color: #5f6368;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
        }

        .opportunity .savings {
            color: #34a853;
            font-weight: 500;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #5f6368;
            font-size: 0.875rem;
        }

        .status-good { color: #34a853; }
        .status-warning { color: #fbbc04; }
        .status-error { color: #ea4335; }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .scores-grid {
                grid-template-columns: 1fr;
            }
            
            .header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <div class="logo">PS</div>
            PageSpeed Insights Report
        </h1>
        <div class="meta">
            ${new Date().toLocaleString('tr-TR')} | ${url}
        </div>
    </div>

    <div class="container">
        <div class="strategy-tabs">
            <div class="tab active" onclick="showTab('mobile')">📱 Mobile</div>
            <div class="tab" onclick="showTab('desktop')">💻 Desktop</div>
        </div>

        <!-- Mobile Tab -->
        <div id="mobile-tab" class="tab-content active">
            ${this.generateStrategyContent(mobileAnalysis, 'Mobile')}
        </div>

        <!-- Desktop Tab -->
        <div id="desktop-tab" class="tab-content">
            ${this.generateStrategyContent(desktopAnalysis, 'Desktop')}
        </div>
    </div>

    <div class="footer">
        <p>📊 PageSpeed Insights Report generated by Mercury Performance Tools</p>
        <p>Session ID: ${sessionData.sessionId} | Duration: ${Math.round(duration / 1000)}s</p>
        <p>Lighthouse Version: ${mobileAnalysis.lighthouseVersion}</p>
    </div>

    <script>
        function showTab(strategy) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(strategy + '-tab').classList.add('active');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
    }

    generateStrategyContent(analysis, strategyName) {
        const { scores, performanceMetrics, opportunities, diagnostics } = analysis;

        return `
            <!-- Performance Scores -->
            <div class="scores-grid">
                <div class="score-card">
                    <div class="score-circle" style="background: ${this.getScoreColor(scores.performance)}">
                        ${scores.performance}
                    </div>
                    <div class="score-label">Performance</div>
                    <div class="score-value">${scores.performance}</div>
                    <div class="score-status" style="color: ${this.getScoreColor(scores.performance)}">
                        ${this.getScoreLabel(scores.performance)}
                    </div>
                </div>
                
                <div class="score-card">
                    <div class="score-circle" style="background: ${this.getScoreColor(scores.accessibility)}">
                        ${scores.accessibility}
                    </div>
                    <div class="score-label">Accessibility</div>
                    <div class="score-value">${scores.accessibility}</div>
                    <div class="score-status" style="color: ${this.getScoreColor(scores.accessibility)}">
                        ${this.getScoreLabel(scores.accessibility)}
                    </div>
                </div>
                
                <div class="score-card">
                    <div class="score-circle" style="background: ${this.getScoreColor(scores.bestPractices)}">
                        ${scores.bestPractices}
                    </div>
                    <div class="score-label">Best Practices</div>
                    <div class="score-value">${scores.bestPractices}</div>
                    <div class="score-status" style="color: ${this.getScoreColor(scores.bestPractices)}">
                        ${this.getScoreLabel(scores.bestPractices)}
                    </div>
                </div>
                
                <div class="score-card">
                    <div class="score-circle" style="background: ${this.getScoreColor(scores.seo)}">
                        ${scores.seo}
                    </div>
                    <div class="score-label">SEO</div>
                    <div class="score-value">${scores.seo}</div>
                    <div class="score-status" style="color: ${this.getScoreColor(scores.seo)}">
                        ${this.getScoreLabel(scores.seo)}
                    </div>
                </div>
            </div>

            <!-- Performance Metrics -->
            <div class="section">
                <h2>⚡ Core Web Vitals & Performance Metrics</h2>
                <div class="metrics-grid">
                    ${this.generateMetricsGrid(performanceMetrics)}
                </div>
            </div>

            <!-- Opportunities -->
            ${opportunities.length > 0 ? `
            <div class="section">
                <h2>🎯 Optimization Opportunities</h2>
                <div class="opportunities">
                    ${opportunities.map(opp => `
                        <div class="opportunity">
                            <h4>${opp.title}</h4>
                            <div class="description">${opp.description}</div>
                            ${opp.displayValue ? `<div class="savings">Potential savings: ${opp.displayValue}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;
    }

    generateMetricsGrid(metrics) {
        const metricNames = {
            firstContentfulPaint: 'First Contentful Paint',
            largestContentfulPaint: 'Largest Contentful Paint',
            firstInputDelay: 'First Input Delay',
            cumulativeLayoutShift: 'Cumulative Layout Shift',
            speedIndex: 'Speed Index',
            totalBlockingTime: 'Total Blocking Time',
            timeToInteractive: 'Time to Interactive'
        };

        return Object.entries(metrics).map(([key, metric]) => {
            if (!metric) return '';
            
            return `
                <div class="metric">
                    <div class="label">${metricNames[key] || key}</div>
                    <div class="value">${metric.displayValue || 'N/A'}</div>
                    ${metric.score !== null ? `<div class="score">Score: ${Math.round(metric.score * 100)}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    getScoreColor(score) {
        if (score >= 90) return '#34a853';
        if (score >= 50) return '#fbbc04';
        return '#ea4335';
    }

    getScoreLabel(score) {
        if (score >= 90) return 'Good';
        if (score >= 50) return 'Needs improvement';
        return 'Poor';
    }
}

module.exports = PageSpeedReport; 