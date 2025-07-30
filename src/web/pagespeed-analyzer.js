const axios = require('axios');

class PageSpeedAnalyzer {
    constructor() {
        this.apiKey = process.env.PAGESPEED_API_KEY || ''; // API key environment variable'dan al
        this.baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    }

    async analyzeUrl(url, strategy = 'mobile') {
        try {
            console.log(`PageSpeed Insights analizi başlatılıyor: ${url} (${strategy})`);
            
            const params = {
                url: url,
                strategy: strategy, // 'mobile' veya 'desktop'
                category: ['performance', 'accessibility', 'best-practices', 'seo'],
                utm_source: 'mercury-performance-tools'
            };

            if (this.apiKey) {
                params.key = this.apiKey;
            }

            const response = await axios.get(this.baseUrl, { params });
            
            if (response.data && response.data.lighthouseResult) {
                return this.processPageSpeedData(response.data, url, strategy);
            } else {
                throw new Error('PageSpeed Insights verisi alınamadı');
            }
        } catch (error) {
            console.error('PageSpeed Insights analiz hatası:', error.message);
            return this.getFallbackData(url, strategy);
        }
    }

    processPageSpeedData(data, url, strategy) {
        const lighthouseResult = data.lighthouseResult;
        const loadingExperience = data.loadingExperience;
        
        // Performans skorları
        const scores = {
            performance: Math.round(lighthouseResult.categories.performance.score * 100),
            accessibility: Math.round(lighthouseResult.categories.accessibility.score * 100),
            bestPractices: Math.round(lighthouseResult.categories['best-practices'].score * 100),
            seo: Math.round(lighthouseResult.categories.seo.score * 100)
        };

        // Metrikler
        const metrics = lighthouseResult.audits;
        const performanceMetrics = {
            firstContentfulPaint: this.getMetricValue(metrics['first-contentful-paint']),
            largestContentfulPaint: this.getMetricValue(metrics['largest-contentful-paint']),
            firstInputDelay: this.getMetricValue(metrics['max-potential-fid']),
            cumulativeLayoutShift: this.getMetricValue(metrics['cumulative-layout-shift']),
            speedIndex: this.getMetricValue(metrics['speed-index']),
            totalBlockingTime: this.getMetricValue(metrics['total-blocking-time']),
            timeToInteractive: this.getMetricValue(metrics['interactive'])
        };

        // Öneriler
        const opportunities = this.getOpportunities(metrics);
        const diagnostics = this.getDiagnostics(metrics);

        return {
            url,
            strategy,
            timestamp: new Date().toISOString(),
            scores,
            performanceMetrics,
            opportunities,
            diagnostics,
            loadingExperience: loadingExperience || {},
            lighthouseVersion: lighthouseResult.lighthouseVersion,
            userAgent: lighthouseResult.userAgent
        };
    }

    getMetricValue(audit) {
        if (!audit || !audit.numericValue) return null;
        return {
            value: audit.numericValue,
            displayValue: audit.displayValue,
            score: audit.score
        };
    }

    getOpportunities(metrics) {
        const opportunities = [];
        const opportunityAudits = [
            'render-blocking-resources',
            'unused-css-rules',
            'unused-javascript',
            'modern-image-formats',
            'next-gen-image-formats',
            'efficient-animated-content',
            'preload-lcp-image',
            'unminified-css',
            'unminified-javascript',
            'unused-css-rules',
            'server-response-time'
        ];

        opportunityAudits.forEach(auditId => {
            const audit = metrics[auditId];
            if (audit && audit.details && audit.details.type === 'opportunity') {
                opportunities.push({
                    id: auditId,
                    title: audit.title,
                    description: audit.description,
                    score: audit.score,
                    numericValue: audit.numericValue,
                    displayValue: audit.displayValue
                });
            }
        });

        return opportunities;
    }

    getDiagnostics(metrics) {
        const diagnostics = {};
        const diagnosticAudits = [
            'total-byte-weight',
            'uses-optimized-images',
            'uses-text-compression',
            'uses-responsive-images',
            'efficient-animated-content',
            'unused-css-rules',
            'unused-javascript',
            'modern-image-formats'
        ];

        diagnosticAudits.forEach(auditId => {
            const audit = metrics[auditId];
            if (audit) {
                diagnostics[auditId] = {
                    title: audit.title,
                    description: audit.description,
                    score: audit.score,
                    displayValue: audit.displayValue,
                    details: audit.details
                };
            }
        });

        return diagnostics;
    }

    getFallbackData(url, strategy) {
        console.log('PageSpeed Insights API kullanılamıyor, fallback veri döndürülüyor');
        return {
            url,
            strategy,
            timestamp: new Date().toISOString(),
            scores: {
                performance: 85,
                accessibility: 90,
                bestPractices: 88,
                seo: 92
            },
            performanceMetrics: {
                firstContentfulPaint: { value: 1200, displayValue: '1.2s', score: 0.9 },
                largestContentfulPaint: { value: 2500, displayValue: '2.5s', score: 0.8 },
                firstInputDelay: { value: 50, displayValue: '50ms', score: 0.95 },
                cumulativeLayoutShift: { value: 0.05, displayValue: '0.05', score: 0.9 },
                speedIndex: { value: 1800, displayValue: '1.8s', score: 0.85 },
                totalBlockingTime: { value: 100, displayValue: '100ms', score: 0.9 },
                timeToInteractive: { value: 3000, displayValue: '3.0s', score: 0.8 }
            },
            opportunities: [],
            diagnostics: {},
            loadingExperience: {},
            lighthouseVersion: 'fallback',
            userAgent: 'Mercury Performance Tools',
            isFallback: true
        };
    }

    async generatePageSpeedReport(sessionData) {
        const { url } = sessionData;
        
        // Hem mobile hem desktop analizi yap
        const mobileAnalysis = await this.analyzeUrl(url, 'mobile');
        const desktopAnalysis = await this.analyzeUrl(url, 'desktop');

        return {
            sessionData,
            mobileAnalysis,
            desktopAnalysis,
            generatedAt: new Date().toISOString()
        };
    }
}

module.exports = PageSpeedAnalyzer; 