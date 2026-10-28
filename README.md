# TEND — 브랜치 배포용 최소 파일

이 폴더는 GitHub Pages의 **Deploy from a branch** 방식용입니다. Actions나 빌드 도구가 필요하지 않습니다.

## 1. GitHub에 올리기

ZIP 압축을 풀고, 안에 있는 `index.html`, `404.html`, `config.js`, `favicon.svg`, `robots.txt`, `assets/`, `supabase/`, `README.md`를 저장소의 최상위(root)에 올립니다. `index.html`이 저장소 최상위에 있어야 합니다.

GitHub 저장소 → Settings → Pages → Build and deployment에서 Source를 `Deploy from a branch`, Branch를 `main`, Folder를 `/(root)`로 선택하고 저장합니다.

## 2. Supabase 연결

1. `config.js`를 열어 `supabaseUrl`과 `supabaseAnonKey`를 실제 Supabase 프로젝트 URL 및 공개 publishable/anon 키로 바꿉니다. 이 키는 브라우저에 노출되는 공개 키여야 합니다. `service_role` 키는 절대 넣지 마세요.
2. Supabase SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 내용을 실행합니다.
3. Supabase Authentication → Providers에서 Discord를 켜고 Discord Developer Portal의 Client ID/Secret을 설정합니다. Discord OAuth Redirect URI는 `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` 입니다.
4. Supabase Authentication → URL Configuration에서 Site URL과 Redirect URLs에 실제 GitHub Pages 주소를 추가합니다.
5. 오너 기능을 쓰려면 Supabase CLI로 `owner-bootstrap` 및 `owner-admin` Edge Function을 배포하고, `TEND_OWNER_DISCORD_ID`에 오너의 **숫자 Discord ID**를 서버 비밀로 설정합니다. 사용자명만으로 권한을 부여하지 않습니다.

## 중요한 범위 안내

이 ZIP은 기존 TEND 웹앱의 빌드 결과를 사용해 파일 수를 줄인 것입니다. 외부 Supabase 프로젝트 및 Discord OAuth 자격 증명은 포함할 수 없으므로, 위 설정을 마치기 전에는 로그인/데이터 기능이 실제로 연결되지 않습니다. 공개 anon 키만 사용하고 DB 보안은 RLS 정책에 맡겨야 합니다. 실제 Discord 봇 프로세스와 봇 토큰은 정적 웹사이트에 포함되지 않으며 별도로 호스팅해야 합니다.
