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
    
            
            const sessionId = Date.now().toString();
            const browser = await this.launchBrowser(browserType);
            
            if (!browser) {
                throw new Error(`${browserType} tarayıcısı başlatılamadı`);
            }
            
            const context = await browser.newContext({
                viewport: null, // Tam ekran için viewport'u kaldır
                userAgent: this.getUserAgent(browserType),
                ignoreHTTPSErrors: true,
                // Bot tespiti önleme için gelişmiş ayarlar
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            
            const page = await context.newPage();
            
            // Network traffic listeners ekle (önce network, sonra performance)
            await this.setupNetworkListeners(page);
            
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
                    cpuUsage: [],
                    pageLoadTimes: [],
                    totalResources: 0,
                    totalErrors: 0,
                    totalSize: 0,
                    networkRequests: [],
                    networkResponses: [],
                    networkErrors: []
                }
            });
            
            // Sayfayı aç (daha güvenli timeout ile)
            try {
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });

                // Bot tespiti önleme için JavaScript kodları
                await page.evaluate(() => {
                    // WebDriver özelliğini gizle
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });

                    // Chrome runtime özelliğini gizle
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });

                    // Permissions API'yi gizle
                    Object.defineProperty(navigator, 'permissions', {
                        get: () => undefined,
                    });

                    // Automation özelliklerini gizle
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

                    // Chrome otomasyon özelliklerini gizle
                    if (window.chrome) {
                        delete window.chrome.runtime;
                    }

                    // User agent string'ini gerçek Chrome gibi yap
                    Object.defineProperty(navigator, 'userAgent', {
                        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    });

                    // Language özelliğini ayarla
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['tr-TR', 'tr', 'en-US', 'en'],
                    });

                    // Platform özelliğini ayarla
                    Object.defineProperty(navigator, 'platform', {
                        get: () => 'Win32',
                    });

                    // Hardware concurrency özelliğini ayarla
                    Object.defineProperty(navigator, 'hardwareConcurrency', {
                        get: () => 8,
                    });

                    // Device memory özelliğini ayarla
                    Object.defineProperty(navigator, 'deviceMemory', {
                        get: () => 8,
                    });

                    // Connection özelliğini ayarla
                    Object.defineProperty(navigator, 'connection', {
                        get: () => ({
                            effectiveType: '4g',
                            rtt: 50,
                            downlink: 10,
                            saveData: false
                        }),
                    });
                });
        
                
                // Make fullscreen (safer)
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
                } catch (fullscreenError) {
                    // Fullscreen failed, continue
                }

                // Maximize browser
                try {
                    await page.evaluate(() => {
                        window.moveTo(0, 0);
                        window.resizeTo(screen.width, screen.height);
                    });
                } catch (maximizeError) {
                    // Maximize failed, continue
                }

                // Collect additional data after page loads
                await this.collectAdditionalData(page, sessionId);
                
            } catch (navigationError) {
                console.warn('Sayfa yükleme hatası, devam ediliyor:', navigationError.message);
                // Hata olsa bile devam et
            }
            
            return sessionId;
            
        } catch (error) {
            console.error('Browser analysis start error:', error);
            
            // Cleanup on error
            try {
                const browser = this.browsers.get(sessionId);
                if (browser) {
                    await browser.close();
                    this.browsers.delete(sessionId);
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
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
                        // channel: 'chrome', // Sistem Chrome'u kullanmayı kapat
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--disable-software-rasterizer',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--disable-features=TranslateUI',
                            '--disable-ipc-flooding-protection',
                            '--start-maximized',
                            '--disable-web-security',
                            '--disable-features=VizDisplayCompositor',
                            '--enable-features=VaapiVideoDecoder',
                            '--enable-accelerated-mjpeg-decode',
                            '--enable-accelerated-video-decode',
                            '--ignore-gpu-blocklist',
                            '--enable-gpu-rasterization',
                            '--enable-zero-copy',
                            '--disable-blink-features=AutomationControlled',
                            '--disable-automation',
                            '--disable-extensions-except',
                            '--disable-plugins-discovery',
                            '--disable-default-apps',
                            '--disable-sync',
                            '--disable-translate',
                            '--disable-background-networking',
                            '--disable-background-timer-throttling',
                            '--disable-client-side-phishing-detection',
                            '--disable-component-update',
                            '--disable-domain-reliability',
                            '--disable-features=AudioServiceOutOfProcess',
                            '--disable-hang-monitor',
                            '--disable-ipc-flooding-protection',
                            '--disable-prompt-on-repost',
                            '--disable-renderer-backgrounding',
                            '--disable-sync-preferences',
                            '--force-color-profile=srgb',
                            '--metrics-recording-only',
                            '--no-first-run',
                            '--password-store=basic',
                            '--use-mock-keychain',
                            '--hide-scrollbars',
                            '--mute-audio',
                            '--no-default-browser-check',
                            '--no-pings',
                            '--no-zygote',
                            '--single-process',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-zygote',
                            '--disable-gpu-sandbox',
                            '--disable-software-rasterizer',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--disable-features=TranslateUI',
                            '--disable-ipc-flooding-protection',
                            '--disable-features=VizDisplayCompositor',
                            '--enable-features=VaapiVideoDecoder',
                            '--enable-accelerated-mjpeg-decode',
                            '--enable-accelerated-video-decode',
                            '--ignore-gpu-blocklist',
                            '--enable-gpu-rasterization',
                            '--enable-zero-copy',
                            '--disable-blink-features=AutomationControlled'
                        ]
                    });
                
                case 'firefox':
                    return await firefox.launch({
                        headless: false,
                        args: [
                            '--no-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--enable-features=VaapiVideoDecoder',
                            '--enable-accelerated-mjpeg-decode',
                            '--enable-accelerated-video-decode',
                            '--ignore-gpu-blocklist',
                            '--enable-gpu-rasterization'
                        ]
                    });
                
                case 'safari':
                    return await webkit.launch({
                        headless: false,
                        args: [
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--enable-features=VaapiVideoDecoder',
                            '--enable-accelerated-mjpeg-decode',
                            '--enable-accelerated-video-decode',
                            '--ignore-gpu-blocklist',
                            '--enable-gpu-rasterization'
                        ]
                    });
                
                case 'edge':
                    return await chromium.launch({
                        headless: false,
                        // channel: 'msedge', // Sistem Edge'ini kullanmayı kapat
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--disable-software-rasterizer',
                            '--disable-background-timer-throttling',
                            '--disable-backgrounding-occluded-windows',
                            '--disable-renderer-backgrounding',
                            '--disable-features=TranslateUI',
                            '--disable-ipc-flooding-protection',
                            '--start-maximized',
                            '--disable-features=VizDisplayCompositor',
                            '--enable-features=VaapiVideoDecoder',
                            '--enable-accelerated-mjpeg-decode',
                            '--enable-accelerated-video-decode',
                            '--ignore-gpu-blocklist',
                            '--enable-gpu-rasterization',
                            '--enable-zero-copy',
                            '--disable-blink-features=AutomationControlled'
                        ]
                    });
                
                default:
                    throw new Error(`Unsupported browser: ${browserType}`);
            }
        } catch (error) {
            console.error(`${browserType} launch error:`, error);
            
            // Fallback to Chromium
    
            return await chromium.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--start-maximized',
                    '--enable-features=VaapiVideoDecoder',
                    '--enable-accelerated-mjpeg-decode',
                    '--enable-accelerated-video-decode',
                    '--ignore-gpu-blocklist',
                    '--enable-gpu-rasterization',
                    '--enable-zero-copy',
                    '--disable-blink-features=AutomationControlled'
                ]
            });
        }
    }

    getUserAgent(browserType) {
        const userAgents = {
            chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        };
        
        return userAgents[browserType.toLowerCase()] || userAgents.chrome;
    }

    async setupNetworkListeners(page) {
        try {
            // Request-response mapping için Map
            const requestMap = new Map();
            
            // Network request listeners (Postman proxy benzeri)
            page.on('request', request => {
                const session = this.getSessionByPage(page);
                if (session) {
                    const requestId = request.url() + '_' + Date.now();
                    const startTime = Date.now();
                    
                    const requestData = {
                        id: requestId,
                        url: request.url(),
                        method: request.method(),
                        headers: request.headers(),
                        postData: request.postData(),
                        resourceType: request.resourceType(),
                        startTime: startTime,
                        timestamp: startTime,
                        frame: request.frame().name(),
                        size: request.postData() ? request.postData().length : 0
                    };
                    
                    // Request'i Map'e kaydet
                    requestMap.set(request.url(), {
                        request: requestData,
                        startTime: startTime
                    });
                    
                    if (!session.metrics.networkRequests) {
                        session.metrics.networkRequests = [];
                    }
                    session.metrics.networkRequests.push(requestData);
                    
                    // Postman benzeri detaylı log
                    
                }
            });

            // Network response listeners (Postman proxy benzeri)
            page.on('response', async response => {
                const session = this.getSessionByPage(page);
                if (session) {
                    const endTime = Date.now();
                    const requestInfo = requestMap.get(response.url());
                    const duration = requestInfo ? endTime - requestInfo.startTime : 0;
                    
                    let responseBody = '';
                    try {
                        responseBody = await response.text();
                    } catch (e) {
                        responseBody = '[Binary or non-text response]';
                    }
                    
                    const responseData = {
                        url: response.url(),
                        status: response.status(),
                        statusText: response.statusText(),
                        headers: response.headers(),
                        endTime: endTime,
                        duration: duration,
                        timestamp: endTime,
                        resourceType: response.request().resourceType(),
                        responseSize: responseBody.length,
                        responseBody: responseBody.substring(0, 1000) // İlk 1000 karakter
                    };
                    
                    if (!session.metrics.networkResponses) {
                        session.metrics.networkResponses = [];
                    }
                    session.metrics.networkResponses.push(responseData);
                    
                    // Postman benzeri detaylı log
                    const statusColor = response.status() >= 200 && response.status() < 300 ? '✅' : '⚠️';
                    console.log(`${statusColor} [${response.status()}] ${response.url()} (${duration}ms)`);
                    console.log(`   📊 Response Size: ${responseBody.length} bytes`);
                    console.log(`   ⏱️  Duration: ${duration}ms`);
                    if (responseBody.length > 0 && responseBody.length < 500) {
                        console.log(`   📄 Response: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
                    }
                    
                    // Request'i Map'ten temizle
                    requestMap.delete(response.url());
                }
            });

            // Network error listeners
            page.on('requestfailed', request => {
                const session = this.getSessionByPage(page);
                if (session) {
                    const endTime = Date.now();
                    const requestInfo = requestMap.get(request.url());
                    const duration = requestInfo ? endTime - requestInfo.startTime : 0;
                    
                    const errorData = {
                        url: request.url(),
                        method: request.method(),
                        error: request.failure().errorText,
                        endTime: endTime,
                        duration: duration,
                        timestamp: endTime,
                        resourceType: request.resourceType()
                    };
                    
                    if (!session.metrics.networkErrors) {
                        session.metrics.networkErrors = [];
                    }
                    session.metrics.networkErrors.push(errorData);
                    

                    
                    // Request'i Map'ten temizle
                    requestMap.delete(request.url());
                }
            });

            // Ek network event'leri
            page.on('requestfinished', request => {
                const session = this.getSessionByPage(page);
                if (session) {
                    // Request finished
                }
            });

            // Console'dan network çağrılarını da yakala
            page.on('console', msg => {
                const session = this.getSessionByPage(page);
                if (session) {
                    const text = msg.text();
                    if (text.includes('fetch') || text.includes('XMLHttpRequest') || 
                        text.includes('api') || text.includes('http') || text.includes('POST') || text.includes('GET')) {
                        console.log(`📝 Console Network: ${msg.type()} - ${text}`);
                    }
                }
            });


        } catch (error) {
            console.error('Network listeners setup error:', error);
        }
    }

    async setupPerformanceListeners(page) {
        const session = this.getSessionByPage(page);
        if (!session) return;

        // Navigation events with detailed timing
        page.on('load', async () => {
            try {

                
                const performanceMetrics = await page.evaluate(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    const paint = performance.getEntriesByType('paint');
                    const resources = performance.getEntriesByType('resource');
                    
                    return {
                        pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                        navigationData: navigation ? {
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
                        resources: resources.map(r => ({
                            name: r.name,
                            duration: r.duration,
                            transferSize: r.transferSize || 0,
                            decodedBodySize: r.decodedBodySize || 0,
                            initiatorType: r.initiatorType,
                            nextHopProtocol: r.nextHopProtocol,
                            domainLookupStart: r.domainLookupStart || 0,
                            domainLookupEnd: r.domainLookupEnd || 0,
                            connectStart: r.connectStart || 0,
                            connectEnd: r.connectEnd || 0,
                            requestStart: r.requestStart || 0,
                            responseStart: r.responseStart || 0,
                            responseEnd: r.responseEnd || 0,
                            fetchStart: r.fetchStart || 0
                        }))
                    };
                });

                // Navigation event'i kaydet
                const navigationEvent = {
                    type: 'page_load',
                    timestamp: Date.now(),
                    url: page.url(),
                    loadTime: performanceMetrics.pageLoadTime,
                    domContentLoaded: performanceMetrics.domContentLoaded,
                    firstPaint: performanceMetrics.firstPaint,
                    firstContentfulPaint: performanceMetrics.firstContentfulPaint,
                    data: performanceMetrics.navigationData
                };
                session.metrics.navigationEvents.push(navigationEvent);
                
                // Page load time'ı kaydet
                if (performanceMetrics.pageLoadTime > 0) {
                    session.metrics.pageLoadTimes.push(performanceMetrics.pageLoadTime);
                }

                // Resource timing data ekle
                if (performanceMetrics.resources && performanceMetrics.resources.length > 0) {
                    performanceMetrics.resources.forEach(resource => {
                        const resourceData = {
                            url: resource.name,
                            duration: resource.duration,
                            size: resource.transferSize || 0,
                            decodedSize: resource.decodedBodySize || 0,
                            type: resource.initiatorType,
                            protocol: resource.nextHopProtocol,
                            domainLookupStart: resource.domainLookupStart,
                            domainLookupEnd: resource.domainLookupEnd,
                            connectStart: resource.connectStart,
                            connectEnd: resource.connectEnd,
                            requestStart: resource.requestStart,
                            responseStart: resource.responseStart,
                            responseEnd: resource.responseEnd,
                            fetchStart: resource.fetchStart,
                            timestamp: Date.now()
                        };
                        session.metrics.resourceTiming.push(resourceData);
                        
                        // Toplam kaynak sayısını ve boyutunu güncelle
                        session.metrics.totalResources++;
                        session.metrics.totalSize += resourceData.size;
                    });
                }


            } catch (error) {
                console.error('Performance metrics collection error:', error);
            }
        });

        // DOM content loaded event
        page.on('domcontentloaded', () => {
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
                
                // Yeni sayfa için performance metrics topla
                try {
                    const performanceMetrics = await page.evaluate(() => {
                        const navigation = performance.getEntriesByType('navigation')[0];
                        const paint = performance.getEntriesByType('paint');
                        
                        return {
                            pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                            domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                            firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                            firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                        };
                    });

                    const navigationEvent = {
                        type: 'navigation',
                        timestamp: Date.now(),
                        url: frame.url(),
                        loadTime: performanceMetrics.pageLoadTime,
                        domContentLoaded: performanceMetrics.domContentLoaded,
                        firstPaint: performanceMetrics.firstPaint,
                        firstContentfulPaint: performanceMetrics.firstContentfulPaint
                    };
                    
                    session.metrics.navigationEvents.push(navigationEvent);
                    
                    // Page load time'ı kaydet (eğer geçerliyse)
                    if (performanceMetrics.pageLoadTime > 0) {
                        session.metrics.pageLoadTimes.push(performanceMetrics.pageLoadTime);
                    }
                    
                    console.log('Navigation metrics:', frame.url(), 'Load time:', performanceMetrics.pageLoadTime, 'ms');
                } catch (error) {
                    console.error('Navigation metrics collection error:', error);
                }
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
                
                // SPA navigation için performance metrics topla
                try {
                    const performanceMetrics = await page.evaluate(() => {
                        const navigation = performance.getEntriesByType('navigation')[0];
                        const paint = performance.getEntriesByType('paint');
                        
                        return {
                            pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                            domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                            firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                            firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                        };
                    });

                    const spaEvent = {
                        type: 'spa_navigation',
                        timestamp: Date.now(),
                        url: url,
                        loadTime: performanceMetrics.pageLoadTime,
                        domContentLoaded: performanceMetrics.domContentLoaded,
                        firstPaint: performanceMetrics.firstPaint,
                        firstContentfulPaint: performanceMetrics.firstContentfulPaint
                    };
                    
                    session.metrics.navigationEvents.push(spaEvent);
                    
                    // Page load time'ı kaydet (eğer geçerliyse)
                    if (performanceMetrics.pageLoadTime > 0) {
                        session.metrics.pageLoadTimes.push(performanceMetrics.pageLoadTime);
                    }
                    
                    console.log('SPA Navigation metrics:', url, 'Load time:', performanceMetrics.pageLoadTime, 'ms');
                } catch (error) {
                    console.error('SPA Navigation metrics collection error:', error);
                }
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
            const errorData = {
                type: 'page_error',
                message: error.message,
                stack: error.stack,
                timestamp: Date.now(),
                url: page.url()
            };
            session.metrics.errors.push(errorData);
            session.metrics.totalErrors++;
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
                const errorData = {
                    type: 'console_error',
                    message: text,
                    timestamp: Date.now(),
                    url: page.url()
                };
                session.metrics.errors.push(errorData);
                session.metrics.totalErrors++;
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
            // Wait 1 second after page loads and collect data
            await page.waitForTimeout(1000);

            // Sayfanın hala aktif olup olmadığını kontrol et
            if (!page.isClosed()) {
                const additionalData = await page.evaluate(() => {
                    try {
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
                                transferSize: r.transferSize || 0,
                                decodedBodySize: r.decodedBodySize || 0,
                                initiatorType: r.initiatorType,
                                nextHopProtocol: r.nextHopProtocol,
                                domainLookupStart: r.domainLookupStart || 0,
                                domainLookupEnd: r.domainLookupEnd || 0,
                                connectStart: r.connectStart || 0,
                                connectEnd: r.connectEnd || 0,
                                requestStart: r.requestStart || 0,
                                responseStart: r.responseStart || 0,
                                responseEnd: r.responseEnd || 0,
                                fetchStart: r.fetchStart || 0
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
                    } catch (e) {
                        return {
                            navigation: null,
                            paint: [],
                            resources: [],
                            memory: null,
                            timing: null,
                            error: e.message
                        };
                    }
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
                if (additionalData.resources && additionalData.resources.length > 0) {
                    additionalData.resources.forEach(resource => {
                        session.metrics.resourceTiming.push({
                            url: resource.name,
                            duration: resource.duration,
                            size: resource.transferSize || 0,
                            decodedSize: resource.decodedBodySize || 0,
                            type: resource.initiatorType,
                            protocol: resource.nextHopProtocol,
                            domainLookupStart: resource.domainLookupStart,
                            domainLookupEnd: resource.domainLookupEnd,
                            connectStart: resource.connectStart,
                            connectEnd: resource.connectEnd,
                            requestStart: resource.requestStart,
                            responseStart: resource.responseStart,
                            responseEnd: resource.responseEnd,
                            fetchStart: resource.fetchStart,
                            timestamp: Date.now()
                        });
                    });
                }

                // Memory usage'a ekle
                if (additionalData.memory) {
                    session.metrics.memoryUsage.push({
                        ...additionalData.memory,
                        timestamp: Date.now()
                    });
                }

                console.log('Ek veri toplandı:', {
                    resources: additionalData.resources ? additionalData.resources.length : 0,
                    memory: !!additionalData.memory,
                    navigation: !!additionalData.navigation
                });
            } else {
                console.log('Sayfa kapatıldı, ek veri toplanamadı');
            }

        } catch (error) {
            console.log('Ek veri toplama hatası (normal):', error.message);
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
                metrics: {
                    ...session.metrics,
                    networkSummary: {
                        totalRequests: session.metrics.networkRequests ? session.metrics.networkRequests.length : 0,
                        totalResponses: session.metrics.networkResponses ? session.metrics.networkResponses.length : 0,
                        totalErrors: session.metrics.networkErrors ? session.metrics.networkErrors.length : 0,
                        apiCalls: session.metrics.networkRequests ? session.metrics.networkRequests.filter(req => 
                            req.url.includes('/api/') || req.url.includes('api.') || req.url.includes('rest.')
                        ).length : 0,
                        externalCalls: session.metrics.networkRequests ? session.metrics.networkRequests.filter(req => {
                            try {
                                const url = new URL(req.url);
                                return !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1');
                            } catch {
                                return true; // Invalid URL, consider as external
                            }
                        }).length : 0
                    }
                }
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
            console.error('Analysis stop error:', error);
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
            console.error('Report generation error:', error);
            throw error;
        }
    }

    async generateReportWithData(reportData) {
        try {
            const { sessionId } = reportData;
            const reportsDir = path.join(__dirname, '../../reports');
            await fs.mkdir(reportsDir, { recursive: true });

            // Session data'yı hazırla
            const sessionData = {
                sessionId: reportData.sessionId,
                browserType: reportData.browserType,
                url: reportData.url,
                startTime: reportData.startTime,
                endTime: reportData.endTime,
                duration: reportData.duration
            };

            // Lighthouse CI HTML raporu oluştur
            const htmlReportPath = await this.lighthouseCIReport.generateHTMLReport(sessionData, reportData);

            // PageSpeed Insights raporu oluştur (timeout ile)
            let pageSpeedReportPath = null;
            let pageSpeedData = null;
            try {
                const pageSpeedPromise = this.pageSpeedAnalyzer.generatePageSpeedReport(reportData);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PageSpeed API timeout')), 8000)
                );
                
                pageSpeedData = await Promise.race([pageSpeedPromise, timeoutPromise]);
                pageSpeedReportPath = await this.pageSpeedReport.generateHTMLReport(pageSpeedData);
                console.log('PageSpeed Insights HTML raporu oluşturuldu:', pageSpeedReportPath);
            } catch (error) {
                console.warn('PageSpeed Insights raporu oluşturulamadı (timeout veya hata):', error.message);
            }

            console.log('Mercury Performance HTML raporu oluşturuldu:', htmlReportPath);
            
            return {
                html: htmlReportPath,
                pagespeed: pageSpeedReportPath
            };

        } catch (error) {
            console.error('Report generation error:', error);
            throw error;
        }
    }

    // Session'dan rapor verilerini al (session silindikten sonra kullanmak için)
    getReportData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
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
                console.error(`Session ${sessionId} close error:`, error);
            }
        }
        
        this.sessions.clear();
        this.browsers.clear();
    }
}

module.exports = BrowserAnalyzer; 