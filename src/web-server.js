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
    constructor(port = process.env.PORT || 3000) {
        this.port = port;
        this.host = process.env.HOST || '0.0.0.0';
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*",
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
        // Trust proxy for network access
        if (process.env.TRUST_PROXY === 'true') {
            this.app.set('trust proxy', true);
        }

        // Güvenlik middleware'leri - CSP ayarlarını düzenle
        if (process.env.ENABLE_HELMET !== 'false') {
            this.app.use(helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'", "data:", "blob:"],
                        scriptSrc: [
                            "'self'",
                            "'unsafe-inline'",
                            "'unsafe-eval'",
                            "https://cdnjs.cloudflare.com",
                            "https://cdn.jsdelivr.net",
                            "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.4/socket.io.js",
                            "https://cdn.jsdelivr.net/npm/chart.js",
                            "data:",
                            "blob:"
                        ],
                        scriptSrcAttr: ["'unsafe-inline'"],
                        styleSrc: [
                            "'self'",
                            "'unsafe-inline'",
                            "https://cdnjs.cloudflare.com",
                            "https://fonts.googleapis.com",
                            "data:",
                            "blob:"
                        ],
                        fontSrc: [
                            "'self'",
                            "https://fonts.gstatic.com",
                            "https://cdnjs.cloudflare.com",
                            "data:",
                            "blob:"
                        ],
                        imgSrc: ["'self'", "data:", "blob:", "https:"],
                        connectSrc: ["'self'", "ws:", "wss:", "data:", "blob:"],
                        frameSrc: ["'self'", "data:", "blob:"],
                        objectSrc: ["'self'", "data:", "blob:"],
                        mediaSrc: ["'self'", "data:", "blob:"],
                        workerSrc: ["'self'", "data:", "blob:"],
                        childSrc: ["'self'", "data:", "blob:"],
                        upgradeInsecureRequests: []
                    }
                }
            }));
        }

        // CORS configuration
        if (process.env.ENABLE_CORS !== 'false') {
            const corsOptions = {
                origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*",
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization']
            };
            this.app.use(cors(corsOptions));
        }
        
        // JSON parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Static dosyalar
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Logging middleware
        if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
            this.app.use((req, res, next) => {
                const clientIP = req.ip || req.connection.remoteAddress;
                console.log(`${new Date().toISOString()} - ${clientIP} - ${req.method} ${req.path}`);
                next();
            });
        }
    }

    setupRoutes() {
        // Ana sayfa
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // API Routes
        this.app.get('/api/status', (req, res) => {
            const clientIP = req.ip || req.connection.remoteAddress;
            res.json({
                status: 'running',
                timestamp: new Date().toISOString(),
                port: this.port,
                host: this.host,
                clientIP: clientIP,
                webAnalyzer: this.webAnalyzer.browser ? 'initialized' : 'not_initialized',
                environment: process.env.NODE_ENV || 'development'
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
                    message: `${browser} browser opened. You can start navigating the site.`
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
                
                const reportsDir = path.join(__dirname, '../reports');
                const files = await fs.readdir(reportsDir);
                
                let targetFile = null;
                
                if (type === 'pagespeed') {
                    // Find the most recent pagespeed report
                    const pagespeedFiles = files
                        .filter(file => file.includes('pagespeed-performance') && file.endsWith('.html'))
                        .sort()
                        .reverse();
                    targetFile = pagespeedFiles[0];
                } else {
                    // Find the most recent mercury performance report
                    const mercuryFiles = files
                        .filter(file => file.includes('mercury-performance') && file.endsWith('.html'))
                        .sort()
                        .reverse();
                    targetFile = mercuryFiles[0];
                }
                
                if (!targetFile) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `Report not found for session ${sessionId} and type ${type}` 
                    });
                }
                
                const filePath = path.join(reportsDir, targetFile);
                
                // Add cache control headers to prevent browser caching
                res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });
                
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
                                
                                // Try to find corresponding JSON file for real data
                                const jsonFilename = file.replace('.html', '.json');
                                const jsonPath = path.join(reportsDir, jsonFilename);
                                
                                let reportData = {
                                    url: 'Analyzed Website',
                                    browserType: 'Browser',
                                    metrics: {
                                        pages: 1,
                                        resources: 50,
                                        errors: 0
                                    }
                                };
                                
                                try {
                                    const jsonContent = await fs.readFile(jsonPath, 'utf8');
                                    const sessionData = JSON.parse(jsonContent);
                                    
                                    if (sessionData.url) {
                                        reportData.url = sessionData.url;
                                    }
                                    if (sessionData.browserType) {
                                        reportData.browserType = sessionData.browserType;
                                    }
                                    if (sessionData.metrics) {
                                        reportData.metrics = {
                                            pages: sessionData.metrics.pageLoadTimes ? sessionData.metrics.pageLoadTimes.length : 1,
                                            resources: sessionData.metrics.totalResources || 50,
                                            errors: sessionData.metrics.totalErrors || 0
                                        };
                                    }
                                } catch (jsonError) {
                                    console.warn('JSON file not found or invalid:', jsonFilename);
                                }
                                
                                reports.push({
                                    id: timestamp.toString(),
                                    filename: file,
                                    url: reportData.url,
                                    browserType: reportData.browserType,
                                    startTime: timestamp,
                                    endTime: timestamp + 60000, // Assume 1 minute duration
                                    duration: 60000,
                                    metrics: reportData.metrics
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

        // Delete single report by timestamp
        this.app.delete('/api/reports/:timestamp', async (req, res) => {
            try {
                const { timestamp } = req.params;
                const reportsDir = path.join(__dirname, '../reports');
                const files = await fs.readdir(reportsDir);
                
                // Convert timestamp to date and find matching files
                const targetDate = new Date(parseInt(timestamp));
                const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                
                // Find files that match the date pattern
                const filesToDelete = files.filter(file => {
                    // Check if file contains the date pattern
                    const dateMatch = file.match(/(\d{2})-(\w{3})-(\d{4})/);
                    if (dateMatch) {
                        const [, day, month, year] = dateMatch;
                        const months = {
                            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                        };
                        const fileDate = `${year}-${months[month]}-${day}`;
                        return fileDate === targetDateStr;
                    }
                    return false;
                });
                
                if (filesToDelete.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: `No reports found for timestamp ${timestamp}`
                    });
                }
                
                // Delete files
                for (const file of filesToDelete) {
                    const filePath = path.join(reportsDir, file);
                    await fs.unlink(filePath);
                }
                
                res.json({
                    success: true,
                    message: `Deleted ${filesToDelete.length} report(s) for timestamp ${timestamp}`,
                    deletedFiles: filesToDelete
                });
                
            } catch (error) {
                console.error('Report deletion error:', error);
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
            

            
            this.server.listen(this.port, this.host, () => {
                        console.log(`☿ Mercury Performance Tools Server running on ${this.host}:${this.port}`);
        console.log(`📊 Web UI: http://localhost:${this.port}`);
        console.log(`🌐 Network Access: http://${this.host}:${this.port}`);
        console.log(`🔧 API: http://localhost:${this.port}/api/status`);
                
                // Show Network IP addresses
                const os = require('os');
                const networkInterfaces = os.networkInterfaces();
                
                console.log('\n🌍 Network IP Addresses:');
                Object.keys(networkInterfaces).forEach((interfaceName) => {
                    const interfaces = networkInterfaces[interfaceName];
                    interfaces.forEach((iface) => {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            console.log(`   ${interfaceName}: http://${iface.address}:${this.port}`);
                        }
                    });
                });
                console.log('');
            });
        } catch (error) {
            console.error('Server failed to start:', error);
            throw error;
        }
    }

    async stop() {
        try {
            await this.webAnalyzer.close();
            this.server.close(() => {
                console.log('☿ Mercury Performance Tools Server stopped');
            });
        } catch (error) {
            console.error('Server shutdown error:', error);
        }
    }

    async startBrowserAnalysis(url, browser) {
        try {
            console.log(`Starting analysis with ${browser} browser:`, url);
            
            // Initialize browser analyzer
            if (!this.browserAnalyzer) {
                this.browserAnalyzer = new (require('./web/browser-analyzer'))();
            }
            
            const sessionId = await this.browserAnalyzer.startAnalysis(url, browser);
            return sessionId;
        } catch (error) {
            console.error('Browser analysis start error:', error);
            throw error;
        }
    }

    async stopBrowserAnalysis(sessionId) {
        try {
            console.log('Stopping browser analysis:', sessionId);
            
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer not found');
            }
            
            const results = await this.browserAnalyzer.stopAnalysis(sessionId);
            return results;
        } catch (error) {
            console.error('Browser analysis stop error:', error);
            throw error;
        }
    }

    async getBrowserAnalysisStatus(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                return { status: 'error', message: 'Browser analyzer not found' };
            }
            
            const status = await this.browserAnalyzer.getStatus(sessionId);
            return status;
        } catch (error) {
            console.error('Browser analysis status error:', error);
            return { status: 'error', message: error.message };
        }
    }

    async getBrowserAnalysisReport(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer not found');
            }
            
            const report = await this.browserAnalyzer.getReport(sessionId);
            return report;
        } catch (error) {
            console.error('Browser analysis report error:', error);
            throw error;
        }
    }

    async generateBrowserAnalysisReport(sessionId) {
        try {
            if (!this.browserAnalyzer) {
                throw new Error('Browser analyzer not found');
            }
            
            const reportPath = await this.browserAnalyzer.generateReport(sessionId);
            return reportPath;
        } catch (error) {
            console.error('Browser analysis report generation error:', error);
            throw error;
        }
    }
}

// If this file is run directly
if (require.main === module) {
    const server = new PerformanceMonitorServer();
    server.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n☿ Mercury Performance Tools Server shutting down...');
        await server.stop();
        process.exit(0);
    });
}

module.exports = PerformanceMonitorServer; 