# プロンプトパターン

Phase 4 で LLM にテスト生成を依頼するときのプロンプト構造。

## 基本原則

- セクションを必ず区切る。混ぜて渡すとスタイル無視 / 不採用テストの繰り返し再生成が起きる。
- 「Reference style」「Target」「Uncovered」「Failed candidates」「Output format」の 5 つは反復ごとに必ず再構成する。
- 不採用テストのリストが空でも、項目自体は残す（LLM がフォーマットを学習する）。

## 反復 1 のプロンプト構造

```
You are extending an existing test suite. Your output will be filtered by 4 criteria
(build, pass, coverage gain, uniqueness), so optimize for these rather than for
"reasonable-looking tests".

## Project conventions
- Test framework: <pytest / vitest / etc>
- Mock library: <unittest.mock / vi.mock / etc>
- Fixtures available: <list from conftest etc>
- Test file location: <path>

## Reference style (existing tests in the same file)
<paste 3-5 existing test functions verbatim>

## Target source code
<paste the source file or focal method>

## Uncovered branches (must be hit by your tests)
- Line 42-47 (else branch of validate_input)
- Line 89 (exception path of fetch_remote)
- Branch in `if not user.is_active` (currently no test reaches the True path)

## Failed test candidates from previous iterations (do not regenerate equivalent tests)
(none yet — this is iteration 1)

## Output format
- Produce 3-5 test functions matching the reference style.
- Each test must hit at least one uncovered line/branch listed above.
- Wrap each test in a fenced code block, one block per test.
- Before each block, write a one-line comment stating which uncovered item it targets.
- Do not modify existing tests. Append-only.
```

## 反復 2 以降のプロンプト構造

差分は「Failed test candidates from previous iterations」だけ。ここを充実させる。

```
## Failed test candidates from previous iterations (do not regenerate equivalent tests)

### Iteration 1
- test_validate_input_with_none
  reason: build_error
  detail: NameError: name 'InvalidInputError' is not defined (import missing)
- test_fetch_remote_timeout
  reason: test_failure
  detail: AssertionError: expected TimeoutError, got ConnectionError
- test_user_inactive_path
  reason: no_coverage_gain
  detail: already covered by existing test_user_lifecycle

### Iteration 2
- test_validate_input_empty_string
  reason: duplicate
  detail: equivalent to test_validate_input_none (same branch hit, same assertion structure)
```

## 失敗詳細の切り詰め

詳細欄が長くなりすぎるとプロンプト全体が膨れて反復が重くなる。次の規則で切り詰める：

- ビルドエラー：最初のエラー行 1 行
- テスト失敗：最初の AssertionError 行 + 該当アサーション 1 行
- カバレッジ未増加：既存テスト名（重複先）のみ
- 重複：重複先テスト名と「同一の分岐をヒット」「assertion 構造が同じ」など 1 行ラベル
- flaky：「失敗した実行回 / 全実行回数」（例：2/5 failed）と最初のエラー 1 行

## アンチパターン

- ❌ 「もっと良いテストを書いて」と漠然と言う → 何が「良い」か LLM が判定できない
- ❌ 不採用テスト全文をプロンプトに含める → 長すぎてシグナルが薄まる
- ❌ 1 反復で 30 件など大量に生成させる → フィルタコストが反復時間を支配する
- ❌ 「assertion を増やせ」と指示する → カバレッジを増やさない assertion 水増しテストが量産される
- ❌ ユーザー入力なしで対象ファイルを増やす → スコープがブレてカバレッジ判定が壊れる

## エージェント実行時の追加考慮

Claude Code / Cursor のようなエージェント環境では、上記プロンプトを 1 回叩いて終わりではなく、エージェントが内部的に：

1. 既存テストファイルを `view` で読む
2. カバレッジレポートを `bash` で生成
3. 生成テストを実際にファイルに書いて `bash` でテスト実行
4. 失敗したテストを内部状態として保持

を全部やる。そのため、プロンプトの「Reference style」「Target source code」「Uncovered branches」は固定文字列ではなく、エージェントがツール経由で取ってきた最新値を毎反復差し込む。

逆に言うと、エージェントがこれらを「自分で取ってこない」設計だと TestGen-LLM 論文を再現できない。Phase 2 / Phase 3 / Phase 5 を別プロセスに切り出すと、フィードバックループが切れる。
