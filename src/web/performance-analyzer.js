const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class WebPerformanceAnalyzer {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.metrics = {
            navigationTiming: {},
            resourceTiming: [],
            performanceMetrics: {},
            lighthouseMetrics: {}
        };
    }

    async initialize() {
        try {
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            this.page = await this.context.newPage();
            
            // Performance event listener'ları ekle
            await this.setupPerformanceListeners();
            
            console.log('Web Performance Analyzer initialized');
            return true;
        } catch (error) {
            console.error('Web Performance Analyzer başlatılamadı:', error);
            return false;
        }
    }

    async setupPerformanceListeners() {
        // Navigation timing events
        this.page.on('load', () => {
            console.log('Sayfa yüklendi');
        });

        this.page.on('domcontentloaded', () => {
            console.log('DOM içeriği yüklendi');
        });

        // Network events
        this.page.on('response', (response) => {
            const url = response.url();
            const status = response.status();
            const headers = response.headers();
            
            if (status === 200) {
                console.log(`Resource loaded: ${url}`);
            }
        });
    }

    async analyzePerformance(url, options = {}) {
        if (!this.page) {
            throw new Error('Analyzer başlatılmamış. Önce initialize() çağırın.');
        }

        const startTime = Date.now();
        const results = {
            url,
            timestamp: new Date().toISOString(),
            navigationTiming: {},
            resourceTiming: [],
            performanceMetrics: {},
            lighthouseMetrics: {},
            errors: []
        };

        try {
            console.log(`Analiz başlatılıyor: ${url}`);

            // Sayfa yükleme süresini ölç
            const navigationStart = Date.now();
            const response = await this.page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            const navigationEnd = Date.now();

            // Navigation timing bilgilerini al
            const navigationTiming = await this.page.evaluate(() => {
                const timing = performance.timing;
                return {
                    navigationStart: timing.navigationStart,
                    fetchStart: timing.fetchStart,
                    domainLookupStart: timing.domainLookupStart,
                    domainLookupEnd: timing.domainLookupEnd,
                    connectStart: timing.connectStart,
                    connectEnd: timing.connectEnd,
                    requestStart: timing.requestStart,
                    responseStart: timing.responseStart,
                    responseEnd: timing.responseEnd,
                    domLoading: timing.domLoading,
                    domInteractive: timing.domInteractive,
                    domContentLoadedEventStart: timing.domContentLoadedEventStart,
                    domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                    domComplete: timing.domComplete,
                    loadEventStart: timing.loadEventStart,
                    loadEventEnd: timing.loadEventEnd
                };
            });

            // Performance metrics
            const performanceMetrics = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                
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
                    resourceCount: performance.getEntriesByType('resource').length
                };
            });

            // Resource timing bilgilerini al
            const resourceTiming = await this.page.evaluate(() => {
                const resources = performance.getEntriesByType('resource');
                return resources.map(resource => ({
                    name: resource.name,
                    entryType: resource.entryType,
                    startTime: resource.startTime,
                    duration: resource.duration,
                    initiatorType: resource.initiatorType,
                    transferSize: resource.transferSize,
                    encodedBodySize: resource.encodedBodySize,
                    decodedBodySize: resource.decodedBodySize
                }));
            });

            // Lighthouse benzeri metrikler
            const lighthouseMetrics = await this.calculateLighthouseMetrics();

            results.navigationTiming = navigationTiming;
            results.performanceMetrics = performanceMetrics;
            results.resourceTiming = resourceTiming;
            results.lighthouseMetrics = lighthouseMetrics;
            results.totalAnalysisTime = Date.now() - startTime;

            console.log(`Analiz tamamlandı: ${url}`);
            return results;

        } catch (error) {
            results.errors.push(error.message);
            console.error(`Analiz hatası: ${error.message}`);
            return results;
        }
    }

    async calculateLighthouseMetrics() {
        try {
            const metrics = await this.page.evaluate(() => {
                // Core Web Vitals benzeri metrikler
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                const resources = performance.getEntriesByType('resource');
                
                // First Contentful Paint
                const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
                
                // Largest Contentful Paint (basit hesaplama)
                const lcp = Math.max(...resources.map(r => r.startTime + r.duration));
                
                // Cumulative Layout Shift (basit hesaplama)
                const cls = 0; // Gerçek CLS hesaplaması daha karmaşık
                
                // First Input Delay (basit hesaplama)
                const fid = navigation.domInteractive - navigation.domContentLoadedEventEnd;
                
                // Time to Interactive
                const tti = navigation.domInteractive;
                
                // Speed Index (basit hesaplama)
                const speedIndex = fcp + (lcp - fcp) * 0.5;
                
                return {
                    firstContentfulPaint: fcp,
                    largestContentfulPaint: lcp,
                    cumulativeLayoutShift: cls,
                    firstInputDelay: fid,
                    timeToInteractive: tti,
                    speedIndex: speedIndex,
                    
                    // Performance skorları (basit hesaplama)
                    performanceScore: Math.max(0, 100 - (fcp / 10) - (lcp / 25)),
                    accessibilityScore: 95, // Basit varsayım
                    bestPracticesScore: 90, // Basit varsayım
                    seoScore: 85 // Basit varsayım
                };
            });

            return metrics;
        } catch (error) {
            console.error('Lighthouse metrikleri hesaplanamadı:', error);
            return {};
        }
    }

    async generateReport(results, format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance-report-${timestamp}`;

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
            'URL',
            'Timestamp',
            'DNS Lookup (ms)',
            'TCP Connection (ms)',
            'Server Response (ms)',
            'DOM Parsing (ms)',
            'Page Load (ms)',
            'First Contentful Paint (ms)',
            'Largest Contentful Paint (ms)',
            'Performance Score'
        ];

        const row = [
            results.url,
            results.timestamp,
            results.performanceMetrics.dnsLookup || 0,
            results.performanceMetrics.tcpConnection || 0,
            results.performanceMetrics.serverResponse || 0,
            results.performanceMetrics.domParsing || 0,
            results.performanceMetrics.pageLoad || 0,
            results.lighthouseMetrics.firstContentfulPaint || 0,
            results.lighthouseMetrics.largestContentfulPaint || 0,
            results.lighthouseMetrics.performanceScore || 0
        ];

        return [headers.join(','), row.join(',')].join('\n');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('Web Performance Analyzer kapatıldı');
        }
    }
}

module.exports = WebPerformanceAnalyzer; 