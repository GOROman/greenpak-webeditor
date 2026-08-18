# SLG46826 実装メモ

出典:
- [In-System Programming Guide ISPG-SLG46824/6 Rev 1.5](https://www.renesas.com/en/document/mat/system-programming-guide-slg468246)
- [SLG46826 データシート Rev 3.18](https://akizukidenshi.com/goodsaffix/SLG46826.pdf)

## I2Cアドレッシング
コントロールバイト = `[CC3 CC2 CC1 CC0 | A10 A9 A8 | R/W]`。
コントロールコード既定値 **0001**。ブロックアドレス A10:A8:

| ブロック | 空間 | 7bitアドレス (CC=0001) |
|---|---|---|
| 000 | 揮発レジスタ (256B) | 0x08 |
| 010 | NVMコンフィグ (256B, MTP) | 0x0A |
| 011 | エミュレートEEPROM (256B) | 0x0B |

## NVM構成
- 16ページ × 16バイト。**ページ0–13がデザイン**、**ページ14=保護ページ**
  (RPR/NPR/WPR — 誤書き込みで永久ロックの恐れ)、**ページ15=ファクトリー
  サービスページ (読み取り専用、消去厳禁)**
- 消去: レジスタ空間 0xE3 (ERSR) に `0x80|page` (NVM) / `0x90|page` (EEPROM)。
  tER max 20ms。**エラッタ: ERSRデータバイトにNACKが返る個体がある** —
  NACKを無視してSTOP、以後ACKポーリングで完了検出
- 書き込み: NVMブロックへ `page<<4` から16バイト。tWR max 20ms。NVM書込時のI2Cは400kHzまで
- リセット: レジスタ 0xC8 ← 0x02 (NVM→レジスタ再ロード)。電源断/リセットまで新デザインは反映されない

## ベリファイ無視バイト (ISPガイド Table 4)
0x68–0x6B, 0x73–0x7F, 0x83, 0x8D, 0x9D, 0xC0, 0xC9, 0xCD–0xCF, 0xE3, 0xE5, 0xF0–0xFF

## 注意
- NVMの 0xCA 付近 (bits [1623:1620]) はI2Cコントロールコード設定。
  0001以外を焼くとリセット後にI2Cアドレスが変わる。コンパイラは常に0001を出力する
- 電気仕様: 書込 VDD 2.5–5.5V / 読出 2.3V〜。M5StampS3接続時は3.3V運用
- MTP書き換え回数 ≈ 1000回 → 試行は揮発レジスタ書込を基本にする
