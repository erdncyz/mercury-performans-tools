const { chromium, firefox } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class InteractivePerformanceAnalyzer {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.analysisSession = null;
        this.metrics = {
            navigationEvents: [],
            userInteractions: [],
            performanceMetrics: {},
            resourceTiming: [],
            errors: []
        };
    }

    async initialize() {
        try {
            // macOS'ta Chrome'u doğrudan kullanmayı dene
            let browser;
            
            if (process.platform === 'darwin') {
                try {
                    // Önce Chrome'u dene
                    browser = await chromium.launch({
                        headless: false,
                        channel: 'chrome',
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--start-maximized',
                            '--disable-web-security',
                            '--disable-features=VizDisplayCompositor'
                        ]
                    });
                    console.log('Chrome başlatıldı');
                } catch (chromeError) {
                    console.log('Chrome başlatılamadı, Chromium deneniyor...', chromeError.message);
                    // Chrome bulunamazsa Chromium'u dene
                    browser = await chromium.launch({
                        headless: false,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--start-maximized',
                            '--disable-web-security'
                        ]
                    });
                    console.log('Chromium başlatıldı');
                }
            } else {
                // Diğer platformlarda normal Chromium kullan
                browser = await chromium.launch({
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--start-maximized',
                        '--disable-web-security'
                    ]
                });
            }
            
            this.browser = browser;

            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            this.page = await this.context.newPage();
            
            // Performance event listener'ları ekle
            await this.setupPerformanceListeners();
            
            console.log('Interactive Performance Analyzer başlatıldı');
            return true;
        } catch (error) {
            console.error('Interactive Performance Analyzer başlatılamadı:', error);
            return false;
        }
    }

    async setupPerformanceListeners() {
        // Navigation events
        this.page.on('load', () => {
            this.metrics.navigationEvents.push({
                type: 'page_load',
                timestamp: Date.now(),
                url: this.page.url()
            });
            console.log('Sayfa yüklendi:', this.page.url());
        });

        this.page.on('domcontentloaded', () => {
            this.metrics.navigationEvents.push({
                type: 'dom_content_loaded',
                timestamp: Date.now(),
                url: this.page.url()
            });
        });

        // Network events
        this.page.on('response', (response) => {
            const url = response.url();
            const status = response.status();
            
            if (status === 200) {
                this.metrics.resourceTiming.push({
                    url: url,
                    status: status,
                    timestamp: Date.now(),
                    size: response.headers()['content-length'] || 0
                });
            }
        });

        // Error events
        this.page.on('pageerror', (error) => {
            this.metrics.errors.push({
                type: 'page_error',
                message: error.message,
                timestamp: Date.now(),
                url: this.page.url()
            });
        });

        // Console events
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.metrics.errors.push({
                    type: 'console_error',
                    message: msg.text(),
                    timestamp: Date.now(),
                    url: this.page.url()
                });
            }
        });
    }

    async startInteractiveAnalysis(url) {
        if (!this.page) {
            throw new Error('Analyzer başlatılmamış. Önce initialize() çağırın.');
        }

        this.analysisSession = {
            id: Date.now().toString(),
            startTime: Date.now(),
            url: url,
            status: 'active'
        };

        // Metrikleri sıfırla
        this.metrics = {
            navigationEvents: [],
            userInteractions: [],
            performanceMetrics: {},
            resourceTiming: [],
            errors: []
        };

        try {
            console.log(`İnteraktif analiz başlatılıyor: ${url}`);
            
            // Siteyi aç
            await this.page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // İlk performans metriklerini al
            await this.capturePerformanceMetrics();

            return {
                sessionId: this.analysisSession.id,
                url: url,
                status: 'started',
                message: 'Site açıldı. Şimdi gezinmeye başlayabilirsiniz. Analizi bitirmek için "Analizi Bitir" butonuna tıklayın.'
            };

        } catch (error) {
            this.metrics.errors.push({
                type: 'startup_error',
                message: error.message,
                timestamp: Date.now()
            });
            
            throw new Error(`Analiz başlatılamadı: ${error.message}`);
        }
    }

    async capturePerformanceMetrics() {
        try {
            const metrics = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                const resources = performance.getEntriesByType('resource');
                
                return {
                    // Navigation timing
                    dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
                    tcpConnection: navigation.connectEnd - navigation.connectStart,
                    serverResponse: navigation.responseEnd - navigation.requestStart,
                    domParsing: navigation.domContentLoadedEventEnd - navigation.responseEnd,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
                    pageLoad: navigation.loadEventEnd - navigation.navigationStart,
                    
                    // Paint timing
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                    
                    // Resource timing
                    resourceCount: resources.length,
                    totalResourceSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                    
                    // Memory usage
                    memory: performance.memory ? {
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    } : null
                };
            });

            this.metrics.performanceMetrics = {
                ...this.metrics.performanceMetrics,
                [Date.now()]: metrics
            };

        } catch (error) {
            console.error('Performans metrikleri alınamadı:', error);
        }
    }

    async endInteractiveAnalysis() {
        if (!this.analysisSession || this.analysisSession.status !== 'active') {
            throw new Error('Aktif analiz oturumu bulunamadı.');
        }

        try {
            // Son performans metriklerini al
            await this.capturePerformanceMetrics();

            // Analiz oturumunu sonlandır
            this.analysisSession.endTime = Date.now();
            this.analysisSession.status = 'completed';
            this.analysisSession.duration = this.analysisSession.endTime - this.analysisSession.startTime;

            // Sonuçları hazırla
            const results = {
                sessionId: this.analysisSession.id,
                url: this.analysisSession.url,
                startTime: new Date(this.analysisSession.startTime).toISOString(),
                endTime: new Date(this.analysisSession.endTime).toISOString(),
                duration: this.analysisSession.duration,
                navigationEvents: this.metrics.navigationEvents,
                resourceTiming: this.metrics.resourceTiming,
                errors: this.metrics.errors,
                performanceMetrics: this.metrics.performanceMetrics,
                summary: this.generateSummary()
            };

            console.log(`İnteraktif analiz tamamlandı: ${this.analysisSession.url}`);
            return results;

        } catch (error) {
            this.metrics.errors.push({
                type: 'end_analysis_error',
                message: error.message,
                timestamp: Date.now()
            });
            
            throw new Error(`Analiz sonlandırılamadı: ${error.message}`);
        }
    }

    generateSummary() {
        const performanceEntries = Object.values(this.metrics.performanceMetrics);
        const lastMetrics = performanceEntries[performanceEntries.length - 1] || {};
        
        return {
            totalNavigationEvents: this.metrics.navigationEvents.length,
            totalResources: this.metrics.resourceTiming.length,
            totalErrors: this.metrics.errors.length,
            averagePageLoadTime: performanceEntries.length > 0 
                ? performanceEntries.reduce((sum, m) => sum + (m.pageLoad || 0), 0) / performanceEntries.length 
                : 0,
            averageFirstContentfulPaint: performanceEntries.length > 0
                ? performanceEntries.reduce((sum, m) => sum + (m.firstContentfulPaint || 0), 0) / performanceEntries.length
                : 0,
            totalResourceSize: this.metrics.resourceTiming.reduce((sum, r) => sum + (r.size || 0), 0),
            lastPageLoadTime: lastMetrics.pageLoad || 0,
            lastFirstContentfulPaint: lastMetrics.firstContentfulPaint || 0
        };
    }

    async generateReport(results, format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `interactive-performance-report-${timestamp}`;

        switch (format.toLowerCase()) {
            case 'json':
                const jsonPath = path.join(process.cwd(), 'reports', `${filename}.json`);
                await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
                return jsonPath;

            case 'csv':
                const csvPath = path.join(process.cwd(), 'reports', `${filename}.csv`);
                const csvContent = this.convertToCSV(results);
                await fs.writeFile(csvPath, csvContent);
                return csvPath;

            default:
                throw new Error(`Desteklenmeyen format: ${format}`);
        }
    }

    convertToCSV(results) {
        const headers = [
            'Session ID',
            'URL',
            'Start Time',
            'End Time',
            'Duration (ms)',
            'Navigation Events',
            'Resources',
            'Errors',
            'Avg Page Load (ms)',
            'Avg FCP (ms)',
            'Total Resource Size (bytes)'
        ];

        const row = [
            results.sessionId,
            results.url,
            results.startTime,
            results.endTime,
            results.duration,
            results.summary.totalNavigationEvents,
            results.summary.totalResources,
            results.summary.totalErrors,
            Math.round(results.summary.averagePageLoadTime),
            Math.round(results.summary.averageFirstContentfulPaint),
            results.summary.totalResourceSize
        ];

        return [headers.join(','), row.join(',')].join('\n');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('Interactive Performance Analyzer kapatıldı');
        }
    }
}

module.exports = InteractivePerformanceAnalyzer; 