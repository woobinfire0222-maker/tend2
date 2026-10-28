# TEND - GitHub Pages 브랜치 배포 수정본

이 버전은 React Router의 경로 기준이 `/tend/`로 고정되어 있어 저장소 이름이 다르면 흰 화면이 나올 수 있는 문제를 수정했습니다. 현재 페이지 경로의 첫 경로 세그먼트를 프로젝트 경로로 사용합니다.

## 업로드
1. 압축을 풀고 파일들을 GitHub 저장소 최상위에 업로드합니다. `index.html`, `index-DD5tomYs.js`, `index-BSGX77mM.css`, `config.js`는 같은 위치에 있어야 합니다. `supabase/` 폴더도 함께 올립니다.
2. Settings → Pages → Deploy from a branch → `main` → `/(root)` 선택 후 저장합니다.
3. `config.js`의 Supabase URL과 anon/publishable 키를 실제 값으로 바꿉니다. 예시 placeholder 그대로면 로그인/데이터 기능은 작동하지 않습니다. `service_role` 키는 절대 넣지 마세요.
4. 브라우저에서 강력 새로고침(Ctrl+Shift+R)합니다.

## Supabase / Discord
Supabase SQL migration을 SQL Editor에서 실행하고, Supabase Auth의 Discord Provider 및 Redirect URLs를 설정해야 합니다. `supabase/functions/` 안의 Edge Functions는 별도 배포가 필요하며 Discord 봇은 별도 호스팅이 필요합니다.
