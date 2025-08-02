# Mercury Performance Tools ☿

Mercury Performance Tools is a comprehensive web performance analysis and monitoring tool. It collects real-time performance metrics using modern web technologies and generates detailed reports with AI-powered insights.

## 🚀 Features

### Web Performance Analysis
- **Interactive Browser Analysis**: Real browser automation with Playwright
- **Multi-Browser Support**: Chrome, Firefox, Safari, Edge
- **Full-Screen Experience**: Kiosk mode for immersive testing
- **Real-time Monitoring**: Live performance metrics collection
- **SPA Navigation Tracking**: Detects Single Page Application navigations
- **User Interaction Tracking**: Clicks, scrolls, and navigation events

### Performance Metrics
- **Page Load Time**: Complete page load duration measurement
- **Core Web Vitals**: FCP, LCP, CLS metrics calculation
- **Navigation Timing**: DNS lookup, TCP connection, server response times
- **Resource Timing**: Loading times of all resources (images, scripts, CSS)
- **Memory Usage**: Browser memory consumption tracking
- **Performance Score**: Lighthouse-like performance scoring

### Advanced Reporting
- **Mercury Performance Report**: Custom Lighthouse CI-style reports with comprehensive analysis
- **PageSpeed Insights Report**: Google PageSpeed Insights API integration
- **Gemini AI Analysis Report**: AI-powered performance analysis and recommendations
- **JSON Reports**: Raw data for programmatic analysis
- **Real-time Charts**: Live visualization of performance metrics

### Performance Score & Recommendations
- **Lighthouse-style Scoring**: 0-100 performance rating system
- **Automatic Recommendations**: AI-powered optimization suggestions
- **Critical Issues Detection**: High-priority performance problems
- **Warning Alerts**: Medium-priority optimization opportunities
- **Information Insights**: Helpful performance tips and best practices

### Resource Optimization Analysis
- **Duplicate Request Detection**: Identifies redundant network requests
- **CDN Usage Analysis**: Content Delivery Network utilization tracking
- **Compression Analysis**: Gzip/Brotli compression effectiveness
- **Caching Strategy**: Browser and server caching optimization
- **Resource Bundling**: JavaScript and CSS bundling recommendations

### Performance Timeline Analysis
- **Waterfall Charts**: Chrome DevTools-style resource loading timeline
- **Critical Rendering Path**: Performance bottleneck identification
- **First Paint Metrics**: FCP, FMP, LCP timing analysis
- **DOM Loading Events**: DOMContentLoaded and load event tracking
- **Resource Impact Assessment**: High, medium, low impact classification

### Error Analysis & Debugging
- **JavaScript Error Tracking**: Detailed error analysis with line numbers
- **Network Error Monitoring**: HTTP status codes and connection issues
- **Console Warning Analysis**: Browser console warning patterns
- **Error Pattern Recognition**: Most common error identification
- **Debugging Information**: Detailed error context and suggestions

### Security & Best Practices
- **HTTPS Usage Analysis**: Secure connection percentage tracking
- **Security Headers Check**: CSP, HSTS, X-Frame-Options validation
- **Third-party Script Analysis**: External script security assessment
- **Security Risk Assessment**: Potential security vulnerabilities
- **Best Practices Compliance**: Web security standards adherence

## 🛠️ Installation

### Requirements
- Node.js 16+ 
- npm or yarn
- Playwright browsers (automatically installed)

### Installation Steps

1. **Clone the project**
```bash
git clone <repository-url>
cd mercury-performance-tools
```

2. **Install dependencies**
```bash
npm install
```

3. **Create required directories**
```bash
mkdir -p reports data
```

4. **Set up API Keys (optional)**
```bash
# Create .env file
cp .env.example .env

# Add your API keys to .env file:
# PAGESPEED_API_KEY=your_pagespeed_api_key_here
# GEMINI_API_KEY=your_gemini_api_key_here
```

5. **Install Playwright browsers**
```bash
npx playwright install chromium firefox webkit
```

## 🚀 Usage

### Start the Application (Network Access)
```bash
npm start
```
This starts the server with network access enabled. Open `http://localhost:3000` in your browser.

