// GitHub Pages 用の仕上げ（npm run build:pages の最後に実行される）
//  - 開発概要ページを dist/overview.html として一緒に公開する
//  - .nojekyll：GitHub Pages が独自処理（Jekyll）をしないようにする
import { copyFileSync, writeFileSync } from 'node:fs'

copyFileSync(new URL('../portfolio-overview.html', import.meta.url), new URL('../dist/overview.html', import.meta.url))
writeFileSync(new URL('../dist/.nojekyll', import.meta.url), '')
console.log('dist/overview.html と dist/.nojekyll を作成しました')
