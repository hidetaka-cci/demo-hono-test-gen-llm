# 4 基準フィルタ実装詳細

Phase 5 で使う 4 つの判定基準の実装上の注意点。

## 1. Build（コンパイル/import 解決）

判定方法：追加後のテストファイル全体に対して、言語ごとの「素通し」コマンドを叩く。

| 言語/環境 | コマンド例 |
|---|---|
| Python (pytest) | `python -m py_compile <test_file>` + `pytest --collect-only <test_file>` |
| TypeScript | `tsc --noEmit` または `vitest --run --reporter=verbose <test_file> --no-coverage` の収集段階 |
| Java (JUnit) | `mvn test-compile` |
| Go | `go vet ./...` |
| Rust | `cargo test --no-run` |

**注意点**：
- 単一テスト追加で他のテストの import を壊すケースを必ず捕まえる。テストファイル単体ではなくテストスイート全体での収集確認を含める。
- `pytest --collect-only` はテスト関数を実際に実行せず収集のみ行うので、コンパイル時エラー検出が早い。
- 不採用理由として記録するのはエラーメッセージの「最初のエラー行」だけで十分。LLM はそれだけで再生成時に避けられる。

## 2. Pass（テスト単体実行）

判定方法：対象テスト関数だけを実行して green を確認。

| 環境 | コマンド例 |
|---|---|
| pytest | `pytest <test_file>::<test_name> -v` |
| vitest | `vitest run -t '<test_name>' <test_file>` |
| jest | `jest -t '<test_name>' <test_file>` |
| JUnit (maven) | `mvn test -Dtest=<ClassName>#<methodName>` |

**注意点**：
- タイムアウトを必ず設定する（例: 30 秒）。生成テストが無限ループに入るケースがある。
- 失敗時のスタックトレースを「不採用理由」として記録するが、長すぎると次反復のプロンプトが膨らむので、最初のアサーションエラー行 + 該当行のコードのみに切り詰める。
- `setup` / `teardown` 系のフィクスチャが必要な場合、生成テストが既存フィクスチャを利用するよう Phase 2 で明示すること。

## 3. Coverage gain（カバレッジ増加）

判定方法：候補テストを追加した状態でカバレッジレポートを再生成し、ベースラインと差分を取る。

```
gained_lines = coverage_after.lines_hit - coverage_before.lines_hit
gained_branches = coverage_after.branches_hit - coverage_before.branches_hit
```

`gained_lines == 0 and gained_branches == 0` なら破棄。

**注意点**：
- 「対象ファイル」のカバレッジで判定する。他ファイルの間接的なカバレッジ増加は副作用なのでカウントしない（採用判定がブレる）。
- 行カバレッジ 0 増、分岐カバレッジ +1 は採用（分岐網羅は重要）。
- 既存テストとの差分なので、複数候補を同時評価するときは「ベースライン + 直前までに採用したテスト群」を基準にすること。さもないと採用候補同士で同じ行を競って二重採用される。
- カバレッジレポートのファイル単位識別（path normalization）でハマりやすい。相対パス/絶対パスの混在に注意。

## 4. Uniqueness（重複排除）

判定方法：同一反復内の他の採用候補との「実質的重複」を検出。

実質的重複の定義：

- カバレッジ差分（gained_lines, gained_branches）が完全に同じ集合
- かつ assertion の数と種類（assertEqual, assertRaises 等）の構成が同じ
- かつテスト対象関数（focal method）が同じ

3 条件すべて満たす場合は重複と判定し、後発を破棄する。「入力値だけ違って同じ分岐を踏む」テストはこれで弾ける。

**注意点**：
- パラメタライズドテスト（`@pytest.mark.parametrize` 等）を 1 関数で表現できるなら統合を提案するのが本来は望ましい。ただし論文のスコープ「既存スイートの拡張」を優先するなら、まずは破棄でよい。
- 「カバレッジ差分が空集合（gained = 0）」のテストは基準 3 で既に破棄されているので、ここでは扱わない。
- 既存テストとの重複もチェック対象に含める（カバレッジ差分が空でなくても、assertion が既存テストの劣化コピーになっているケース）。

## 4 基準の順序を守る理由

順序は最適化のため。

1. Build は最も軽量（コード実行なし）→ 落ちる候補はここで大量に弾く
2. Pass は対象テスト 1 件の実行のみ → コスト中
3. Coverage gain は全テスト実行 + レポート生成 → コスト高
4. Uniqueness は他候補との比較 → 残った少数候補に対してのみ実施

順序を入れ替えると、明らかにビルド不能なテストにカバレッジ計測のコストをかけることになる。
