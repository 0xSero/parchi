# Parchi - AI Tarayıcı Asistanı Özet

Parchi, AI destekli bir tarayıcı asistanıdır. Doğal dil komutlarıyla tarayıcıda gezinme, okuma, tıklama ve veri çekme işlemleri yapar.

## Ana Özellikler

### Chat & AI
- Akışlı yanıt verme ve düşünme sürecini gösterme
- Çoklu profiller ile farklı AI sağlayıcıları kullanımı
- Vizyon desteği ile ekran görüntüsü analizi

### Tarayıcı Otomasyonu (25+ araç)
**Gezinme:** `navigate`, `openTab`, `closeTab`, `switchTab`
**Etkileşim:** `click`, `type`, `pressKey`, `scroll` 
**Okuma:** `getContent`, `screenshot`, `findHtml`
**Sekmeler:** `groupTabs`, `getTabs`, `describeSessionTabs`
**Planlama:** `set_plan`, `update_plan`
**Araçlar:** `spawn_subagent`, `subagent_complete`

### Oturum Yönetimi
- Otomatik sekme gruplama
- 50 oturum, 200 mesaj geçmişi
- Markdown dışa aktarma

### Ayarlar & Kontroller
- Araç izinleri ve alan adı listesi
- Tema seçimi ve UI zoom
- API anahtarı yapılandırması

## Teknik Yapı
- Chrome MV3 ve Firefox desteği
- Relay Daemon ile lokal otomasyon uç noktası
- Background Service Worker işlem yönetimi
- Content Script ile doğrudan tarayıcı eylemleri
- AI SDK entegrasyonu

## Kurulum & Kullanım
1. Chrome veya Firefox uzantısı kurulumu
2. API anahtarı veya Parchi hesabını kullanarak AI sağlayıcı yapılandırması  
3. CLI proxy desteği ile mevcut aboneliklerle çalışabilme
4. Uzantının kenar çubuğunda doğrudan erişim

## CSP Hatası Düzeltmesi (2026-02-23)
### Sorun
Firefox'ta uzantı etkinken CPU kullanımı %100'e çıkıyordu. Content-Security-Policy (CSP) hatası nedeniyle:
```
Content-Security-Policy: The page's settings blocked an event handler (script-src-attr)
```

### Neden
`panel-session-tabs.ts:77` satırında inline event handler kullanılıyordu:
```javascript
faviconHtml = `<img class="session-tab-favicon" src="${origin}/favicon.ico" onerror="this.style.display='none'" alt="">`;
```

### Çözüm
Inline event handler kaldırıldı ve JavaScript ile programatik hata yönetimi eklendi:
```javascript
const img = document.createElement('img');
img.className = 'session-tab-favicon';
img.src = `${origin}/favicon.ico`;
img.alt = '';
img.onerror = () => {
  img.style.display = 'none';
};
faviconHtml = img.outerHTML;
```

### Adımlar
1. `panel-session-tabs.ts` dosyası düzenlendi
2. `npm install` ile eksik paketler yüklendi
3. `npm run build:firefox` ile Firefox için build tamamlandı
4. `npm run build:firefox:xpi` ile XPI paketi oluşturuldu
5. `dist-firefox/parchi-0.3.10.xpi` dosyası Firefox'ta test edildi

### Sonuç
- Firefox'un CSP politikası artık bu dosyayı engellemiyor
- CPU kullanımı normal seviyede
- Extension başarıyla çalışıyor