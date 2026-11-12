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
* 先頭の行は、"Analysis Result Number", "Analysis Result", "Countermeasure Number", "Countermeasure"の列が表示されます。
* 二行目は各Number列が空欄で、Analysis Resultの列は"Failure Mode", "Failure Cause", "Failure Classification", "Preventive Measure", "Detection Method", "Effect", "Severity", "Occurrence", "Detection"に、Countermeasureの列は"Content", "Effect(Effect)", "Effect(Occurrence)", "Effect(Detection)", "RPN", "Status", "Owner", "Deadline"に分解されます。
* 三行目以降はGitHub Issue本文の内容を表示します。Analysis Resultの列は、analysis result見出し内の箇条書きや書式付きフィールドを各セルに表示し、Failure Modeが本文にない場合はIssueタイトルを表示します。Countermeasureの列も同様に本文から値を取得し、Contentがない場合はIssueタイトルを表示します。
* Analysis Result Number列とCountermeasure Number列にそれぞれ該当するIssue番号をリンクとして表示し、クリックすると画面遷移せずにドロワーを開きます。ドロワーにはIssueタイトル・本文、ラベル、Assignee、Projects v2、マイルストーン、変更履歴を表示します。タイトル・本文・ラベル・Assignee・Projects v2・マイルストーンは編集して保存できます。
* Countermeasureは本文に記載された `Related analysis result:` の後のIssue番号を使ってAnalysis Resultに紐づけ、Issue番号順などの位置による紐付けはしません。Issue番号はカンマ・セミコロン・空白・ハイフンで区切って複数記載できます。一つのCountermeasureが複数のAnalysis Resultを参照する場合、そのCountermeasureを各Analysis Resultの行に表示します。一つのAnalysis Resultに複数のCountermeasureを表示できます。紐付け情報がない、または参照先のAnalysis Resultが一つも存在しないCountermeasureは、Analysis Result欄を空にして独立した行に表示します。
* Issue Map上の「リンク」ボタンを押すとGitHub標準のデザインに沿ったドロワーを表示し、ラベル `countermeasure` を持つIssueを一覧表示します。リンク先のAnalysis ResultとCountermeasureを選択して「選択したCountermeasureをリンク」を押すと、選択したCountermeasureの本文にAnalysis ResultのIssue番号を保存します。既存のリンクを保持して重複番号を除き、複数の番号はIssue番号の昇順で `Related analysis result: #2, #4` の形式にします。行内のリンクボタンから開いた場合は、その行のAnalysis Resultをリンク先として初期選択します。

### 解析結果
* 解析結果の一つの要素はgithub issueの一つのissueです。analysis_resultというラベルをつけることで、解析結果の列に表示されます。
* 対策の一つの要素もgithub issueの一つのissueです。countermeasureというラベルをつけることで、対策の列に表示されます。
* Issue作成を利用する前に、リポジトリにanalysis_resultとcountermeasureのラベルを作成しておく必要があります。
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
* Issueの有無にかかわらず、画面上部に解析結果と対策それぞれの「新規作成」ボタンを表示します。
* 解析結果または対策のどちらか一方に複数Issueがあり、もう一方の行が不足する場合、不足している各行に「新規作成」ボタンを表示します。
* Issue Mapには手動更新ボタンを表示せず、Issue作成・編集後に一覧を自動更新します。Issue一覧は、Fine-grained PATを使ってGitHub REST APIから取得し、analysis_resultおよびcountermeasureラベルを持つIssueを分類します。Issue一覧の取得に失敗した場合も、エラー表示とあわせて上部の新規作成ボタンを表示します。PR状態を取得できない場合もIssue内容は表示し、Status欄を「確認不可」とします。
* 新規作成をクリックすると、ドロワーにIssue作成フォームを表示します。タイトルと本文を編集し、GitHub REST API経由でIssueを作成します。解析結果の列の場合はanalysis_result、対策の列の場合はcountermeasureというラベルがついたissueが作成されます。作成後は画面遷移せずに完了表示を行います。API認証には、対象リポジトリのIssues: Read and write権限を持つFine-grained PATを使用し、ブラウザーセッション中のみ保存します。
* Issue Map上の「リンク」ボタンはGitHubのIssue一覧へ遷移せず、Issue間の紐付けを行うドロワーを表示します。


### 解析結果issueの作成
* 解析結果の列の新規作成ボタンをクリックすると、ドロワーにgithubの新規issue作成画面を表示します。
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
* 解析結果の行にある対策の新規作成ボタンをクリックすると、その解析結果Issue番号を対策Issueの本文に `Related analysis result: #<Issue番号>` として記載した状態で、ドロワーに対策Issue作成フォームを表示します。上部の対策新規作成ボタンなど、特定の解析結果に紐づかない作成ではこの参照を追加しません。
* 対策の列の新規作成ボタンをクリックすると、ドロワーにgithubの新規issue作成画面を表示します。
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
