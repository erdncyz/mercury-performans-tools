const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const LighthouseCIReport = require('./lighthouse-ci-report');
const PageSpeedAnalyzer = require('./pagespeed-analyzer');
const PageSpeedReport = require('./pagespeed-report');

class BrowserAnalyzer {
    constructor() {
        this.sessions = new Map();
        this.browsers = new Map();
        this.lighthouseCIReport = new LighthouseCIReport();
        this.pageSpeedAnalyzer = new PageSpeedAnalyzer();
        this.pageSpeedReport = new PageSpeedReport();
    }

    async startAnalysis(url, browserType) {
        try {
            console.log(`${browserType} tarayıcısı başlatılıyor...`);
            
            const sessionId = Date.now().toString();
            const browser = await this.launchBrowser(browserType);
            
            if (!browser) {
                throw new Error(`${browserType} tarayıcısı başlatılamadı`);
            }
            
            const context = await browser.newContext({
                viewport: null, // Tam ekran için viewport'u kaldır
                userAgent: this.getUserAgent(browserType),
                ignoreHTTPSErrors: true
            });
            
            const page = await context.newPage();
            
            // Performance listeners ekle
            await this.setupPerformanceListeners(page);
            
            // Session bilgilerini kaydet
            this.sessions.set(sessionId, {
                browserType,
                browser,
                context,
                page,
                url,
                startTime: Date.now(),
                status: 'active',
                metrics: {
                    navigationEvents: [],
                    resourceTiming: [],
                    errors: [],
                    userInteractions: [],
                    consoleLogs: [],
                    clicks: [],
                    memoryUsage: [],
                    cpuUsage: []
                }
            });
            
            // Sayfayı aç (daha güvenli timeout ile)
            try {
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });
                console.log(`${browserType} tarayıcısı açıldı ve ${url} yüklendi`);
                
                // Tam ekran yap
                try {
                    await page.evaluate(() => {
                        if (document.documentElement.requestFullscreen) {
                            document.documentElement.requestFullscreen();
                        } else if (document.documentElement.webkitRequestFullscreen) {
                            document.documentElement.webkitRequestFullscreen();
                        } else if (document.documentElement.msRequestFullscreen) {
                            document.documentElement.msRequestFullscreen();
                        }
                    });
                    console.log('Tam ekran modu aktif');
                } catch (fullscreenError) {
                    console.log('Tam ekran modu aktif değil, normal modda devam ediliyor');
                }
                
                // Sayfa yüklendikten sonra ek veri topla
                await this.collectAdditionalData(page, sessionId);
                
            } catch (navigationError) {
                console.warn('Sayfa yükleme hatası, devam ediliyor:', navigationError.message);
                // Hata olsa bile devam et
            }
            
