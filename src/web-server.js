require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const WebPerformanceAnalyzer = require('./web/performance-analyzer');
const InteractivePerformanceAnalyzer = require('./web/interactive-analyzer');
const AndroidPerformanceAnalyzer = require('./mobile/android-analyzer');

class PerformanceMonitorServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.webAnalyzer = new WebPerformanceAnalyzer();
        this.interactiveAnalyzer = new InteractivePerformanceAnalyzer();
        this.androidAnalyzer = new AndroidPerformanceAnalyzer();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        // Güvenlik middleware'leri - CSP ayarlarını düzenle
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "'unsafe-eval'",
                        "https://cdnjs.cloudflare.com",
                        "https://cdn.jsdelivr.net",
                        "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.4/socket.io.js",
                        "https://cdn.jsdelivr.net/npm/chart.js"
                    ],
                    scriptSrcAttr: ["'unsafe-inline'"],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://cdnjs.cloudflare.com",
                        "https://fonts.googleapis.com"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "https://cdnjs.cloudflare.com"
                    ],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: []
                }
            }
        }));
        this.app.use(cors());
        
        // JSON parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Static dosyalar
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Ana sayfa
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // API Routes
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'running',
                timestamp: new Date().toISOString(),
                port: this.port,
                webAnalyzer: this.webAnalyzer.browser ? 'initialized' : 'not_initialized',
                androidAnalyzer: this.androidAnalyzer.devices.length > 0 ? 'devices_found' : 'no_devices'
            });
        });

        // Web Performance Analysis API
        this.app.post('/api/web/analyze', async (req, res) => {
            try {
                const { url } = req.body;
                if (!url) {
                    return res.status(400).json({ error: 'URL gerekli' });
                }
                
                const results = await this.webAnalyzer.analyze(url);
                res.json(results);
            } catch (error) {
                console.error('Web analiz hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Browser Analysis API
        this.app.post('/api/web/browser/start', async (req, res) => {
            try {
                const { url, browser } = req.body;
                if (!url || !browser) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'URL ve tarayıcı seçimi gerekli' 
                    });
                }
                
                const sessionId = await this.startBrowserAnalysis(url, browser);
                res.json({
                    success: true,
                    sessionId: sessionId,
                    message: `${browser} tarayıcısı açıldı. Siteyi gezinmeye başlayabilirsiniz.`
                });
            } catch (error) {
                console.error('Tarayıcı analizi başlatma hatası:', error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });

        this.app.post('/api/web/browser/stop', async (req, res) => {
            try {
                const { sessionId } = req.body;
                if (!sessionId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Session ID gerekli' 
                    });
                }
                
                const results = await this.stopBrowserAnalysis(sessionId);
                res.json({
                    success: true,
                    message: 'Analiz durduruldu',
                    data: results
                });
            } catch (error) {
                console.error('Tarayıcı analizi durdurma hatası:', error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });

        this.app.get('/api/web/browser/status/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const status = await this.getBrowserAnalysisStatus(sessionId);
                res.json(status);
            } catch (error) {
                console.error('Tarayıcı analizi durumu hatası:', error);
                res.status(500).json({ 
                    status: 'error', 
                    message: error.message 
                });
            }
        });

        this.app.get('/api/web/browser/report/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const report = await this.getBrowserAnalysisReport(sessionId);
                res.json({
                    success: true,
                    data: report
                });
            } catch (error) {
                console.error('Tarayıcı analizi raporu hatası:', error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });

        this.app.get('/api/web/browser/download/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { type = 'html' } = req.query;
                
                const reportPaths = await this.generateBrowserAnalysisReport(sessionId);
                
                if (type === 'json') {
                    res.download(reportPaths.json);
                } else if (type === 'pagespeed' && reportPaths.pagespeed) {
                    res.download(reportPaths.pagespeed);
                } else if (type === 'gemini' && reportPaths.gemini) {
                    res.download(reportPaths.gemini);
                } else {
                    res.download(reportPaths.html);
                }
            } catch (error) {
                console.error('Tarayıcı analizi indirme hatası:', error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });

        // Raporları listele
        this.app.get('/api/reports', async (req, res) => {
            try {
                const reportsDir = path.join(__dirname, '../reports');
                const files = await fs.promises.readdir(reportsDir);
                
                const reports = [];
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const filePath = path.join(reportsDir, file);
                            const data = await fs.promises.readFile(filePath, 'utf8');
                            const reportData = JSON.parse(data);
                            
                            reports.push({
                                id: reportData.sessionId,
                                filename: file,
                                url: reportData.url,
                                browserType: reportData.browserType,
                                startTime: reportData.startTime,
                                endTime: reportData.endTime,
                                duration: reportData.duration,
                                metrics: {
                                    pages: reportData.metrics.navigationEvents?.length || 0,
                                    resources: reportData.metrics.resourceTiming?.length || 0,
                                    errors: reportData.metrics.errors?.length || 0
                                }
                            });
                        } catch (error) {
                            console.warn('Rapor dosyası okunamadı:', file, error.message);
                        }
                    }
                }
                
                // Tarihe göre sırala (en yeni önce)
                reports.sort((a, b) => b.startTime - a.startTime);
                
                res.json({
                    success: true,
                    reports: reports
                });
            } catch (error) {
                console.error('Rapor listesi hatası:', error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });

        // Android Performance API
        this.app.get('/api/android/devices', async (req, res) => {
            try {
                await this.androidAnalyzer.refreshDevices();
                res.json(this.androidAnalyzer.devices);
            } catch (error) {
                console.error('Cihaz listesi hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/android/select-device', async (req, res) => {
            try {
                const { deviceId } = req.body;
                const device = await this.androidAnalyzer.selectDevice(deviceId);
                res.json({ success: true, device });
            } catch (error) {
                console.error('Cihaz seçme hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/android/apps', async (req, res) => {
            try {
                if (!this.androidAnalyzer.currentDevice) {
                    return res.status(400).json({ error: 'Önce cihaz seçin' });
                }

                const apps = await this.androidAnalyzer.getInstalledApps();
                res.json(apps);
            } catch (error) {
                console.error('Uygulama listesi hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/android/start-monitoring', async (req, res) => {
            try {
                const { packageName, duration = 60000 } = req.body;
                
                if (!packageName) {
                    return res.status(400).json({ error: 'Package name gerekli' });
                }

                if (!this.androidAnalyzer.currentDevice) {
                    return res.status(400).json({ error: 'Önce cihaz seçin' });
                }

                // Uygulamayı başlat
                await this.androidAnalyzer.launchApp(packageName);
                
                // İzlemeyi başlat
                const monitoringInfo = await this.androidAnalyzer.startMonitoring(packageName, duration);
                
                res.json({ 
                    success: true, 
                    monitoringInfo,
                    message: 'Performans izleme başlatıldı'
                });
            } catch (error) {
                console.error('İzleme başlatma hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/android/stop-monitoring', async (req, res) => {
            try {
                await this.androidAnalyzer.stopMonitoring();
                res.json({ success: true, message: 'İzleme durduruldu' });
            } catch (error) {
                console.error('İzleme durdurma hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/android/metrics', async (req, res) => {
            try {
                const metrics = await this.androidAnalyzer.getCurrentMetrics();
                res.json(metrics);
            } catch (error) {
                console.error('Metrik alma hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/android/report', async (req, res) => {
            try {
                const { packageName, format = 'json' } = req.body;
                
                if (!packageName) {
                    return res.status(400).json({ error: 'Package name gerekli' });
                }

                const reportPath = await this.androidAnalyzer.generateReport(packageName, format);
                res.json({ 
                    success: true, 
                    reportPath,
                    message: `${format.toUpperCase()} raporu oluşturuldu`
                });
            } catch (error) {
                console.error('Android rapor oluşturma hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Raporları listele
        this.app.get('/api/reports', async (req, res) => {
            try {
                const fs = require('fs').promises;
                const reportsDir = path.join(__dirname, '../reports');
                
                try {
                    const files = await fs.readdir(reportsDir);
                    const reports = files.map(file => ({
                        name: file,
                        path: `/reports/${file}`,
                        size: fs.stat(path.join(reportsDir, file)).then(stat => stat.size),
                        created: fs.stat(path.join(reportsDir, file)).then(stat => stat.birthtime)
                    }));
                    
                    res.json(reports);
                } catch (error) {
                    res.json([]);
                }
            } catch (error) {
                console.error('Rapor listesi hatası:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Raporları indir
        this.app.get('/reports/:filename', (req, res) => {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '../reports', filename);
            
            res.download(filePath, filename, (err) => {
                if (err) {
                    console.error('Dosya indirme hatası:', err);
                    res.status(404).json({ error: 'Dosya bulunamadı' });
                }
            });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Yeni bağlantı:', socket.id);

            // Web performance real-time updates
            socket.on('web-analyze', async (data) => {
                try {
                    const { url, options = {} } = data;
                    
                    if (!this.webAnalyzer.browser) {
                        await this.webAnalyzer.initialize();
                    }

                    socket.emit('web-analysis-start', { url });
                    
                    const results = await this.webAnalyzer.analyzePerformance(url, options);
                    socket.emit('web-analysis-complete', results);
                } catch (error) {
                    socket.emit('web-analysis-error', { error: error.message });
                }
            });

            // Android performance real-time updates
            socket.on('android-start-monitoring', async (data) => {
                try {
                    const { packageName, duration = 60000 } = data;
                    
                    if (!this.androidAnalyzer.currentDevice) {
                        socket.emit('android-error', { error: 'Cihaz seçilmemiş' });
                        return;
                    }

                    socket.emit('android-monitoring-start', { packageName, duration });
                    
                    // Uygulamayı başlat
                    await this.androidAnalyzer.launchApp(packageName);
                    
                    // İzlemeyi başlat
                    await this.androidAnalyzer.startMonitoring(packageName, duration);
                    
                    // Periyodik olarak metrikleri gönder
                    const metricInterval = setInterval(async () => {
                        if (!this.androidAnalyzer.monitoring) {
                            clearInterval(metricInterval);
                            socket.emit('android-monitoring-stop');
                            return;
                        }
                        
                        const metrics = await this.androidAnalyzer.getCurrentMetrics();
                        socket.emit('android-metrics-update', metrics);
                    }, 2000);

                } catch (error) {
                    socket.emit('android-error', { error: error.message });
                }
            });

            socket.on('android-stop-monitoring', async () => {
                try {
                    await this.androidAnalyzer.stopMonitoring();
                    socket.emit('android-monitoring-stopped');
                } catch (error) {
                    socket.emit('android-error', { error: error.message });
                }
            });

            socket.on('disconnect', () => {
                console.log('Bağlantı kesildi:', socket.id);
            });
        });
    }

    async start() {
        try {
            // Web analyzer'ı başlat
            await this.webAnalyzer.initialize();
            
            // Android analyzer'ı başlat
            await this.androidAnalyzer.initialize();
            
            this.server.listen(this.port, () => {
                console.log(`☿ Mercury Performance Tools Server ${this.port} portunda çalışıyor`);
                console.log(`📊 Web UI: http://localhost:${this.port}`);
                console.log(`🔧 API: http://localhost:${this.port}/api/status`);
            });
        } catch (error) {
            console.error('Server başlatılamadı:', error);
            throw error;
        }
    }

    async stop() {
        try {
            await this.webAnalyzer.close();
            this.server.close(() => {
                console.log('☿ Mercury Performance Tools Server kapatıldı');
            });
        } catch (error) {
            console.error('Server kapatma hatası:', error);
        }
    }

    async startBrowserAnalysis(url, browser) {
        try {
            console.log(`${browser} tarayıcısı ile analiz başlatılıyor:`, url);
            
            // Browser analyzer'ı başlat
            if (!this.browserAnalyzer) {
                this.browserAnalyzer = new (require('./web/browser-analyzer'))();
            }
            
            const sessionId = await this.browserAnalyzer.startAnalysis(url, browser);
            return sessionId;
        } catch (error) {
            console.error('Browser analizi başlatma hatası:', error);
            throw error;
        }
    }

    async stopBrowserAnalysis(sessionId) {
        try {
            console.log('Browser analizi durduruluyor:', sessionId);
            
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer bulunamadı');
            }
            
            const results = await this.browserAnalyzer.stopAnalysis(sessionId);
            return results;
        } catch (error) {
            console.error('Browser analizi durdurma hatası:', error);
            throw error;
        }
    }

    async getBrowserAnalysisStatus(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                return { status: 'error', message: 'Browser analyzer bulunamadı' };
            }
            
            const status = await this.browserAnalyzer.getStatus(sessionId);
            return status;
        } catch (error) {
            console.error('Browser analizi durumu hatası:', error);
            return { status: 'error', message: error.message };
        }
    }

    async getBrowserAnalysisReport(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer bulunamadı');
            }
            
            const report = await this.browserAnalyzer.getReport(sessionId);
            return report;
        } catch (error) {
            console.error('Browser analizi raporu hatası:', error);
            throw error;
        }
    }

    async generateBrowserAnalysisReport(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer bulunamadı');
            }
            
            const reportPath = await this.browserAnalyzer.generateReport(sessionId);
            return reportPath;
        } catch (error) {
            console.error('Browser analizi raporu oluşturma hatası:', error);
            throw error;
        }
    }
}

// Eğer bu dosya doğrudan çalıştırılırsa
if (require.main === module) {
    const server = new PerformanceMonitorServer();
    server.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n☿ Mercury Performance Tools Server kapatılıyor...');
        await server.stop();
        process.exit(0);
    });
}

module.exports = PerformanceMonitorServer; 