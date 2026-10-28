# TEND — GitHub Pages 브랜치 배포

이 ZIP은 웹사이트의 HTML, JS, CSS를 저장소 최상위에 평평하게 배치한 버전입니다. `assets/` 폴더가 없어도 되도록 HTML 경로를 수정했습니다.

## 업로드
1. ZIP을 압축 해제합니다.
2. 안의 파일과 폴더를 GitHub 저장소 최상위에 업로드합니다. `index.html`, `index-DD5tomYs.js`, `index-BSGX77mM.css`가 같은 위치에 있어야 합니다.
3. GitHub 저장소 → Settings → Pages → Source에서 `Deploy from a branch`, Branch `main`, Folder `/(root)`를 선택하고 저장합니다. Actions는 필요하지 않습니다.

## Supabase / Discord 설정
- `config.js`에서 `supabaseUrl`과 `supabaseAnonKey`를 실제 Supabase 프로젝트 값으로 바꿉니다. 브라우저에 공개해도 되는 anon/publishable 키만 사용하고 `service_role` 키는 넣지 마세요.
- `supabase/migrations/001_initial_schema.sql`은 Supabase SQL Editor에서 실행합니다.
- Supabase Authentication에서 Discord Provider를 설정하고, Discord Developer Portal의 OAuth redirect URL을 `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`로 설정합니다. Supabase의 Site URL 및 Redirect URLs에도 GitHub Pages 주소를 추가합니다.
- `supabase/functions/` 안의 Edge Functions는 정적 브랜치 배포만으로 실행되지 않습니다. 필요한 함수는 Supabase CLI로 별도 배포하고 비밀값은 Supabase Secrets에 설정해야 합니다. 실제 Discord 봇도 별도 호스팅이 필요합니다.

주의: 파일 경로를 수정한 패키지입니다. 실제 로그인 및 데이터 기능은 사용자의 Supabase/Discord 설정이 완료되어야 작동합니다.
