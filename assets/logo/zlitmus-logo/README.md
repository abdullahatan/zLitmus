# zLitmus logo seti — L2 · Şerit Sap

Büyütecin sapı bir turnusol şerididir. Sapın ucu, test sonucunun rengini alır: başarılıysa yeşil, başarısızsa kırmızı, beklerken gri. Merceğin içindeki `< >` ise kodu temsil eder.

Bütün dosyaların arka planı şeffaftır (uygulama ikonları hariç). Yazılar SVG içinde vektöre (path) çevrildi, yani fontu kurulu olmayan bir bilgisayarda da aynı görünür.

## Klasörler

| Klasör | İçerik |
|---|---|
| `svg/mark/` | Sadece işaret, yazı yok. Varyantlar: başarılı (varsayılan), `fail`, `waiting`, `on-dark` (koyu zemin), `mono-black`, `mono-white` |
| `svg/mark-small/` | 32 px ve altı için sadeleştirilmiş işaret: köşeli parantezler kaldırıldı, çizgiler kalınlaştırıldı |
| `svg/wordmark/` | Sadece yazı (zLitmus): renkli, koyu zemin, tek renk siyah/beyaz |
| `svg/lockup/` | İşaret ve yazı birlikte: yatay, yatay + slogan, dikey (`stacked`); koyu zemin ve tek renk halleri |
| `svg/icon/` | Uygulama ikonları (zeminli): koyu, açık, kare, küçük |
| `png/` | Yukarıdakilerin PNG çıktıları. İşaret: 16–1024 px (16 ve 32 px dosyalar küçük sürümden üretildi). Lockup'lar 1200 ve 2400 px genişlikte |
| `favicon/` | `favicon.ico` (16/32/48), `favicon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` |
| `fonts/` | Space Grotesk lisansı (SIL OFL 1.1) |

## Renkler

| Ad | HEX | Kullanım |
|---|---|---|
| Lacivert (Ink) | `#0F1B2A` | İşaret, yazı, koyu zemin |
| Yeşil (Pass) | `#1FA463` | 2xx, SOAP Fault içermeyen cevap; "z" harfi |
| Kırmızı (Fail) | `#E0484E` | 4xx, 5xx, SOAP Fault, timeout |
| Gri (Waiting) | `#B8C2CE` | Cevap bekleniyor |
| Slogan grisi | `#5B6573` | Açık zeminde slogan |

Kural: yeşil ve kırmızıyı yalnızca sonucu göstermek için kullan. Dekorasyon ya da HTTP metot renkleri için kullanma.

## Kullanım kuralları

- **Font:** Space Grotesk. "z" Medium 500 ağırlığında ve yeşil; "Litmus" Bold 700 ağırlığında. Harf aralığı −0.045em.
- **Boşluk:** Logonun çevresinde en az merceğin yarıçapı kadar boşluk bırak.
- **En küçük boyut:** Tam işaret için 40 px; bunun altında `mark-small` kullan. Slogan sadece yatay logo 320 px ve üzerindeyken kullanılır.
- **Yapma:** İşareti döndürme, gölge ya da gradyan ekleme. Sap ucunun rengini sonuç dışında bir anlamla kullanma.
- **Araç içinde:** Durum göstermek için `zlitmus-mark-fail.svg` ve `zlitmus-mark-waiting.svg` dosyalarını kullanabilirsin.

Lisans: logo zLitmus projesinin MIT lisanslı reposuyla birlikte dağıtılır. Font: SIL Open Font License 1.1.
