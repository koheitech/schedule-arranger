# Schedule Arranger README

## Description(en)
Schedule Arranger is a schedule-arranging app with authentication with gitHub account.

This application was created based on the tutorial by [N予備校](https://www.nnn.ed.nico/).

This app is running on https://nschoolschedulearranger.herokuapp.com/.

### Summary
- Created with Node.js + Express.js framework
- Following actions can be done:
  - login/logout with GitHub
  - user can;
    - create new schedule
    - edit/delete the given schedule
    - put a comment on the given schedule
    - answer to candidate dates (AJAX)

## Description(ja)
Schedule ArrangerはスケジュールをGitHub OAuthによって認証し、

認証されたユーザーのみが、スケジュールを作成し、それに対しての出欠を取ることができるアプリケーションです。

このアプリケーションは[N予備校](https://www.nnn.ed.nico)の「【2022年度】プログラミング入門」コースを参考に作成しました。

動かしてみたい場合には以下のURLにアクセスし、GitHubのアカウントで認証を行ってご利用ください。

https://nschoolschedulearranger.herokuapp.com/

### 概要
- 技術: Node.js + Express.js
- 以下のアクションを実装
  - GitHub認証を用いたログインとログアウト
  - ユーザは以下のアクションを実行可能
    - 新しい予定の作成
    - 予定の編集・削除
    - 予定に対するコメント
    - 予定に紐づく候補日に対しての出欠(AJAX)
