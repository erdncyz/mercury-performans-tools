const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAnalyzer {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        this.model = this.genAI ? this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;
    }

    async analyzeReport(reportData) {
        if (!this.model) {
            console.warn('Gemini API key bulunamadı, AI analizi atlanıyor');
            return this.getFallbackAnalysis();
        }

        try {
            console.log('🤖 Gemini AI rapor analizi başlatılıyor...');
            
            const prompt = this.generateAnalysisPrompt(reportData);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const analysis = response.text();
            
            console.log('✅ Gemini AI analizi tamamlandı');
            return this.formatAnalysis(analysis);
            
        } catch (error) {
            console.error('❌ Gemini AI analiz hatası:', error.message);
            return this.getFallbackAnalysis();
        }
    }

    generateAnalysisPrompt(reportData) {
        const { sessionData, mobileAnalysis, desktopAnalysis } = reportData;
        const { url, browserType, duration, metrics } = sessionData;

        return `
Sen bir web performans uzmanısın. Aşağıdaki performans analiz raporunu incele ve detaylı bir analiz yap.

## ANALİZ EDİLECEK SİTE:
URL: ${url}
Tarayıcı: ${browserType}
Analiz Süresi: ${Math.round(duration / 1000)} saniye

## MOBILE PERFORMANS SKORLARI:
- Performance: ${mobileAnalysis.scores.performance}/100
- Accessibility: ${mobileAnalysis.scores.accessibility}/100
- Best Practices: ${mobileAnalysis.scores.bestPractices}/100
- SEO: ${mobileAnalysis.scores.seo}/100

## DESKTOP PERFORMANS SKORLARI:
- Performance: ${desktopAnalysis.scores.performance}/100
- Accessibility: ${desktopAnalysis.scores.accessibility}/100
- Best Practices: ${desktopAnalysis.scores.bestPractices}/100
- SEO: ${desktopAnalysis.scores.seo}/100

## CORE WEB VITALS (Mobile):
${this.formatCoreWebVitals(mobileAnalysis.performanceMetrics)}

## CORE WEB VITALS (Desktop):
${this.formatCoreWebVitals(desktopAnalysis.performanceMetrics)}

## KULLANICI ETKİLEŞİMLERİ:
- Ziyaret Edilen Sayfa Sayısı: ${metrics.navigationEvents.length}
- Tıklama Sayısı: ${metrics.userInteractions.filter(i => i.type === 'click').length}
- Kaydırma Sayısı: ${metrics.userInteractions.filter(i => i.type === 'scroll').length}

## OPTİMİZASYON ÖNERİLERİ (Mobile):
${this.formatOpportunities(mobileAnalysis.opportunities)}

## OPTİMİZASYON ÖNERİLERİ (Desktop):
${this.formatOpportunities(desktopAnalysis.opportunities)}

---

Lütfen aşağıdaki başlıklar altında detaylı bir analiz yap:

## 📊 GENEL PERFORMANS DEĞERLENDİRMESİ
- Genel performans durumu nasıl?
- Mobile vs Desktop karşılaştırması
- En iyi ve en kötü yönler

## 🎯 CORE WEB VITALS ANALİZİ
- FCP, LCP, FID, CLS değerlerinin yorumlanması
- Hangi metrikler iyi/kötü?
- İyileştirme önerileri

## 🚀 OPTİMİZASYON ÖNERİLERİ
- En kritik iyileştirmeler
- Öncelik sırası
- Tahmini performans artışı

## 📱 MOBILE PERFORMANS
- Mobile özel sorunlar
- Responsive tasarım değerlendirmesi
- Mobile kullanıcı deneyimi

## 💻 DESKTOP PERFORMANS
- Desktop özel sorunlar
- Büyük ekran optimizasyonu
- Desktop kullanıcı deneyimi

## 🎯 ÖNCELİKLİ AKSİYONLAR
- Hemen yapılması gerekenler (1-2 hafta)
- Orta vadeli iyileştirmeler (1-2 ay)
- Uzun vadeli optimizasyonlar (3-6 ay)

## 📈 PERFORMANS SKORU TAHMİNİ
- Mevcut optimizasyonlar yapıldıktan sonra beklenen skorlar
- Hedef performans seviyeleri

Analyze in the user's preferred language and explain technical terms. Use user-friendly language but keep it professional. If the user's language is not specified, respond in English.
`;
    }

    formatCoreWebVitals(metrics) {
        const vitals = [
            { name: 'First Contentful Paint (FCP)', metric: metrics.firstContentfulPaint },
            { name: 'Largest Contentful Paint (LCP)', metric: metrics.largestContentfulPaint },
            { name: 'First Input Delay (FID)', metric: metrics.firstInputDelay },
            { name: 'Cumulative Layout Shift (CLS)', metric: metrics.cumulativeLayoutShift },
            { name: 'Speed Index', metric: metrics.speedIndex },
            { name: 'Total Blocking Time (TBT)', metric: metrics.totalBlockingTime },
            { name: 'Time to Interactive (TTI)', metric: metrics.timeToInteractive }
        ];

        return vitals.map(vital => {
            if (!vital.metric) return `- ${vital.name}: Veri yok`;
            return `- ${vital.name}: ${vital.metric.displayValue} (Skor: ${Math.round((vital.metric.score || 0) * 100)})`;
        }).join('\n');
    }

    formatOpportunities(opportunities) {
        if (!opportunities || opportunities.length === 0) {
            return "Önemli optimizasyon önerisi bulunamadı.";
        }

        return opportunities.slice(0, 5).map(opp => 
            `- ${opp.title}: ${opp.displayValue || 'Potansiyel iyileştirme'}`
        ).join('\n');
    }

    formatAnalysis(analysis) {
        return {
            timestamp: new Date().toISOString(),
            analysis: analysis,
            summary: this.extractSummary(analysis),
            recommendations: this.extractRecommendations(analysis),
            priority: this.extractPriority(analysis)
        };
    }

    extractSummary(analysis) {
        // İlk paragrafı özet olarak al
        const lines = analysis.split('\n');
        const summaryLines = [];
        
        for (let line of lines) {
            if (line.trim() && !line.startsWith('##')) {
                summaryLines.push(line.trim());
                if (summaryLines.length >= 3) break;
            }
        }
        
        return summaryLines.join(' ');
    }

    extractRecommendations(analysis) {
        const recommendations = [];
        const lines = analysis.split('\n');
        let inRecommendations = false;
        
        for (let line of lines) {
            if (line.includes('ÖNERİLERİ') || line.includes('AKSİYONLAR')) {
                inRecommendations = true;
                continue;
            }
            
            if (inRecommendations && line.startsWith('##')) {
                break;
            }
            
            if (inRecommendations && line.trim().startsWith('-')) {
                recommendations.push(line.trim().substring(1).trim());
            }
        }
        
        return recommendations.slice(0, 5);
    }

    extractPriority(analysis) {
        if (analysis.includes('kritik') || analysis.includes('acil')) return 'high';
        if (analysis.includes('orta') || analysis.includes('normal')) return 'medium';
        return 'low';
    }

    getFallbackAnalysis() {
        return {
            timestamp: new Date().toISOString(),
            analysis: `
## 📊 GENEL PERFORMANS DEĞERLENDİRMESİ
Gemini AI analizi şu anda kullanılamıyor. Lütfen raporu manuel olarak inceleyin.

## 🎯 CORE WEB VITALS ANALİZİ
Performans metriklerini yukarıdaki tablolardan kontrol edin.

## 🚀 OPTİMİZASYON ÖNERİLERİ
PageSpeed Insights önerilerini inceleyin.

## 📈 PERFORMANS SKORU TAHMİNİ
Mevcut skorları iyileştirmek için önerileri uygulayın.
            `,
            summary: "Gemini AI analizi kullanılamıyor. Manuel inceleme önerilir.",
            recommendations: ["Raporu manuel olarak inceleyin", "PageSpeed Insights önerilerini uygulayın"],
            priority: 'medium'
        };
    }
}

module.exports = GeminiAnalyzer; 