**Network Access URLs:**
- Local: `http://localhost:3000`
- Network: `http://[YOUR_IP]:3000`

To see available network IP addresses:
```bash
npm run network-info
```

### Local Only Access
```bash
npm run local
```
This starts the server only for localhost access.

### Development Mode (Network Access)
```bash
npm run dev
```
This starts the development server with network access enabled.

### Local Development Mode
```bash
npm run local-dev
```
This starts the development server only for localhost access.

**Security Note:** The default `npm start` and `npm run dev` commands now enable network access. Use firewall rules to restrict access if needed.

## 📊 User Guide

### Web Performance Analysis

1. **Select Browser**: Choose Chrome, Firefox, Safari, or Edge
2. **Enter URL**: Input the website URL you want to analyze
3. **Start Analysis**: Click "Start Analysis" button
4. **Browse Interactively**: The browser opens in full-screen mode
5. **Navigate Freely**: Browse the site naturally - all interactions are tracked
6. **Stop Analysis**: Click "Stop Analysis" when finished
7. **View Results**: See detailed analysis results directly on the page
8. **Download Reports**: Get Mercury, PageSpeed, and AI analysis reports

### What Gets Tracked
- **Page Loads**: Initial page load and subsequent navigations
- **SPA Navigation**: Single Page Application route changes
- **Resource Loading**: Images, scripts, CSS, fonts, and other resources
- **Performance Metrics**: Core Web Vitals and timing data
- **User Interactions**: Clicks, scrolls, and form interactions
- **Memory Usage**: Browser memory consumption
- **Errors**: Console errors and network failures

## 🔑 API Key Setup

### Google PageSpeed Insights API
For enhanced PageSpeed Insights reports:

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Create a **new project** or select existing project
3. Enable **PageSpeed Insights API**
4. **Credentials** > **Create Credentials** > **API Key**
5. Add your API key to `.env` file:
```bash
PAGESPEED_API_KEY=your_api_key_here
```

### Google Gemini AI API
For AI-powered performance analysis:

1. Go to **Google AI Studio**: https://makersuite.google.com/app/apikey
2. Click **Create API Key** button
3. Add your API key to `.env` file:
```bash
GEMINI_API_KEY=your_api_key_here
```

### Security Notes
- `.env` file is automatically added to `.gitignore`
- Never commit API keys to git repository
- Manage environment variables securely in production

## 🔧 API Endpoints

### Web Performance
- `POST /api/web/browser/start` - Start interactive browser analysis
- `POST /api/web/browser/stop` - Stop analysis and generate reports
- `GET /api/web/browser/status/:id` - Get analysis status
- `GET /api/web/browser/report/:id` - Get analysis report
- `GET /api/web/browser/download/:id` - Download reports

### Reports
- `GET /api/reports` - List all generated reports
- `GET /api/reports/:id` - Get specific report details

### System
- `GET /api/status` - System status and health check

## 📁 Project Structure

```
mercury-performance-tools/
├── src/
│   ├── web-server.js          # Main Express server
│   └── web/
│       ├── browser-analyzer.js        # Interactive browser analysis
│       ├── performance-analyzer.js    # Headless performance analysis
│       ├── pagespeed-analyzer.js      # PageSpeed Insights integration
│       ├── gemini-analyzer.js         # Gemini AI integration
│       ├── lighthouse-ci-report.js    # Mercury performance reports
│       ├── pagespeed-report.js        # PageSpeed HTML reports
│       └── gemini-report.js           # AI analysis reports
├── public/
│   ├── index.html             # Main web interface
│   ├── css/
│   │   └── style.css          # Application styles
│   └── js/
│       ├── lib/               # Third-party libraries
│       └── app.js             # Frontend application logic
├── reports/                   # Generated reports storage
├── data/                      # Analysis data storage
├── .env                       # Environment variables
└── package.json
```

## 🎯 Supported Browsers

- **Chrome**: Full support with performance metrics
- **Firefox**: Full support with performance metrics  
- **Safari**: Full support with performance metrics
- **Edge**: Full support with performance metrics

## 📊 Report Types

