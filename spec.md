本レポジトリのソフトウェアが実現する機能を説明する。

このソフトウェアはchromeの拡張機能/アドオンです。github内の機能のみでFMEAやリスクアセスメント、FTAを表現するためのツールです。
以下のうち、"*"で記述されたものは、本機能の外部仕様です。
以下のうち、"* *"で記述されたものは、本機能を実装するための内部仕様です。


## メニュー仕様
* このアドオンを追加すると、FMEAを表現するためのエクセル状の表が作成されます。この表は、解析結果の列と、対策の列から構成されます。
* 表は、githubのレポジトリviewの画面の"code", "issues"の横に、"issues map"としてメニューが表示され、これをクリックすることで呼び出されます。
* Issues Mapメニューをクリックすると、repository navigationを残した独立した画面として表示されます。既存のリポジトリ画面の下には追加しません。
* Issues Map画面からブラウザーの戻る/進む操作で元の画面へ移動でき、URLを直接開いた場合も同じ画面を表示します。
* * メニューとして追加するために、manifest.jsonの"action"に"issues map"を追加します。
* * githubのレポジトリviewの画面の"code", "issues"の横に、"issues map"としてメニューが表示されるようにするために、manifest.jsonの"action"に"issues map"を追加します。
* * Chrome拡張機能（Manifest V3）の コンテンツスクリプト（Content Script） を使って、GitHubのDOMを書き換えて下さい。
* * GitHubのリポジトリ画面で、コード一覧・Issues・Pull requestsが配置されているrepository navigationのDOM要素を特定し、その中にIssues Mapのリンクを挿入して下さい。
* * IssuesとPull Requestの間にissues mapメニューを置いて下さい。
* * 既存のIssues Mapメニューがすでに存在する場合は重複して追加しないように、メニューボタンのIDを使って重複防止を行って下さい。
* * GitHubのDOMが初期描画時に未完成な場合でも、MutationObserverで再確認し、repository navigationが出現した時点でメニューを追加して下さい。
* * メニュー要素はGitHubの既存タブと同じrole="tab"を持ち、同じ見た目に近づけるために、repository navigation配下のリンク要素として生成し、Issues/PRの左右関係に合わせて挿入して下さい。
* issues mapのメニュー表示は、他のissuesやPull Requestのメニューと同じデザインとして下さい。
* アイコンは表風のイメージを置いて下さい。
* メニューをクリックすると、URLの `#issue-map-view` ルートへ移動し、Issues Map画面を表示します。元のリポジトリ画面のコンテンツは一時的に隠し、repository navigationとGitHubの共通レイアウトは維持します。
* Issues mapのページは、issuesやPull Requestのページと同じデザインとして下さい。メニュー、フッターも同じデザインとして下さい。
* Issues MapメニューはGitHubのrepository navigation標準スタイルを継承し、独自の文字色・背景色・枠線を指定しません。通常時は背景を透過し、選択時はGitHub標準の選択状態で表示します。


## Issue Map画面
* エクセルに近い表形式で、解析結果の列と、対策の列が表示されます。
* Githubのissue登録画面に近いデザインとして下さい。
* 文字の大きさは、Githubのissue登録画面の2/3程度の文字サイズにして下さい。
* 文字の色は、Githubのissue登録画面に近い色として下さい。
* 表の色は、Githubのissue登録画面に近い色として下さい。
* 先頭の行は、タイトルで、"Number", "Analysis Result", "Countermeasure"の列が表示されます。
* 二行目は、Numberの列は空欄、Analysis Resultの列は次のセルに分解される。"Failure Mode", "Failure Cause", "Failure Classification", "Preventive Measure", "Detection Method", "Effect", "Severity", "Occurrence", "Detection"の列が表示されます。Countermeasureの列は次のセルに分解される。"Content", "Effect(Effect)", "Effect(Occurrence)", "Effect(Detection)", "RPN", "Status", "Owner", "Deadline"の列が表示されます。
* 三行目以降は、github issueの内容が表示されます。Numberの列は連番です。Analysis Resultの列は、github issueのタイトルとdescriptionに書かれたanalysis resultと書かれたheadingないに「*」で箇条書きされた内容が各行に表示されます。Countermeasureの列は、github issueのタイトルとdescriptionに書かれたcountermeasureと書かれたheadingないに「*」で箇条書きされた内容と対策結果としてのPRの状況が各行に表示されます。
* Issueが存在する行のNumber列にはIssueごとの「表示」ボタンを表示します。ボタンをクリックすると、該当するGitHub Issueの詳細画面を新しいタブで開きます。

