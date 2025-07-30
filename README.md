# Mercury Performance Tools ☿

Mercury Performance Tools, web siteleri ve mobil uygulamalar için kapsamlı performans analiz ve izleme aracıdır. Modern web teknolojileri kullanarak gerçek zamanlı performans metrikleri toplar ve detaylı raporlar oluşturur.

## 🚀 Özellikler

### Web Performans Analizi
- **Sayfa Yükleme Süresi**: Tam sayfa yükleme süresini ölçer
- **Core Web Vitals**: FCP, LCP, CLS metriklerini hesaplar
- **Navigation Timing**: DNS lookup, TCP connection, server response sürelerini analiz eder
- **Resource Timing**: Tüm kaynakların yükleme sürelerini takip eder
- **Performance Score**: Lighthouse benzeri performans skoru hesaplar

### Mobil Performans İzleme
- **Android Cihaz Desteği**: ADB ile bağlı Android cihazları otomatik tespit eder
- **CPU Kullanımı**: Gerçek zamanlı CPU kullanım oranını izler
- **Memory Kullanımı**: RAM kullanımını takip eder
- **Battery Monitoring**: Batarya seviyesi ve sıcaklık izleme
- **FPS Tracking**: Frame rate performansını ölçer
- **App Performance**: Uygulama başlatma ve çalışma performansını analiz eder

### Raporlama
- **JSON Raporları**: Detaylı JSON formatında raporlar
- **CSV Export**: Excel'de açılabilir CSV raporları
- **PDF Raporları**: Profesyonel PDF raporları (gelecek sürümde)
- **Real-time Charts**: Canlı grafikler ve metrikler

## 🛠️ Kurulum

### Gereksinimler
- Node.js 16+ 
- npm veya yarn
- Android SDK (mobil analiz için)
- ADB (Android Debug Bridge)

### Kurulum Adımları

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd mercury-performance-tools
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Gerekli klasörleri oluşturun**
```bash
mkdir -p reports data
```

4. **Android SDK kurulumu (opsiyonel)**
```bash
# Android Studio ile birlikte gelir
# Veya sadece command line tools:
# https://developer.android.com/studio#command-tools
```

## 🚀 Kullanım

### Web Uygulaması
```bash
npm start
```
Tarayıcıda `http://localhost:3000` adresini açın.

### Development Modu
```bash
npm run dev
```

## 📊 Kullanım Kılavuzu

### Web Performans Analizi

1. **Web Performans** sekmesine gidin
2. Analiz etmek istediğiniz URL'yi girin
3. **Analiz Et** butonuna tıklayın
4. Sonuçları grafiklerde görüntüleyin
5. İstediğiniz formatta rapor indirin

### Mobil Performans İzleme

1. **Mobil Performans** sekmesine gidin
2. Android cihazınızı USB ile bağlayın
3. **Cihazları Yenile** butonuna tıklayın
4. Cihazınızı seçin
5. İzlemek istediğiniz uygulamayı seçin
6. **İzlemeyi Başlat** butonuna tıklayın
7. Gerçek zamanlı metrikleri takip edin

### Dashboard

- **Sistem Durumu**: Web ve Android analyzer'ların durumunu gösterir
- **Son Raporlar**: Oluşturulan raporların listesi
- **Hızlı Erişim**: Sık kullanılan işlemler

## 🔧 API Endpoints

### Web Performance
- `POST /api/web/analyze` - Web sitesi analizi
- `POST /api/web/report` - Web raporu oluşturma

### Android Performance
- `GET /api/android/devices` - Bağlı cihazları listele
- `POST /api/android/select-device` - Cihaz seç
- `GET /api/android/apps` - Yüklü uygulamaları listele
- `POST /api/android/start-monitoring` - İzlemeyi başlat
- `POST /api/android/stop-monitoring` - İzlemeyi durdur
- `GET /api/android/metrics` - Mevcut metrikleri al
- `POST /api/android/report` - Android raporu oluştur

### Genel
- `GET /api/status` - Sistem durumu
- `GET /api/reports` - Rapor listesi
- `GET /reports/:filename` - Rapor indir

## 📁 Proje Yapısı

```
mercury-performance-tools/
├── src/
│   ├── web-server.js           # Express web server
│   ├── web/
│   │   └── performance-analyzer.js  # Web performans analizi
│   └── mobile/
│       └── android-analyzer.js      # Android performans analizi
├── public/
│   ├── index.html              # Ana HTML dosyası
│   ├── css/
│   │   └── style.css           # Stil dosyası
│   └── js/
│       ├── lib/
│       │   ├── socket.io.js    # Local Socket.IO
│       │   └── chart.js        # Local Chart.js
│       └── app.js              # Frontend JavaScript
├── reports/                    # Oluşturulan raporlar
├── data/                       # Veri dosyaları
└── package.json
```

## 🛠️ Teknolojiler

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: Vanilla JavaScript, Chart.js
- **Browser Automation**: Playwright
- **Mobile Testing**: ADB (Android Debug Bridge)
- **Styling**: CSS3, Flexbox, Grid

## 📈 Performans Metrikleri

### Web Metrikleri
- **Page Load Time**: Tam sayfa yükleme süresi
- **First Contentful Paint (FCP)**: İlk içerik görüntüleme
- **Largest Contentful Paint (LCP)**: En büyük içerik görüntüleme
- **Cumulative Layout Shift (CLS)**: Layout kayması
- **Time to Interactive (TTI)**: Etkileşim zamanı
- **Speed Index**: Hız indeksi

### Mobil Metrikleri
- **CPU Usage**: CPU kullanım oranı (%)
- **Memory Usage**: RAM kullanımı (MB)
- **Battery Level**: Batarya seviyesi (%)
- **Temperature**: Cihaz sıcaklığı (°C)
- **FPS**: Frame rate (fps)
- **App Launch Time**: Uygulama başlatma süresi

## 🔍 Sorun Giderme

### Web Analizi Çalışmıyor
- Playwright browser'ının yüklü olduğundan emin olun
- `npx playwright install chromium` komutunu çalıştırın

### Android Cihaz Bulunamıyor
- ADB'nin kurulu olduğunu kontrol edin
- Cihazın USB debugging modunda olduğundan emin olun
- `adb devices` komutu ile cihazı test edin

### Port Çakışması
- 3000 portu kullanımdaysa `src/web-server.js` dosyasında portu değiştirin

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 🆘 Destek

Sorunlarınız için:
- GitHub Issues kullanın
- Dokümantasyonu kontrol edin
- Stack Overflow'da arayın

## 🔮 Gelecek Özellikler

- [ ] iOS cihaz desteği
- [ ] PDF rapor oluşturma
- [ ] E-posta rapor gönderimi
- [ ] Slack/Discord entegrasyonu
- [ ] CI/CD pipeline entegrasyonu
- [ ] Cloud deployment
- [ ] Multi-user support
- [ ] Advanced analytics dashboard

---

**Mercury Performance Tools** - Performans analizi için güçlü ve kullanıcı dostu web uygulaması ☿ 