### 1. Mercury Performance Report
Our comprehensive Lighthouse CI-style report featuring:
- **Performance Scores**: Overall performance rating with detailed breakdown
- **Core Web Vitals**: FCP, LCP, CLS metrics with visual indicators
- **Resource Analysis**: Detailed resource loading breakdown with optimization suggestions
- **Navigation Events**: All page visits and SPA navigations with timing data
- **Error Tracking**: Console errors and network issues with debugging information
- **Memory Usage**: Browser memory consumption data and optimization tips
- **Performance Recommendations**: AI-powered optimization suggestions with priority levels
- **Resource Optimization**: CDN usage, compression analysis, and duplicate request detection
- **Performance Timeline**: Waterfall charts and critical rendering path analysis
- **Error Analysis**: Detailed JavaScript and network error analysis with patterns
- **Security Assessment**: HTTPS usage, security headers, and third-party script analysis
- **Interactive Sorting**: Sort network requests by duration, size, status, and more
- **Show All View**: Display all network requests in a single page with comprehensive sorting

### 2. PageSpeed Insights Report
Google PageSpeed Insights API report with:
- **Mobile & Desktop Analysis**: Separate reports for both
- **Performance Scores**: Performance, Accessibility, Best Practices, SEO
- **Core Web Vitals**: Detailed metric breakdown
- **Optimization Opportunities**: Specific improvement suggestions
- **Loading Experience**: Visual loading timeline

### 3. Gemini AI Analysis Report
AI-powered intelligent analysis featuring:
- **Performance Evaluation**: Detailed performance assessment
- **Mobile vs Desktop Comparison**: Cross-device analysis
- **Optimization Recommendations**: AI-generated improvement suggestions
- **Priority Action Items**: Ranked optimization tasks
- **Performance Predictions**: AI-powered score predictions
- **Multi-language Support**: Analysis in user's preferred language

### 4. JSON Report
Raw data export for:
- **Programmatic Analysis**: Custom data processing
- **Integration**: Third-party tool integration
- **Debugging**: Detailed troubleshooting information

## 🚀 Advanced Features

### Interactive Browser Analysis
- **Real Browser Automation**: Uses actual browsers, not headless mode
- **Full-Screen Experience**: Kiosk mode for immersive testing
- **Natural User Interaction**: Real clicks, scrolls, and navigation
- **SPA Navigation Detection**: Automatic Single Page Application tracking
- **Comprehensive Data Collection**: All performance metrics captured

### AI-Powered Analysis
- **Google Gemini AI Integration**: Advanced AI analysis
- **Intelligent Performance Evaluation**: Context-aware assessment
- **Automated Recommendations**: AI-generated optimization suggestions
- **Multi-language Support**: Analysis in user's preferred language
- **Priority-based Action Plans**: Ranked improvement tasks

### Real-time Monitoring
- **Live Performance Metrics**: Real-time data collection
- **Instant Feedback**: Immediate performance insights
- **Continuous Tracking**: Ongoing metric monitoring
- **Interactive Visualization**: Live charts and graphs

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Network Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://0.0.0.0:3000

# Performance Analysis Settings
BROWSER_TIMEOUT=30000
ANALYSIS_TIMEOUT=60000
MAX_CONCURRENT_ANALYSES=5

# Report Settings
REPORTS_DIR=./reports
MAX_REPORTS=100

# Security Settings
ENABLE_CORS=true
ENABLE_HELMET=true
TRUST_PROXY=true

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# API Keys
PAGESPEED_API_KEY=your_pagespeed_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### Browser Arguments
Customize browser launch arguments in `src/web/browser-analyzer.js`:
```javascript
// Chrome arguments
args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--start-maximized',
    '--disable-web-security',
    '--kiosk' // Full screen mode
]
```

## 🐛 Troubleshooting

### Common Issues

1. **Port 3000 already in use**
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

2. **Playwright browsers not installed**
```bash
npx playwright install chromium firefox webkit
```

3. **API key errors**
```bash
# Check .env file exists and contains valid keys
cat .env
```

4. **Browser launch failures**
```bash
# Check browser installation
npx playwright install --help
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google PageSpeed Insights** for performance metrics
- **Playwright** for browser automation
- **Chart.js** for data visualization

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review troubleshooting section

---

**Mercury Performance Tools** - Professional web performance analysis made simple! ☿ 