            return sessionId;
            
        } catch (error) {
            console.error('Browser analizi başlatma hatası:', error);
            
            // Hata durumunda temizlik yap
            try {
                const browser = this.browsers.get(sessionId);
                if (browser) {
                    await browser.close();
                    this.browsers.delete(sessionId);
                }
            } catch (cleanupError) {
                console.error('Temizlik hatası:', cleanupError);
            }
            
            throw error;
        }
    }

    async launchBrowser(browserType) {
        try {
            switch (browserType.toLowerCase()) {
                case 'chrome':
                    return await chromium.launch({
                        headless: false,
                        channel: 'chrome',
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--start-maximized',
                            '--disable-web-security',
                            '--kiosk' // Tam ekran modu
                        ]
                    });
                
                case 'firefox':
                    return await firefox.launch({
                        headless: false,
                        args: [
                            '--no-sandbox',
                            '--disable-dev-shm-usage',
                            '--kiosk' // Tam ekran modu
                        ]
                    });
                
                case 'safari':
                    return await webkit.launch({
                        headless: false,
                        args: [
                            '--kiosk' // Tam ekran modu
                        ]
                    });
                
                case 'edge':
                    return await chromium.launch({
                        headless: false,
                        channel: 'msedge',
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--start-maximized',
                            '--kiosk' // Tam ekran modu
                        ]
                    });
                
                default:
                    throw new Error(`Desteklenmeyen tarayıcı: ${browserType}`);
            }
        } catch (error) {
            console.error(`${browserType} başlatma hatası:`, error);
            
            // Fallback olarak Chromium dene
            if (browserType !== 'chrome') {
                console.log('Fallback olarak Chromium deneniyor...');
                return await chromium.launch({
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--start-maximized'
                    ]
                });
            }
            
            throw error;
        }
    }

    getUserAgent(browserType) {
        const userAgents = {
            chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
        };
        
        return userAgents[browserType.toLowerCase()] || userAgents.chrome;
    }

    async setupPerformanceListeners(page) {
        const session = this.getSessionByPage(page);
        if (!session) return;

        // Navigation events with detailed timing
        page.on('load', async () => {
            try {
                console.log('Sayfa yüklendi, veri toplanıyor:', page.url());
                
                const performanceMetrics = await page.evaluate(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    const paint = performance.getEntriesByType('paint');
                    const resources = performance.getEntriesByType('resource');
                    
                    return {
                        pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                        resources: resources.map(r => ({
                            name: r.name,
                            duration: r.duration,
                            size: r.transferSize || 0,
                            type: r.initiatorType
                        }))
                    };
                });

                session.metrics.navigationEvents.push({
                    type: 'page_load',
                    timestamp: Date.now(),
                    url: page.url(),
                    loadTime: performanceMetrics.pageLoadTime,
                    domContentLoaded: performanceMetrics.domContentLoaded,
                    firstPaint: performanceMetrics.firstPaint,
                    firstContentfulPaint: performanceMetrics.firstContentfulPaint
                });

                // Add resource timing data
                performanceMetrics.resources.forEach(resource => {
                    session.metrics.resourceTiming.push({
                        url: resource.name,
                        duration: resource.duration,
                        size: resource.size,
                        type: resource.type,
                        timestamp: Date.now()
                    });
                });

                console.log('Sayfa yüklendi:', page.url(), 'Load time:', performanceMetrics.pageLoadTime, 'ms');
                console.log('Toplanan kaynak sayısı:', performanceMetrics.resources.length);
            } catch (error) {
                console.error('Performance metrics toplama hatası:', error);
            }
        });

        // DOM content loaded event
        page.on('domcontentloaded', () => {
            console.log('DOM yüklendi:', page.url());
            session.metrics.navigationEvents.push({
                type: 'dom_content_loaded',
                timestamp: Date.now(),
                url: page.url()
            });
        });

        // Sayfa değişikliklerini takip et (SPA navigation dahil)
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                console.log('Sayfa değişti:', frame.url());
                session.metrics.navigationEvents.push({
                    type: 'navigation',
                    timestamp: Date.now(),
                    url: frame.url()
                });
            }
        });

        // SPA navigation için history API değişikliklerini dinle
        await page.evaluateOnNewDocument(() => {
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function(...args) {
                originalPushState.apply(this, args);
                window.dispatchEvent(new CustomEvent('spa-navigation', {
                    detail: { url: window.location.href, type: 'pushstate' }
                }));
            };
            
            history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                window.dispatchEvent(new CustomEvent('spa-navigation', {
                    detail: { url: window.location.href, type: 'replacestate' }
                }));
            };
            
            window.addEventListener('popstate', () => {
                window.dispatchEvent(new CustomEvent('spa-navigation', {
                    detail: { url: window.location.href, type: 'popstate' }
                }));
            });
        });

        // SPA navigation event'lerini dinle
        page.on('console', async (msg) => {
            if (msg.text().includes('spa-navigation')) {
                const url = await page.evaluate(() => window.location.href);
                console.log('SPA Navigation:', url);
                session.metrics.navigationEvents.push({
                    type: 'spa_navigation',
                    timestamp: Date.now(),
                    url: url
                });
            }
        });

        // Link tıklamalarını takip et
        await page.evaluateOnNewDocument(() => {
            document.addEventListener('click', (event) => {
                const link = event.target.closest('a');
                if (link && link.href) {
                    console.log('Link tıklandı:', link.href);
                    window.dispatchEvent(new CustomEvent('link-click', {
                        detail: { url: link.href, text: link.textContent }
                    }));
                }
            });
        });

        // Link tıklama event'lerini dinle
        page.on('console', async (msg) => {
            if (msg.text().includes('Link tıklandı:')) {
                const url = msg.text().split('Link tıklandı:')[1].trim();
                console.log('Link tıklama kaydedildi:', url);
                session.metrics.userInteractions.push({
                    type: 'link_click',
                    timestamp: Date.now(),
                    url: url
                });
            }
        });

        // DOM değişikliklerini takip et
        page.on('domcontentloaded', () => {
            console.log('DOM yüklendi:', page.url());
            session.metrics.navigationEvents.push({
                type: 'dom_content_loaded',
                timestamp: Date.now(),
                url: page.url()
            });
        });

        page.on('domcontentloaded', () => {
            session.metrics.navigationEvents.push({
                type: 'dom_content_loaded',
                timestamp: Date.now(),
                url: page.url()
            });
        });

        // Network events with detailed information
        page.on('response', async (response) => {
            const url = response.url();
            const status = response.status();
            const headers = response.headers();
            
            try {
                const size = parseInt(headers['content-length']) || 0;
                const contentType = headers['content-type'] || '';
                
                session.metrics.resourceTiming.push({
                    url: url,
                    status: status,
                    size: size,
                    contentType: contentType,
                    timestamp: Date.now(),
                    duration: 0
                });
                
                console.log('Kaynak yüklendi:', url, 'Status:', status, 'Size:', size);
            } catch (error) {
                console.warn('Response processing error:', error.message);
            }
        });

        // Request finished event for timing
        page.on('requestfinished', async (request) => {
            const url = request.url();
            const resource = session.metrics.resourceTiming.find(r => r.url === url);
            if (resource) {
                resource.duration = request.timing()?.totalTime || 0;
                console.log('Kaynak tamamlandı:', url, 'Duration:', resource.duration, 'ms');
            }
        });

        // Error events with more details
        page.on('pageerror', (error) => {
            session.metrics.errors.push({
                type: 'page_error',
                message: error.message,
                stack: error.stack,
                timestamp: Date.now(),
                url: page.url()
            });
            console.error('Page error:', error.message);
        });

        page.on('console', (msg) => {
            const type = msg.type();
            const text = msg.text();
            
            session.metrics.consoleLogs = session.metrics.consoleLogs || [];
            session.metrics.consoleLogs.push({
                type: type,
                message: text,
                timestamp: Date.now(),
                url: page.url()
            });

            if (type === 'error') {
                session.metrics.errors.push({
                    type: 'console_error',
                    message: text,
                    timestamp: Date.now(),
                    url: page.url()
                });
            }
        });

        // User interactions with coordinates
        page.on('click', async (event) => {
            session.metrics.clicks = session.metrics.clicks || [];
            session.metrics.clicks.push({
                type: 'click',
                timestamp: Date.now(),
                url: page.url(),
                coordinates: { x: event.clientX, y: event.clientY }
            });
            console.log('Tıklama kaydedildi:', page.url(), 'Koordinatlar:', event.clientX, event.clientY);
        });

        // Sayfa gezinmelerini takip et
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                session.metrics.userInteractions = session.metrics.userInteractions || [];
                session.metrics.userInteractions.push({
                    type: 'navigation',
                    timestamp: Date.now(),
                    url: frame.url()
                });
                console.log('Gezinme kaydedildi:', frame.url());
            }
        });

        // URL değişikliklerini sürekli takip et
        setInterval(async () => {
            try {
                const currentUrl = page.url();
                const lastNavigation = session.metrics.navigationEvents[session.metrics.navigationEvents.length - 1];
                
                if (lastNavigation && lastNavigation.url !== currentUrl) {
                    console.log('URL değişikliği tespit edildi:', currentUrl);
                    session.metrics.navigationEvents.push({
                        type: 'url_change',
                        timestamp: Date.now(),
                        url: currentUrl
                    });
                }
            } catch (error) {
                // Sayfa kapalı olabilir
            }
        }, 1000);

        // Scroll events
        page.on('scroll', () => {
            session.metrics.userInteractions = session.metrics.userInteractions || [];
            session.metrics.userInteractions.push({
                type: 'scroll',
                timestamp: Date.now(),
                url: page.url()
            });
        });
    }

    getSessionByPage(page) {
        for (const [sessionId, session] of this.sessions) {
            if (session.page === page) {
                return session;
            }
        }
        return null;
    }

    async collectAdditionalData(page, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        try {
            // Sayfa yüklendikten sonra 2 saniye bekle ve veri topla
            await page.waitForTimeout(2000);

            const additionalData = await page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                const resources = performance.getEntriesByType('resource');
                const memory = performance.memory;
                
                return {
                    navigation: navigation ? {
                        loadEventEnd: navigation.loadEventEnd,
                        loadEventStart: navigation.loadEventStart,
                        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
                        domContentLoadedEventStart: navigation.domContentLoadedEventStart,
                        fetchStart: navigation.fetchStart,
                        domainLookupStart: navigation.domainLookupStart,
                        domainLookupEnd: navigation.domainLookupEnd,
                        connectStart: navigation.connectStart,
                        connectEnd: navigation.connectEnd,
                        requestStart: navigation.requestStart,
                        responseStart: navigation.responseStart,
                        responseEnd: navigation.responseEnd,
                        domLoading: navigation.domLoading,
                        domInteractive: navigation.domInteractive,
                        domContentLoaded: navigation.domContentLoaded,
                        domComplete: navigation.domComplete
                    } : null,
                    paint: paint.map(p => ({
                        name: p.name,
                        startTime: p.startTime
                    })),
                    resources: resources.map(r => ({
                        name: r.name,
                        duration: r.duration,
                        transferSize: r.transferSize,
                        decodedBodySize: r.decodedBodySize,
                        initiatorType: r.initiatorType,
                        nextHopProtocol: r.nextHopProtocol
                    })),
                    memory: memory ? {
                        usedJSHeapSize: memory.usedJSHeapSize,
                        totalJSHeapSize: memory.totalJSHeapSize,
                        jsHeapSizeLimit: memory.jsHeapSizeLimit
                    } : null,
                    timing: {
                        navigationStart: performance.timing.navigationStart,
                        loadEventEnd: performance.timing.loadEventEnd,
                        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
                    }
                };
            });

            // Navigation events'e ekle
            if (additionalData.navigation) {
                session.metrics.navigationEvents.push({
                    type: 'detailed_navigation',
                    timestamp: Date.now(),
                    url: page.url(),
                    data: additionalData.navigation
                });
            }

            // Resource timing'e ekle
            additionalData.resources.forEach(resource => {
                session.metrics.resourceTiming.push({
                    url: resource.name,
                    duration: resource.duration,
                    size: resource.transferSize || 0,
                    decodedSize: resource.decodedBodySize || 0,
                    type: resource.initiatorType,
                    protocol: resource.nextHopProtocol,
                    timestamp: Date.now()
                });
            });

            // Memory usage'a ekle
            if (additionalData.memory) {
                session.metrics.memoryUsage.push({
                    ...additionalData.memory,
                    timestamp: Date.now()
                });
            }

            console.log('Ek veri toplandı:', {
                resources: additionalData.resources.length,
                memory: !!additionalData.memory,
                navigation: !!additionalData.navigation
            });

        } catch (error) {
            console.error('Ek veri toplama hatası:', error);
        }
    }

    async stopAnalysis(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error('Session bulunamadı');
            }

            console.log('Analiz durduruluyor:', sessionId);
            
            session.status = 'completed';
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;

            // Performance metrics topla
            const performanceMetrics = await session.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                const paint = performance.getEntriesByType('paint');
                
                return {
                    pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                    domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                };
            });

            session.metrics.performanceMetrics = performanceMetrics;

            // Browser'ı kapat
            await session.context.close();
            await session.browser.close();

            console.log('Analiz tamamlandı:', sessionId);
            
            // Session verilerini hazırla
            const reportData = {
                sessionId,
                browserType: session.browserType,
                url: session.url,
                startTime: session.startTime,
                endTime: session.endTime,
                duration: session.duration,
                metrics: session.metrics
            };

            // Session'ı silmeden önce raporu oluştur
            try {
                await this.generateReportWithData(reportData);
            } catch (reportError) {
                console.warn('Rapor oluşturma hatası (ignored):', reportError.message);
            }
            
            // Session'ı temizle
            this.sessions.delete(sessionId);
            
            return reportData;
            
        } catch (error) {
            console.error('Analiz durdurma hatası:', error);
            throw error;
        }
    }

    async getStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { status: 'not_found', message: 'Session bulunamadı' };
        }

        return {
            status: session.status,
            startTime: session.startTime,
            duration: session.duration || 0,
            url: session.url,
            browserType: session.browserType
        };
    }

    async getReport(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            // Session bulunamadıysa, rapor dosyalarından oku
            try {
                const reportsDir = path.join(__dirname, '../../reports');
                const files = await fs.readdir(reportsDir);
                const sessionFile = files.find(file => file.includes(`browser-analysis-${sessionId}`));
                
                if (sessionFile) {
                    const filePath = path.join(reportsDir, sessionFile);
                    const data = await fs.readFile(filePath, 'utf8');
                    return JSON.parse(data);
                }
            } catch (error) {
                console.warn('Rapor dosyası okunamadı:', error.message);
            }
            
            throw new Error('Session bulunamadı');
        }

        return session.metrics;
    }

    async generateReport(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                // Session memory'de yoksa, kaydedilmiş rapor dosyasından oku
                console.log('Session memory\'de bulunamadı, kaydedilmiş rapor aranıyor...');
                const reportsDir = path.join(__dirname, '../../reports');
                const files = await fs.readdir(reportsDir);
                
                const sessionFiles = files.filter(file => 
                    file.includes(`browser-analysis-${sessionId}`) && file.endsWith('.json')
                );
                
                if (sessionFiles.length > 0) {
                    const latestFile = sessionFiles.sort().pop();
                    const filePath = path.join(reportsDir, latestFile);
                    const data = await fs.readFile(filePath, 'utf8');
                    const reportData = JSON.parse(data);
                    return await this.generateReportWithData(reportData);
                }
                
                throw new Error('Session bulunamadı');
            }

            const reportData = {
                sessionId,
                browserType: session.browserType,
                url: session.url,
                startTime: session.startTime,
                endTime: session.endTime,
                duration: session.duration,
                metrics: session.metrics
            };

            return await this.generateReportWithData(reportData);

        } catch (error) {
            console.error('Rapor oluşturma hatası:', error);
            throw error;
        }
    }

    async generateReportWithData(reportData) {
        try {
            const { sessionId } = reportData;
            const reportsDir = path.join(__dirname, '../../reports');
            await fs.mkdir(reportsDir, { recursive: true });

            // Lighthouse CI HTML raporu oluştur
            const htmlReportPath = await this.lighthouseCIReport.generateHTMLReport(reportData);

            // PageSpeed Insights raporu oluştur
            let pageSpeedReportPath = null;
            let pageSpeedData = null;
            try {
                pageSpeedData = await this.pageSpeedAnalyzer.generatePageSpeedReport(reportData);
                pageSpeedReportPath = await this.pageSpeedReport.generateHTMLReport(pageSpeedData);
                console.log('PageSpeed Insights HTML raporu oluşturuldu:', pageSpeedReportPath);
            } catch (error) {
                console.warn('PageSpeed Insights raporu oluşturulamadı:', error.message);
            }

            console.log('Mercury Performance HTML raporu oluşturuldu:', htmlReportPath);
            
            return {
                html: htmlReportPath,
                pagespeed: pageSpeedReportPath
            };

        } catch (error) {
            console.error('Rapor oluşturma hatası:', error);
            throw error;
        }
    }

    // Session'dan rapor verilerini al (session silindikten sonra kullanmak için)
    getReportData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session bulunamadı');
        }

        return {
            sessionId,
            browserType: session.browserType,
            url: session.url,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            metrics: session.metrics
        };
    }

    async close() {
        for (const [sessionId, session] of this.sessions) {
            try {
                if (session.context) await session.context.close();
                if (session.browser) await session.browser.close();
            } catch (error) {
                console.error(`Session ${sessionId} kapatma hatası:`, error);
            }
        }
        
        this.sessions.clear();
        this.browsers.clear();
    }
}

module.exports = BrowserAnalyzer; 