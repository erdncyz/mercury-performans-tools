const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class AndroidPerformanceAnalyzer {
    constructor() {
        this.devices = [];
        this.currentDevice = null;
        this.monitoring = false;
        this.metrics = {
            cpu: [],
            memory: [],
            battery: [],
            network: [],
            fps: []
        };
    }

    async initialize() {
        try {
            // ADB'nin kurulu olup olmadığını kontrol et
            await this.checkADB();
            
            // Bağlı cihazları listele
            await this.refreshDevices();
            
            console.log('Android Performance Analyzer başlatıldı');
            return true;
        } catch (error) {
            console.error('Android Performance Analyzer başlatılamadı:', error);
            return false;
        }
    }

    async checkADB() {
        try {
            const { stdout } = await execAsync('adb version');
            console.log('ADB bulundu:', stdout.split('\n')[0]);
            return true;
        } catch (error) {
            throw new Error('ADB bulunamadı. Android SDK kurulu olduğundan emin olun.');
        }
    }

    async refreshDevices() {
        try {
            const { stdout } = await execAsync('adb devices');
            const lines = stdout.trim().split('\n').slice(1); // İlk satırı atla (List of devices attached)
            
            this.devices = lines
                .filter(line => line.trim() && !line.includes('daemon'))
                .map(line => {
                    const [id, status] = line.split('\t');
                    return { id: id.trim(), status: status.trim() };
                });

            console.log(`Bağlı cihazlar: ${this.devices.length}`);
            return this.devices;
        } catch (error) {
            console.error('Cihazlar listelenemedi:', error);
            return [];
        }
    }

    async selectDevice(deviceId = null) {
        if (deviceId) {
            const device = this.devices.find(d => d.id === deviceId);
            if (device && device.status === 'device') {
                this.currentDevice = device;
                console.log(`Cihaz seçildi: ${deviceId}`);
                return device;
            } else {
                throw new Error(`Cihaz bulunamadı veya bağlı değil: ${deviceId}`);
            }
        } else if (this.devices.length > 0) {
            const device = this.devices.find(d => d.status === 'device');
            if (device) {
                this.currentDevice = device;
                console.log(`İlk cihaz seçildi: ${device.id}`);
                return device;
            }
        }
        
        throw new Error('Bağlı cihaz bulunamadı');
    }

    async getInstalledApps() {
        if (!this.currentDevice) {
            throw new Error('Cihaz seçilmemiş');
        }

        try {
            const { stdout } = await execAsync(`adb -s ${this.currentDevice.id} shell pm list packages -3`);
            const packages = stdout
                .split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim());

            return packages;
        } catch (error) {
            console.error('Uygulamalar listelenemedi:', error);
            return [];
        }
    }

    async launchApp(packageName) {
        if (!this.currentDevice) {
            throw new Error('Cihaz seçilmemiş');
        }

        try {
            // Uygulamayı başlat
            await execAsync(`adb -s ${this.currentDevice.id} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
            console.log(`Uygulama başlatıldı: ${packageName}`);
            
            // Uygulamanın başlaması için bekle
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return true;
        } catch (error) {
            console.error('Uygulama başlatılamadı:', error);
            return false;
        }
    }

    async startMonitoring(packageName, duration = 60000) {
        if (!this.currentDevice) {
            throw new Error('Cihaz seçilmemiş');
        }

        this.monitoring = true;
        const startTime = Date.now();
        
        console.log(`Performans izleme başlatıldı: ${packageName} (${duration}ms)`);

        // CPU, Memory ve Battery izleme
        const cpuInterval = setInterval(async () => {
            if (!this.monitoring) {
                clearInterval(cpuInterval);
                return;
            }
            await this.collectCPUMetrics(packageName);
        }, 1000);

        const memoryInterval = setInterval(async () => {
            if (!this.monitoring) {
                clearInterval(memoryInterval);
                return;
            }
            await this.collectMemoryMetrics(packageName);
        }, 2000);

        const batteryInterval = setInterval(async () => {
            if (!this.monitoring) {
                clearInterval(batteryInterval);
                return;
            }
            await this.collectBatteryMetrics();
        }, 5000);

        // FPS izleme (daha sık)
        const fpsInterval = setInterval(async () => {
            if (!this.monitoring) {
                clearInterval(fpsInterval);
                return;
            }
            await this.collectFPSMetrics();
        }, 500);

        // Süre dolduğunda izlemeyi durdur
        setTimeout(() => {
            this.stopMonitoring();
            clearInterval(cpuInterval);
            clearInterval(memoryInterval);
            clearInterval(batteryInterval);
            clearInterval(fpsInterval);
        }, duration);

        return {
            startTime,
            duration,
            packageName
        };
    }

    async collectCPUMetrics(packageName) {
        try {
            const { stdout } = await execAsync(`adb -s ${this.currentDevice.id} shell top -n 1 -p $(adb -s ${this.currentDevice.id} shell pidof ${packageName})`);
            
            const lines = stdout.split('\n');
            const cpuLine = lines.find(line => line.includes(packageName));
            
            if (cpuLine) {
                const parts = cpuLine.trim().split(/\s+/);
                const cpuUsage = parseFloat(parts[8]) || 0;
                
                this.metrics.cpu.push({
                    timestamp: Date.now(),
                    packageName,
                    cpuUsage,
                    processId: parts[0]
                });
            }
        } catch (error) {
            console.error('CPU metrikleri toplanamadı:', error);
        }
    }

    async collectMemoryMetrics(packageName) {
        try {
            const { stdout } = await execAsync(`adb -s ${this.currentDevice.id} shell dumpsys meminfo ${packageName}`);
            
            const lines = stdout.split('\n');
            const totalPssLine = lines.find(line => line.includes('TOTAL PSS'));
            
            if (totalPssLine) {
                const match = totalPssLine.match(/(\d+)/);
                const memoryUsage = match ? parseInt(match[1]) : 0;
                
                this.metrics.memory.push({
                    timestamp: Date.now(),
                    packageName,
                    memoryUsageKB: memoryUsage,
                    memoryUsageMB: memoryUsage / 1024
                });
            }
        } catch (error) {
            console.error('Memory metrikleri toplanamadı:', error);
        }
    }

    async collectBatteryMetrics() {
        try {
            const { stdout } = await execAsync(`adb -s ${this.currentDevice.id} shell dumpsys battery`);
            
            const lines = stdout.split('\n');
            const levelLine = lines.find(line => line.includes('level:'));
            const temperatureLine = lines.find(line => line.includes('temperature:'));
            
            const batteryLevel = levelLine ? parseInt(levelLine.split(':')[1]) : 0;
            const temperature = temperatureLine ? parseInt(temperatureLine.split(':')[1]) / 10 : 0;
            
            this.metrics.battery.push({
                timestamp: Date.now(),
                batteryLevel,
                temperature
            });
        } catch (error) {
            console.error('Battery metrikleri toplanamadı:', error);
        }
    }

    async collectFPSMetrics() {
        try {
            // SurfaceFlinger'dan FPS bilgisi al
            const { stdout } = await execAsync(`adb -s ${this.currentDevice.id} shell dumpsys SurfaceFlinger --latency`);
            
            // Basit FPS hesaplama (gerçek uygulamada daha karmaşık olabilir)
            const lines = stdout.split('\n');
            const frameCount = lines.filter(line => line.trim() && !line.includes('---')).length;
            
            // 500ms aralıkta frame sayısı
            const fps = frameCount * 2; // 500ms = 0.5s, 2 ile çarpınca saniyedeki frame sayısı
            
            this.metrics.fps.push({
                timestamp: Date.now(),
                fps: Math.min(fps, 60), // Maksimum 60 FPS varsayımı
                frameCount
            });
        } catch (error) {
            console.error('FPS metrikleri toplanamadı:', error);
        }
    }

    async stopMonitoring() {
        this.monitoring = false;
        console.log('Performans izleme durduruldu');
    }

    async getCurrentMetrics() {
        return {
            cpu: this.metrics.cpu.slice(-10), // Son 10 ölçüm
            memory: this.metrics.memory.slice(-5), // Son 5 ölçüm
            battery: this.metrics.battery.slice(-3), // Son 3 ölçüm
            fps: this.metrics.fps.slice(-20) // Son 20 ölçüm
        };
    }

    async generateReport(packageName, format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `android-performance-${packageName}-${timestamp}`;

        const report = {
            device: this.currentDevice,
            packageName,
            timestamp: new Date().toISOString(),
            duration: this.metrics.cpu.length > 0 ? 
                this.metrics.cpu[this.metrics.cpu.length - 1].timestamp - this.metrics.cpu[0].timestamp : 0,
            metrics: this.metrics,
            summary: this.calculateSummary()
        };

        switch (format.toLowerCase()) {
            case 'json':
                const jsonPath = path.join(process.cwd(), 'reports', `${filename}.json`);
                await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
                return jsonPath;

            case 'csv':
                const csvPath = path.join(process.cwd(), 'reports', `${filename}.csv`);
                const csvContent = this.convertToCSV(report);
                await fs.writeFile(csvPath, csvContent);
                return csvPath;

            default:
                throw new Error(`Desteklenmeyen format: ${format}`);
        }
    }

    calculateSummary() {
        const cpuAvg = this.metrics.cpu.length > 0 ? 
            this.metrics.cpu.reduce((sum, m) => sum + m.cpuUsage, 0) / this.metrics.cpu.length : 0;
        
        const memoryAvg = this.metrics.memory.length > 0 ? 
            this.metrics.memory.reduce((sum, m) => sum + m.memoryUsageMB, 0) / this.metrics.memory.length : 0;
        
        const fpsAvg = this.metrics.fps.length > 0 ? 
            this.metrics.fps.reduce((sum, m) => sum + m.fps, 0) / this.metrics.fps.length : 0;

        return {
            averageCPU: cpuAvg.toFixed(2),
            averageMemory: memoryAvg.toFixed(2),
            averageFPS: fpsAvg.toFixed(2),
            maxCPU: Math.max(...this.metrics.cpu.map(m => m.cpuUsage)),
            maxMemory: Math.max(...this.metrics.memory.map(m => m.memoryUsageMB)),
            maxFPS: Math.max(...this.metrics.fps.map(m => m.fps))
        };
    }

    convertToCSV(report) {
        const headers = [
            'Timestamp',
            'Package Name',
            'CPU Usage (%)',
            'Memory Usage (MB)',
            'Battery Level (%)',
            'FPS',
            'Temperature (°C)'
        ];

        const rows = [];
        
        // CPU verilerini ekle
        this.metrics.cpu.forEach(metric => {
            const memoryMetric = this.metrics.memory.find(m => 
                Math.abs(m.timestamp - metric.timestamp) < 1000);
            const batteryMetric = this.metrics.battery.find(m => 
                Math.abs(m.timestamp - metric.timestamp) < 5000);
            const fpsMetric = this.metrics.fps.find(m => 
                Math.abs(m.timestamp - metric.timestamp) < 500);

            rows.push([
                new Date(metric.timestamp).toISOString(),
                metric.packageName,
                metric.cpuUsage,
                memoryMetric ? memoryMetric.memoryUsageMB : '',
                batteryMetric ? batteryMetric.batteryLevel : '',
                fpsMetric ? fpsMetric.fps : '',
                batteryMetric ? batteryMetric.temperature : ''
            ]);
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    async clearMetrics() {
        this.metrics = {
            cpu: [],
            memory: [],
            battery: [],
            network: [],
            fps: []
        };
        console.log('Metrikler temizlendi');
    }
}

module.exports = AndroidPerformanceAnalyzer; 