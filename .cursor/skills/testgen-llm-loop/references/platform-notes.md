# プラットフォーム別の実行方法

このスキルは「エージェントが生成と検証を同一セッション内で完結させる」前提で書かれている。各プラットフォームでこれをどう実装するかが分かれる。

## Claude Code（推奨）

### 対話モード（手元での試行）

このスキルが Claude Code の `~/.claude/skills/` 配下に置かれていれば、`testgen-llm-loop` トリガーで自動起動する。SKILL.md の手順に沿って、Claude Code が `view` / `bash` を使って Phase 1〜8 を回す。

### スケジュール実行モード

2026 年 4 月以降の Claude Code Routines（cloud routine）または `/loop` で、PR webhook 起点または cron 起点で定期実行できる。設計上の注意：

- Routine の system_prompt にこの SKILL.md の内容を引用するのではなく、リポジトリに `.claude/skills/testgen-llm-loop/` として置いて参照させる。SKILL.md は更新頻度が低くないので、ハードコードしない。
- 1 routine 実行で 1 PR を開く設計にする。複数ファイルを 1 routine で処理すると失敗時のロールバックが面倒になる。
- routine の daily 実行上限（プラン別）に注意。対象ファイルが多いリポでは routine を「カバレッジ穴ランキング Top N に絞る」ステップで前処理する。

### Headless モード（CI 組み込み）

`claude -p` でプロンプトを headless 実行できる。CI ワークフロー側でテスト実行・カバレッジ生成を行い、その結果を `claude -p` のプロンプトに食わせる構成も可能。ただし**生成と検証を 1 セッションで完結させる**原則を守るため、推奨はあくまで Claude Code のエージェント実行を CI から呼ぶ形（`claude -p "use testgen-llm-loop skill on PR diff"` 的な指示）。

## Cursor

このリポジトリでは、スキルを `.cursor/skills/testgen-llm-loop/` 配下に置くことで Cursor のエージェントから参照できる想定。

- 使い方: チャットで `@testgen-llm-loop` を付けて依頼する（例：「`@testgen-llm-loop` 既存テストに意味のあるケースを追加して」）
- 重要: TestGen-LLM の核心である「生成と検証の同一セッション完結」と「不採用テストのフィードバック」を崩さない（テスト実行/カバレッジ計測を別プロセスに分離しない）

## CI（CircleCI / GitHub Actions）からの呼び出し

エージェント本体を CI 内で動かすのではなく、エージェントを別環境（Claude Code Routines / Cursor Background Agent / 自前サーバ）で動かし、CI はそのトリガー元として機能させる構成が現実的。

CircleCI からの呼び出し例：

```yaml
version: 2.1
jobs:
  trigger-testgen:
    docker:
      - image: cimg/base:current
    steps:
      - checkout
      - run:
          name: Generate coverage baseline
          command: |
            pytest --cov=src --cov-report=xml
      - run:
          name: Trigger Claude Code Routine via API
          command: |
            curl -X POST https://api.anthropic.com/v1/code/routines/<routine-id>/invoke \
              -H "x-api-key: $ANTHROPIC_API_KEY" \
              -H "content-type: application/json" \
              -d '{
                "input": {
                  "repo": "'"$CIRCLE_PROJECT_REPONAME"'",
                  "branch": "'"$CIRCLE_BRANCH"'",
                  "coverage_report": "coverage.xml",
                  "target_coverage": 0.85,
                  "max_iterations": 3
                }
              }'

workflows:
  nightly:
    triggers:
      - schedule:
          cron: "0 18 * * *"  # 日次（UTC 18:00 = JST 3:00）
          filters:
            branches:
              only:
                - main
    jobs:
      - trigger-testgen
```

**注意点**：
- API エンドポイントとリクエスト形式は 2026 年 5 月時点での推測を含む。実装前に最新の Anthropic ドキュメントで確認すること。
- CI 側でカバレッジレポートを成果物として確実に出してから routine を呼ぶ。レポート不在で routine が空振りすると料金だけ消費する。
- routine から CI に戻り値を返す経路（PR コメント / Slack 通知 / 別 webhook）を必ず設計する。発火しっぱなしにしない。

## 結論

- 一番素直に動くのは **Claude Code 対話モード + リポジトリ内 SKILL.md**
- 自動化したければ **Claude Code Routines + GitHub webhook** または **CI から API 呼び出し**
- Cursor を使う場合は **`.cursor/skills/` に配置して `@testgen-llm-loop` で明示呼び出し**
- いずれの場合も、TestGen-LLM 論文の核心（生成と検証の同一セッション + 不採用テストのフィードバック）を切り離さない構成にすることが最重要
