---
name: chrome-extension-development
description: "Use when: building a Chrome extension add-on, MV3 browser extension, popup/options page, background service worker, content script, or browser automation feature. Includes architecture choices, secure coding standards, and test criteria for production-ready Chrome add-ons."
---

# Chrome Extension Development Skill

## 目的

Chrome 拡張機能を安全かつ保守しやすく設計・実装し、最低限の権限と明確な責務分離で、利用者が信頼できるアドオンを作る。

## 必要なスキル

このスキルで扱う主要領域は次のとおり。

1. 要件整理スキル
   - ユーザーが何を解決したいかを明確化する
   - 拡張機能の対象ブラウザ操作範囲を定義する
   - 必要最小限の権限とページ対象範囲を定義する

2. アーキテクチャ設計スキル
   - MV3 の Manifest 設計
   - popup / options / side panel / content script / service worker の役割分担
   - message passing の設計
   - storage と state management の設計

3. コード実装スキル
   - バックグラウンド処理と UI の分離
   - DOM 操作の安全化
   - エラー処理とログ設計
   - 監査しやすいモジュール構造

4. セキュリティと運用スキル
   - 最小権限の原則
   - 通信/入力値の検証
   - CSP と eval の回避
   - 既知の API 制約への対応

5. 品質保証スキル
   - 単体テスト・統合テスト・手動確認の設計
   - Chrome での実際の読み込み・動作確認
   - バグ回帰防止のチェックリスト

---

## 実施フロー

### 1. 目的と範囲の確認

- 何を自動化する拡張機能なのかを 1 文で説明できるか
- 対象ページ、対象タブ、対象 URL を定義する
- 必要になる権限を調査し、不要な権限を排除する
- 「popup だけか」「content script が必要か」「background で処理すべきか」を決める

### 2. 拡張機能の形態を決める

#### 選択基準

- UI が必要か
  - はい: popup / options / side panel を選定
- ページの DOM をいじる必要があるか
  - はい: content script を使用
- 常時バックグラウンド処理が必要か
  - はい: service worker / offscreen を検討
- 記憶したいデータがあるか
  - はい: chrome.storage.local または sync を検討
- 外部の API とやり取りが必要か
  - はい: host permissions と message passing を設計

#### 典型パターン

- Web ページの情報収集: content script + popup
- 1 クリック処理: action popup + background
- 通知・追跡・定期処理: service worker + storage
- 設定画面付き: options page + storage

### 3. 設計を固める

- Manifest V3 を前提とし、`permissions` と `host_permissions` を最小化する
- message passing の命名規則と payload 形式を決める
- UI とロジックを分離し、状態を保存する責務を明確にする
- エラー時の回復手順とメッセージ設計を作る

### 4. 実装する

- 1 ファイルに責務を詰め込みすぎない
- background / popup / options / content scripts をモジュール化する
- 日本語/英語の logs は一貫したルールにする
- UI のイベントハンドラは薄くし、ロジックは別モジュールに切り出す

### 5. 検証する

- Chrome で unpacked 拡張機能として読み込む
- 権限不足・API 利用制限・DOM 依存のエラーを確認する
- 統合フローを手動で再現し、異常系も試す
- 変更後に回帰確認のリストを回す

---

## コード作成基準

### 1. 基本原則

- 最小権限原則: 必要な権限のみを要求する
- 責務分離: UI とロジックと永続化を別にする
- 安全な DOM 操作: innerHTML の乱用を避ける、ユーザー入力は検証・エスケープする
- 予測可能なイベント設計: message keys と payload を固定する
- 例外時の回復: エラーを UI で把握できるようにする

### 2. Manifest 設計基準

- 可能な限り MV3 を使用する
- `manifest_version: 3` を必須とする
- `permissions` は機能ごとに必要なものだけを許可する
- `host_permissions` は必要なドメインに限定する
- `content_security_policy` を必要に応じて厳格にする
- `web_accessible_resources` は必要最小限のみ公開する

### 3. Architecture 基準

- popup は簡潔な UI とイベントリスナーに限定する
- background/service worker は長時間要件がある処理を担う
- content script は「ページに対する横断的変換」を担当し、UI ロジックを持たせない
- options page は設定の保存と検証を担当する
- storage のアクセスは薄い wrapper で一元化する

### 4. Implementation 基準

- メッセージ名は `type` で明示し、payload をスキーマに近い形にする
- 例外を握りつぶさず、適切にログに残す
- リトライやタイムアウトを設計する
- 署名付きデータや外部入力を扱う場合は、信頼境界を明示する
- クライアント側のバリデーションだけでなく、サーバー側の検証が必要ならその前提を明記する

### 5. UX / Accessibility 基準

- popup と options page はキーボード操作に対応する
- 重要な状態変化は明確に見える UI へ落とし込む
- 失敗時はユーザーにわかるメッセージを出す
- 依存している API が利用不可な場合の状態を考慮する

---

## テスト基準

### 1. 単体テスト

以下のロジックを最低限確認する。

- message payload 変換
- storage の save / load / delete
- URL 判定ロジック
- 条件分岐と例外ハンドリング
- DOM 選択と安全な更新

### 2. 統合テスト

- popup から background への message を確認する
- content script と page の相互作用を確認する
- storage の永続化が期待どおりか確認する
- 複数タブや複数ページの利用時に state が破綻しないことを確認する

### 3. Browser 実行テスト

- `chrome://extensions` から unpacked load を実施する
- 拡張機能がエラーなく読み込めることを確認する
- 適切な権限付与時と不足時の動作を確認する
- 重大な console error が出ていないことを確認する

### 4. 手動確認チェックリスト

- 拡張機能アイコンをクリックして正常に開く
- popup で操作を行い、期待した state 変化が起こる
- content script が対象ページに対して安全に動く
- `chrome.storage` にデータが保存されている
- 不正入力や API エラー時に UI が適切に応答する
- 権限のないページ / 対象外 URL で不正動作しない

### 5. 品質ゲート

- 重大な既知エラーがない
- 必須動作のテストが実施済み
- 重要機能に対する回帰テストが存在する
- 0 件の重大バグが確認できる状態で完了とする

---

## 完了判定

次の条件を満たすと、Chrome 拡張機能開発タスクは完了とみなす。

- 要件が明文化されている
- 権限が最小限に抑えられている
- 機能ごとに責務が分離されている
- manifest と message passing の構造が明確である
- 主要フローのテストが実施済みである
- Chrome で導入・確認できる
- 異常系が確認されている

---

## 例: 実行するプロンプト

- 「Chrome 拡張機能を作りたい。MV3 の manifest と popup/background/content script の構成を設計して」
- 「対象ページに DOM を注入する拡張機能を作る。最小権限で安全な設計を提案して」
- 「この Chrome 拡張機能の messaging 設計を改善し、テスト観点も含めて整理して」
- 「拡張機能のコード作成基準とテスト基準を規定した設計書を作って」

---

## 関連カスタマイズ候補

- `chrome-extension-security` を作り、権限管理と危険な API 仕様をまとめる
- `browser-extension-tests` を作り、Playwright や Chrome 拡張機能用の smoke test を標準化する
- `extension-release-checklist` を作り、リリース前の確認項目を定義する
