# TEND - GitHub Pages 브랜치 배포 수정본

이 버전은 React Router의 경로 기준이 `/tend/`로 고정되어 있어 저장소 이름이 다르면 흰 화면이 나올 수 있는 문제를 수정했습니다. 현재 페이지 경로의 첫 경로 세그먼트를 프로젝트 경로로 사용합니다.

## 업로드
1. 압축을 풀고 파일들을 GitHub 저장소 최상위에 업로드합니다. `index.html`, `index-DD5tomYs.js`, `index-BSGX77mM.css`, `config.js`는 같은 위치에 있어야 합니다. `supabase/` 폴더도 함께 올립니다.
2. Settings → Pages → Deploy from a branch → `main` → `/(root)` 선택 후 저장합니다.
3. `config.js`에는 Supabase URL과 Publishable/anon 키만 둡니다. 이 키는 브라우저에서 사용되는 공개 키이며, RLS 정책으로 데이터 접근을 제한해야 합니다. `service_role` 또는 `sb_secret_...` 키는 `config.js`, HTML, JS, GitHub 저장소에 절대 넣지 마세요.
4. `discord-action` 같은 Edge Function의 서버 환경변수에만 Secret/service_role 키를 저장합니다. Edge Function은 로그인 JWT와 현재 승인된 이용권을 검증한 뒤 필요한 작업만 수행합니다. Discord Bot Token과 Supabase Secret Key는 봇 호스팅 환경의 비밀 환경변수로만 저장합니다.
4. 브라우저에서 강력 새로고침(Ctrl+Shift+R)합니다.

## Supabase / Discord
Supabase SQL migration을 SQL Editor에서 실행하고, Supabase Auth의 Discord Provider 및 Redirect URLs를 설정해야 합니다. `supabase/functions/` 안의 Edge Functions는 별도 배포가 필요하며 Discord 봇은 별도 호스팅이 필요합니다.
