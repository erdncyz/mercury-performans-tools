# Mercury Performance Tools ☿

Mercury Performance Tools is a comprehensive performance analysis and monitoring tool for websites and mobile applications. It collects real-time performance metrics using modern web technologies and generates detailed reports.

## 🚀 Features

### Web Performance Analysis
- **Page Load Time**: Measures complete page load duration
- **Core Web Vitals**: Calculates FCP, LCP, CLS metrics
- **Navigation Timing**: Analyzes DNS lookup, TCP connection, server response times
- **Resource Timing**: Tracks loading times of all resources
- **Performance Score**: Calculates Lighthouse-like performance score

### Mobile Performance Monitoring
- **Android Device Support**: Automatically detects Android devices connected via ADB
- **CPU Usage**: Monitors real-time CPU usage rate
- **Memory Usage**: Tracks RAM usage
- **Battery Monitoring**: Battery level and temperature monitoring
- **FPS Tracking**: Measures frame rate performance
- **App Performance**: Analyzes application startup and runtime performance

### Reporting
- **JSON Reports**: Detailed reports in JSON format
- **Mercury Performance Report**: Our own Lighthouse CI-style reports
- **PageSpeed Insights Report**: Google PageSpeed Insights API reports
- **Gemini AI Analysis Report**: AI-powered detailed analysis reports
- **CSV Export**: Excel-compatible CSV reports
- **Real-time Charts**: Live charts and metrics

## 🛠️ Installation

### Requirements
- Node.js 16+ 
- npm or yarn
- Android SDK (for mobile analysis)
- ADB (Android Debug Bridge)

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

5. **Android SDK installation (optional)**
```bash
# Comes with Android Studio
# Or command line tools only:
# https://developer.android.com/studio#command-tools
```

## 🚀 Usage

### Web Application
```bash
npm start
```
Open `http://localhost:3000` in your browser.

### Development Mode
```bash
npm run dev
```

## 📊 User Guide

### Web Performance Analysis

1. Go to the **Web Performance** tab
2. Enter the URL you want to analyze
3. Click **Start Analysis** button
4. View results in charts
5. Download reports in your preferred format

### Mobile Performance Monitoring

1. Go to the **Mobile Performance** tab
2. Connect your Android device via USB
3. Click **Refresh Devices** button
4. Select your device
5. Choose the application you want to monitor
6. Click **Start Monitoring** button
7. Track real-time metrics

### Dashboard

- **System Status**: Shows status of Web and Android analyzers
- **Recent Reports**: List of generated reports
- **Quick Access**: Frequently used operations

## 🔑 API Key Setup

### Google PageSpeed Insights API
Google API key is required for PageSpeed Insights reports:

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Create a **new project** or select existing project
3. Enable **PageSpeed Insights API**
4. **Credentials** > **Create Credentials** > **API Key**
5. Add your API key to `.env` file:
```bash
PAGESPEED_API_KEY=your_api_key_here
```

### Google Gemini AI API
Gemini API key is required for AI-powered analysis reports:

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
- `GET /api/web/analyze` - Start web performance analysis
- `GET /api/web/status/:id` - Get analysis status
- `GET /api/web/report/:id` - Get analysis report
- `GET /api/web/download/:id` - Download report

### Mobile Performance
- `GET /api/android/devices` - List connected devices
- `POST /api/android/select-device` - Select device for monitoring
- `GET /api/android/apps` - List installed apps
- `POST /api/android/start-monitoring` - Start performance monitoring
- `GET /api/android/status/:id` - Get monitoring status
- `GET /api/android/report/:id` - Get monitoring report

### Reports
- `GET /api/reports` - List all generated reports
- `GET /api/reports/:id` - Get specific report details

## 📁 Project Structure

```
mercury-performance-tools/
├── src/
│   ├── web-server.js          # Main server file
│   ├── web/
│   │   ├── performance-analyzer.js
│   │   ├── browser-analyzer.js
│   │   ├── pagespeed-analyzer.js
│   │   ├── gemini-analyzer.js
│   │   ├── lighthouse-ci-report.js
│   │   ├── pagespeed-report.js
│   │   └── gemini-report.js
│   └── mobile/
│       └── android-analyzer.js
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
├── reports/                   # Generated reports
├── data/                      # Analysis data
├── .env                       # Environment variables
└── package.json
```

## 🎯 Supported Browsers

- **Chrome**: Full support with performance metrics
- **Firefox**: Full support with performance metrics
- **Safari**: Full support with performance metrics
- **Edge**: Full support with performance metrics

## 📊 Report Types

### 1. JSON Report
Raw data in JSON format for programmatic analysis.

### 2. Mercury Performance Report
Our own Lighthouse CI-style report with:
- Performance scores
- Core Web Vitals
- Resource analysis
- Error tracking
- Navigation events

### 3. PageSpeed Insights Report
Google PageSpeed Insights API report with:
- Mobile and Desktop analysis
- Performance scores (Performance, Accessibility, Best Practices, SEO)
- Core Web Vitals metrics
- Optimization opportunities
- Loading experience data

### 4. Gemini AI Analysis Report
AI-powered analysis report with:
- Detailed performance evaluation
- Mobile vs Desktop comparison
- Optimization recommendations
- Priority action items
- Performance score predictions

## 🚀 Advanced Features

### Interactive Browser Analysis
- Real browser automation with Playwright
- Full-screen browser experience
- User interaction tracking
- SPA navigation detection
- Comprehensive performance data collection

### AI-Powered Analysis
- Google Gemini AI integration
- Intelligent performance evaluation
- Automated recommendations
- Multi-language support (AI responds in user's preferred language)
- Priority-based action plans

### Real-time Monitoring
- Live performance metrics
- Real-time charts and graphs
- Instant alerting
- Continuous monitoring capabilities

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

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
npx playwright install chromium
```

3. **ADB not found**
```bash
# Install Android SDK and add to PATH
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

4. **API key errors**
```bash
# Check .env file exists and contains valid keys
cat .env
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google PageSpeed Insights** for performance metrics
- **Google Gemini AI** for intelligent analysis
- **Playwright** for browser automation
- **Chart.js** for data visualization

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review troubleshooting section

---

**Mercury Performance Tools** - Professional web and mobile performance analysis made simple! ☿ 