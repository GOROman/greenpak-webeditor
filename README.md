# GreenPAK Web Editor

秋月電子の **SLG46826V DIP化モジュール** ([通販コード 118084](https://akizukidenshi.com/catalog/g/g118084/)) 用の
ブラウザ論理エディタ + M5StampS3 ブリッジファームウェアです。

- **web/** — ノードグラフエディタ (Vite + TypeScript)。ブラウザ内でグラフを
  SLG46826 の256バイトコンフィグイメージにコンパイルし、WebSerial 経由で書き込みます。
  74シリーズロジックIC (7400/02/04/08/32/86/74) のプリセット付き。
- **firmware/** — M5StampS3 用ファームウェア (PlatformIO + Arduino)。
  USBシリアル(JSONライン) ⇔ I2C ブリッジ。SDA/SCLピンはWeb UIから変更可能(NVS保存)。
- **docs/** — [シリアルプロトコル仕様](docs/protocol.md) / [SLG46826メモ](docs/slg46826-notes.md)

## 使い方

### ファームウェア書き込み
```sh
cd firmware
pio run -t upload
```

### Webエディタ起動
```sh
cd web
npm install
npm run dev
```
Chrome/Edge で http://localhost:5173 を開く (WebSerial対応ブラウザ必須)。

### 配線
| M5StampS3 | SLG46826V DIPモジュール |
|---|---|
| 3.3V | 20番 VDD + 7番 VDD2 |
| GND | 10番 GND |
| GPIO13 (デフォルトSDA) | 12番 SDA |
| GPIO15 (デフォルトSCL) | 13番 SCL |

モジュールのピン番号はTSSOP-20と同一です。ロジックに使えるピン:

| モジュールピン | IO | 備考 |
|---|---|---|
| 1–6, 8 | IO14–IO9, IO8 | 入出力 (VDD2系) |
| 9, 11 | IO7, IO6 | **出力専用** |
| 14–19 | IO5–IO0 | 入出力 (VDD系) |

- SDA/SCL には **2.2〜4.7kΩのプルアップ抵抗を3.3Vへ** 接続してください。
- StampS3 と接続中は必ず 3.3V 駆動 (5V 禁止)。
- I2Cピンは画面右上 ⚙ から変更できます。

### 操作
1. 「接続」→ M5StampS3 のポートを選択。I2Cスキャンで 0x08/0x0a/0x0b が見えれば認識OK
2. プリセット選択 or パレットからブロック配置 → 出力ポートから入力ポートへドラッグで配線
3. **レジスタへ書込 (揮発)** で試行 (電源断で消える・回数無制限)、
   **NVMへ書込 (不揮発)** で焼き込み (約1000回制限・ベリファイ付き)

## 安全機構
- NVMページ15 (ファクトリーサービスページ) には絶対に書き込みません
- ページ14 (保護ページ) もデフォルトで対象外
- ERSR消去時のNACKエラッタ対応済み (NACKを無視してACKポーリング)
- ベリファイはISPガイドの無視ビットマスクを適用して比較
