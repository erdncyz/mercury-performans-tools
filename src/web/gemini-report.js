const fs = require('fs').promises;
const path = require('path');

class GeminiReport {
    constructor() {
        this.templateDir = path.join(__dirname, '../templates');
    }

    async generateHTMLReport(geminiAnalysis, reportData) {
        const html = this.generateHTML(geminiAnalysis, reportData);
        
        const reportsDir = path.join(__dirname, '../../reports');
        await fs.mkdir(reportsDir, { recursive: true });
        
        const filename = `gemini-ai-analysis-${reportData.sessionData.sessionId}-${Date.now()}.html`;
        const reportPath = path.join(reportsDir, filename);
        
        await fs.writeFile(reportPath, html);
        return reportPath;
    }

    generateHTML(geminiAnalysis, reportData) {
        const { sessionData } = reportData;
        const { url, browserType, startTime, endTime, duration } = sessionData;
        const { analysis, summary, recommendations, priority } = geminiAnalysis;

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini AI Performance Analysis - ${sessionData.sessionId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Google Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #202124;
            line-height: 1.6;
            min-height: 100vh;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding: 1.5rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            font-size: 1.75rem;
            font-weight: 600;
            color: #202124;
            display: flex;
            align-items: center;
        }

        .header .logo {
            width: 40px;
            height: 40px;
            margin-right: 1rem;
            background: linear-gradient(135deg, #4285f4, #34a853);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
        }

        .header .meta {
            font-size: 0.9rem;
            color: #5f6368;
            text-align: right;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .summary-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .summary-header {
            display: flex;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .summary-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #4285f4, #34a853);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            margin-right: 1rem;
        }

        .summary-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #202124;
        }

        .summary-text {
            font-size: 1.1rem;
            color: #5f6368;
            line-height: 1.7;
            margin-bottom: 1.5rem;
        }

        .priority-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .priority-high {
            background: #fce8e6;
            color: #d93025;
        }

        .priority-medium {
            background: #fef7e0;
            color: #f9ab00;
        }

        .priority-low {
            background: #e6f4ea;
            color: #137333;
        }

        .recommendations {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .recommendations h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #202124;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
        }

        .recommendations h2::before {
            content: '🎯';
            margin-right: 0.75rem;
            font-size: 1.5rem;
        }

        .recommendation-list {
            list-style: none;
        }

        .recommendation-item {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            border-left: 4px solid #4285f4;
            transition: transform 0.2s ease;
        }

        .recommendation-item:hover {
            transform: translateX(4px);
        }

        .recommendation-item::before {
            content: '💡';
            margin-right: 0.5rem;
        }

        .analysis-content {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .analysis-content h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #202124;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
        }

        .analysis-content h2::before {
            content: '🤖';
            margin-right: 0.75rem;
            font-size: 1.5rem;
        }

        .analysis-text {
            font-size: 1rem;
            color: #202124;
            line-height: 1.8;
            white-space: pre-line;
        }

        .analysis-text h3 {
            font-size: 1.25rem;
            font-weight: 600;
            color: #202124;
            margin: 2rem 0 1rem 0;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e8eaed;
        }

        .analysis-text h3:first-child {
            margin-top: 0;
        }

        .analysis-text ul {
            margin: 1rem 0;
            padding-left: 2rem;
        }

        .analysis-text li {
            margin-bottom: 0.5rem;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9rem;
        }

        .footer p {
            margin-bottom: 0.5rem;
        }

        .ai-powered {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 0.5rem 1rem;
            display: inline-block;
            margin-top: 1rem;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .summary-header {
                flex-direction: column;
                text-align: center;
            }
            
            .summary-icon {
                margin-right: 0;
                margin-bottom: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <div class="logo">AI</div>
            Gemini AI Performance Analysis
        </h1>
        <div class="meta">
            ${new Date().toLocaleString('tr-TR')}<br>
            ${url}
        </div>
    </div>

    <div class="container">
        <!-- Summary Card -->
        <div class="summary-card">
            <div class="summary-header">
                <div class="summary-icon">📊</div>
                <div>
                    <div class="summary-title">AI Analiz Özeti</div>
                    <div class="priority-badge priority-${priority}">
                        ${priority === 'high' ? 'Yüksek Öncelik' : priority === 'medium' ? 'Orta Öncelik' : 'Düşük Öncelik'}
                    </div>
                </div>
            </div>
            <div class="summary-text">
                ${summary}
            </div>
        </div>

        <!-- Recommendations -->
        ${recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Öncelikli Öneriler</h2>
            <ul class="recommendation-list">
                ${recommendations.map(rec => `
                    <li class="recommendation-item">${rec}</li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <!-- Full Analysis -->
        <div class="analysis-content">
            <h2>Detaylı AI Analizi</h2>
            <div class="analysis-text">${analysis}</div>
        </div>
    </div>

    <div class="footer">
        <p>🤖 Gemini AI tarafından analiz edildi</p>
        <p>Session ID: ${sessionData.sessionId} | Duration: ${Math.round(duration / 1000)}s</p>
        <p>Tarayıcı: ${browserType}</p>
        <div class="ai-powered">
            Powered by Google Gemini AI
        </div>
    </div>
</body>
</html>`;
    }
}

module.exports = GeminiReport; 