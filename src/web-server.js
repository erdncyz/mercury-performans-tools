require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;

const WebPerformanceAnalyzer = require('./web/performance-analyzer');
const InteractivePerformanceAnalyzer = require('./web/interactive-analyzer');

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
                webAnalyzer: this.webAnalyzer.browser ? 'initialized' : 'not_initialized'
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
                
                console.log('Download request:', { sessionId, type });
                
                const reportsDir = path.join(__dirname, '../reports');
                console.log('Reports directory:', reportsDir);
                
                const files = await fs.readdir(reportsDir);
                console.log('Available files:', files);
                
                let targetFile = null;
                
                if (type === 'pagespeed') {
                    targetFile = files.find(file => file.includes('pagespeed-performance') && file.endsWith('.html'));
                } else {
                    // Default to mercury performance report
                    targetFile = files.find(file => file.includes('mercury-performance') && file.endsWith('.html'));
                }
                
                console.log('Target file:', targetFile);
                
                if (!targetFile) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `Report not found for session ${sessionId} and type ${type}` 
                    });
                }
                
                const filePath = path.join(reportsDir, targetFile);
                console.log('File path:', filePath);
                
                res.download(filePath);
                
            } catch (error) {
                console.error('Browser analysis download error:', error);
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
                const files = await fs.readdir(reportsDir);
                
                const reports = [];
                for (const file of files) {
                    if (file.includes('mercury-performance') && file.endsWith('.html')) {
                        try {
                            // Extract date from filename
                            const dateMatch = file.match(/mercury-performance-(\d{2}-\w+-\d{4}-\d{2}-\d{2})/);
                            if (dateMatch) {
                                const dateStr = dateMatch[1];
                                const [day, month, year, hours, minutes] = dateStr.split('-');
                                
                                // Convert English month names to numbers
                                const months = {
                                    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                                    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                                };
                                
                                const timestamp = new Date(parseInt(year), months[month], parseInt(day), parseInt(hours), parseInt(minutes)).getTime();
                                
                                reports.push({
                                    id: timestamp.toString(),
                                    filename: file,
                                    url: 'Analyzed Website',
                                    browserType: 'Browser',
                                    startTime: timestamp,
                                    endTime: timestamp + 60000, // Assume 1 minute duration
                                    duration: 60000,
                                    metrics: {
                                        pages: 1,
                                        resources: 50,
                                        errors: 0
                                    }
                                });
                            }
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

        // Rapor sil
        this.app.delete('/api/reports/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const reportsDir = path.join(__dirname, '../reports');
                const files = await fs.readdir(reportsDir);
                
                // Session ID'ye göre ilgili dosyaları bul
                const filesToDelete = files.filter(file => file.includes(sessionId));
                
                if (filesToDelete.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `No reports found for session ${sessionId}`
                    });
                }
                
                // Dosyaları sil
                for (const file of filesToDelete) {
                    const filePath = path.join(reportsDir, file);
                    await fs.unlink(filePath);
                    console.log(`Deleted report file: ${file}`);
                }
                
                res.json({
                    success: true,
                    message: `Deleted ${filesToDelete.length} report(s) for session ${sessionId}`,
                    deletedFiles: filesToDelete
                });
                
            } catch (error) {
                console.error('Rapor silme hatası:', error);
                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });

        // Tüm raporları sil
        this.app.delete('/api/reports', async (req, res) => {
            try {
                const reportsDir = path.join(__dirname, '../reports');
                const files = await fs.readdir(reportsDir);
                
                if (files.length === 0) {
                    return res.json({
                        success: true,
                        message: 'No reports to delete'
                    });
                }
                
                // Tüm dosyaları sil
                for (const file of files) {
                    const filePath = path.join(reportsDir, file);
                    await fs.unlink(filePath);
                    console.log(`Deleted report file: ${file}`);
                }
                
                res.json({
                    success: true,
                    message: `Deleted all ${files.length} report(s)`,
                    deletedFiles: files
                });
                
            } catch (error) {
                console.error('Tüm raporları silme hatası:', error);
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



            socket.on('disconnect', () => {
                console.log('Bağlantı kesildi:', socket.id);
            });
        });
    }

    async start() {
        try {
            // Web analyzer'ı başlat
            await this.webAnalyzer.initialize();
            

            
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