### 解析結果
* 解析結果の一つの要素はgithub issueの一つのissueです。analysis_resultというラベルをつけることで、解析結果の列に表示されます。
* 対策の一つの要素もgithub issueの一つのissueです。countermeasureというラベルをつけることで、対策の列に表示されます。
* 解析結果の列はさらにいくつかの列に分解されます。列は、Github issue番号、タイトルとdescriptionに書かれたanalysis resultと書かれたheadingないに「*」で箇条書きされた内容が各行に表示されます。"Failure Mode", "Failure Cause", "Failure Classification", "Preventive Measure", "Detection Method", "Effect", "Severity", "Occurrence", "Detection"の列が表示されます。descriptionには以下のように書かれます。

```
### analysis result
* 故障モード: 〇〇が動作しない
* 故障原因: 〇〇の部品が破損している
* 故障分類: 機械的故障
* 防止策: 〇〇の部品を定期的に交換する
* 検出方法: 〇〇の部品の状態を定期的
* 影響: 〇〇が動作しないと、〇〇が停止する
* 重大度: 9
* 発生度: 7
* 検出度: 3
```


### 対策
* 対策の列は、Github issue番号、タイトルとdescriptionに書かれたcountermeasureと書かれたheadingないに「*」で箇条書きされた内容と対策結果としてのPRの状況が各行に表示されます。"Content", "Effect(Effect)", "Effect(Occurrence)", "Effect(Detection)", "RPN", "Status", "Owner", "Deadline"の列が表示されます。descriptionには以下のように書かれます。対策状況は対策に紐づけられたPRのマージ状況を確認し、マージ済みであれば「完了」、マージされていなければ「未完了」と表示されます。紐づけられたPRがない場合は「未着手」と表示されます。

```
### countermeasure
* 対策内容: 〇〇の部品を定期的に交換する
* 対策効果(影響): 〇〇が動作しないと、〇〇が停止する
* 対策効果(発生): 7
* 対策効果(検出): 3
* RPN: 189
```

* はじめ機能した際は、解析結果の列と、対策の列の両方が表示されており、それぞれブランクです。解析結果の列、対策の列の中にはブランクのボックスが表示されます。
* ブランクのボックスには新規作成と、リンクの二つのボタンがあります。
* Issueが一つも登録されていない場合は、画面上部にも解析結果と対策それぞれの「新規作成」ボタンを表示します。
* Issue一覧の取得に失敗した場合も、エラー表示とあわせて上部に新規作成ボタンを表示します。
* 新規作成をクリックすると、githubの新規issue作成画面に遷移します。新規issue作成画面では、解析結果の列の場合は、analysis_resultというラベルがついたissueが作成されます。対策の列の場合は、countermeasureというラベルがついたissueが作成されます。
* リンクをクリックすると、githubのissue一覧画面に遷移します。解析結果の列の場合は、analysis_resultというラベルがついたGithub issueの一覧が表示されます。対策の列の場合は、countermeasureというラベルがついたGithub issueの一覧が表示されます。


### 解析結果issueの作成
* 解析結果の列の新規作成ボタンをクリックすると、githubの新規issue作成画面に遷移します。
* 新規issue作成画面では、analysis_resultというラベルが設定された状態となります。
* 新規issue作成画面では、タイトルとdescriptionに書かれたanalysis resultと書かれたheadingないに「*」で箇条書きされた内容が各行に表示されます。
* 「*」の箇条書きの内容は、以下のようにデフォルト入力されます。

```
### analysis result
<!-- do not edit predefined fields -->
* Failure Mode: <!-- insert failure mode -->
* Failure Cause: <!-- insert failure cause -->
* Failure Classification: <!-- insert failure classification -->
* Preventive Measure: <!-- insert preventive measure -->
* Detection Method: <!-- insert detection method -->
* Effect: <!-- insert effect -->
* Severity: <!-- insert severity -->
* Occurrence: <!-- insert occurrence -->
* Detection: <!-- insert detection -->
```

### 対策issueの作成
* 対策の列の新規作成ボタンをクリックすると、githubの新規issue作成画面に遷移します。
* 新規issue作成画面では、countermeasureというラベルが設定された状態となります。
* 新規issue作成画面では、タイトルとdescriptionに書かれたcountermeasureと書かれたheadingないに「*」で箇条書きされた内容が各行に表示されます。
* 「*」の箇条書きの内容は、以下のようにデフォルト入力されます。 

```
### countermeasure
<!-- do not edit predefined fields -->
* Content: <!-- insert countermeasure content -->
* Effect(Effect): <!-- insert countermeasure effect on effect --> 
* Effect(Occurrence): <!-- insert countermeasure effect on occurrence -->
* Effect(Detection): <!-- insert countermeasure effect on detection -->
* RPN: <!-- insert countermeasure RPN -->
* Status: <!-- insert countermeasure status -->
* Owner: <!-- insert countermeasure owner -->
* Deadline: <!-- insert countermeasure deadline -->
``` 
