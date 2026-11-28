# TEND BLOCKS — 확장 블록 전체 런타임 구현 지시서

기존 TEND Discord 봇에 TEND BLOCKS 실행기를 통합한다. 기존 이벤트·명령어·검열·경고·역할 관리 기능을 보존한다. 별도 봇 프로세스를 만들지 않는다.

## 0. 운영 환경과 구조
- 현재 TEND 봇 프로세스 하나에서 실행한다. 별도 Discord 클라이언트·프로세스·작업 워커 금지.
- 사이트는 프로젝트 JSON을 Supabase blocks_projects에 저장한다. 봇은 이벤트가 발생한 서버의 is_enabled=true 프로젝트만 조회한다.
- 기존 Supabase 및 Discord 클라이언트를 재사용한다.
- service role key는 서버 환경변수에서만 읽고 프론트엔드·로그에 노출하지 않는다.
- 호스팅 RAM은 128MB 수준이므로 가벼운 이벤트 기반 실행만 허용한다.
- 음성, TTS, 음악, 음성 인식, AI 호출, 번역 기능은 제외한다.
- 기존 TEND 기능을 삭제하거나 동작을 바꾸지 않는다.

## 1. Supabase
blocks_projects: id, owner_id, server_id, name, project_data, is_enabled, version, created_at, updated_at
blocks_execution_logs: id, project_id, owner_id, server_id, event_type, status, message, created_at
- project_data는 JSONB, 최대 50블록·200KB.
- status는 success / failed / skipped.
- message는 최대 500자.
- 메시지 전문, 토큰, 비밀값, 불필요한 개인정보는 로그에 저장하지 않는다.
- 실행 전 JSON 스키마, 필드 타입·길이·ID를 검증한다.

## 2. 실행 모델
JSON 예시:
    {
      "version": 1,
      "variables": ["count"],
      "blocks": [
        {"id":"uuid","type":"event_message_create","fields":{"channel_filter":""}},
        {"id":"uuid","type":"condition_contains","fields":{"keyword":"안녕"}},
        {"id":"uuid","type":"action_send_message","fields":{
          "channel_id":"CHANNEL_ID","content":"{{user_name}} 님 안녕하세요!",
          "mention_mode":"none","mention_id":"","delete_after_seconds":"","thread_mode":"none"
        }}
      ]
    }
- 배열 순서대로 실행한다.
- event_*부터 다음 event_* 직전까지 독립 분기다.
- 일치하는 이벤트 분기만 실행한다.
- 조건 false면 해당 분기의 나머지를 중단한다.
- control_stop은 현재 분기를 즉시 중단한다.
- 이벤트 블록이 없는 프로젝트는 실행하지 않는다.
- allowlist에 없는 type은 절대 실행하지 않는다.

## 3. 이벤트 블록

### event_message_create
메시지 생성 이벤트. fields.channel_filter는 선택적 채널 ID 필터. 봇 자신의 메시지와 DM은 기본 무시.

### event_member_join
새 멤버 입장 이벤트.

### event_member_leave
멤버 퇴장 이벤트.

### event_message_edit
메시지 수정 이벤트. 컨텍스트에 old_content와 message_content를 제공.

### event_message_delete
메시지 삭제 이벤트. Discord 캐시에 남아 있는 경우에만 메시지 정보를 제공하고, 캐시에 없으면 내용은 빈 값.

### event_reaction_add
반응 추가 이벤트. fields.emoji가 빈 문자열이면 모든 이모지, 값이 있으면 일치하는 이모지만 실행. 봇 자신의 반응은 기본 무시.

## 4. 조건 블록
모든 조건은 boolean을 반환하며 false면 해당 분기를 중단한다.

- condition_contains: fields.keyword가 메시지 내용에 포함되는지 검사. 기본 대소문자 구분 없음.
- condition_has_role: fields.role_id 역할을 이벤트 멤버가 보유하는지 검사.
- condition_starts_with: fields.text로 메시지가 시작하는지 검사.
- condition_ends_with: fields.text로 메시지가 끝나는지 검사.
- condition_equals: fields.text와 메시지가 정확히 일치하는지 검사.
- condition_channel_is: fields.channel_id와 현재 이벤트 채널 비교.
- condition_has_attachment: fields.expected("true"/"false")와 첨부파일 존재 여부 비교.
- condition_is_bot: fields.expected("true"/"false")와 작성자의 봇 여부 비교.
- condition_message_length: fields.operator(gte/lte/eq), fields.length(0~2000)로 글자 수 비교.
- condition_username_contains: fields.text가 사용자 이름에 포함되는지 대소문자 구분 없이 검사.

## 5. 동작 블록

### action_send_message
fields: channel_id, content, mention_mode(none/everyone/here/user/role), mention_id, delete_after_seconds, thread_mode(none/create/reply)
- 채널은 현재 서버 소속이어야 한다.
- 기본 멘션 none. everyone/here는 명시 선택한 경우에만 허용.
- user/role은 유효 ID 확인.
- 텍스트 안의 @everyone 문자열만으로 멘션하지 않는다.
- 삭제 시간은 0~86400초.
- 스레드 대상이 없거나 지원되지 않으면 안전하게 건너뛴다.

### action_send_embed
fields: channel_id, embed_title, author, description, color, footer, title_url, thumbnail_url, image_url, timestamp
- Discord Embed 길이 제한 준수.
- URL은 HTTPS만 허용.
- HEX 색상이 잘못되면 기본 색상 사용.

### action_reply
fields: content, reply_target(event_message/latest_message/message_id), target_message_id, fallback(send_new/skip), mention_author(false/true)
- 기본 작성자 멘션 false.
- 직접 지정 메시지 ID는 현재 서버의 같은 채널 소속인지 확인.
- latest_message는 해당 채널에서만 제한적으로 조회.

### action_add_role / action_remove_role
fields: role_id
- 기존 TEND 역할 관리 로직 재사용.
- 현재 서버 소속 역할인지, Manage Roles 권한이 있는지 확인.
- @everyone, 통합 관리 역할, 봇 최고 역할 이상은 변경 금지.

### action_warn
fields: reason
- 기존 TEND 경고 시스템 재사용. 중복 경고 테이블을 만들지 않는다.

### action_delete_message
fields: reason
- message_create 또는 message_edit 이벤트의 유효한 현재 메시지만 삭제.
- Manage Messages 권한과 서버·채널 소속 확인.
- 사유는 내부 기록용으로만 사용.

### action_add_reaction
fields: emoji
- 현재 이벤트 메시지에 유효한 유니코드 또는 서버 커스텀 이모지 반응 추가.

### action_send_dm
fields: content
- 이벤트 사용자에게 DM 전송.
- DM 실패는 해당 동작만 실패 처리하고 전체 봇에 영향 주지 않는다.

### action_set_nickname
fields: nickname
- {{user_name}}, {{server_name}}, {{channel_name}}, {{current_time}}, 사용자 변수 치환.
- 최대 32자.
- 서버 소유자나 봇보다 높은 역할의 멤버는 변경하지 않는다.
- Manage Nicknames 권한 확인.

### action_create_thread
fields: name, auto_archive_minutes(60/1440/4320/10080)
- 현재 메시지가 스레드를 지원하는 채널에 있을 때만 생성.
- 이름 길이 제한 확인.

### action_pin_message
fields: pin(true/false)
- true면 현재 메시지 고정, false면 고정 해제.
- Manage Messages 권한 확인.

### action_set_slowmode
fields: channel_id, seconds
- seconds는 0~21600.
- 현재 서버 텍스트 채널인지, Manage Channels 권한이 있는지 확인.

### action_log
fields: message
- blocks_execution_logs에 안전한 실행 요약만 기록.
- 메시지 원문이나 개인정보를 기록하지 않는다.

## 6. 제어 블록
- control_wait: fields.seconds 0~10. asyncio.sleep 사용, 동기 sleep 금지.
- control_stop: 현재 분기 즉시 중단.
- control_cooldown: fields.seconds 1~86400. 사용자별·프로젝트별 메모리 쿨다운. 만료 항목은 접근 시 정리하고 영구 저장하지 않는다.
- control_random: fields.chance 0~100. 한 번 확률 판정. 실패하면 현재 분기 중단.

## 7. 변수 블록
실행 컨텍스트는 프로젝트/이벤트 실행마다 새로 만들고 종료 후 폐기한다.
- data_set_variable: fields.variable, fields.value. 문자열 또는 치환 결과 저장.
- data_change_variable: fields.variable, fields.amount. 숫자 변수에 더하기.
- data_append_variable: fields.variable, fields.text. 기존 문자열 뒤에 텍스트 추가.
- data_math_variable: fields.variable, fields.operator(add/subtract/multiply/divide), fields.amount. 0 나누기 금지.

## 8. 값 블록과 템플릿
편집기에서 값 블록을 value 입력칸으로 드래그할 때 다음 문자열을 입력한다.
- value_text: 입력한 일반 텍스트
- value_number: 숫자 문자열
- value_variable: {{변수명}}
- value_user_name: {{user_name}}
- value_server_name: {{server_name}}
- value_channel_name: {{channel_name}}
- value_current_time: {{current_time}}

기본 템플릿 변수:
- user_name: 이벤트 사용자 표시 이름
- server_name: 현재 Discord 서버 이름
- channel_name: 현재 채널 이름
- current_time: 안전한 시간 문자열
- 사용자 정의 변수: 현재 실행 컨텍스트에 저장된 값
- 정의되지 않은 변수는 빈 문자열.
- 단순 문자열 치환만 허용하며 Python/SQL/JavaScript 코드 평가 금지.

## 9. 이벤트 컨텍스트
최소한 다음 정보만 보유한다.
guild_id, channel_id, user_id, user_name, server_name, channel_name, message_id, message_content, old_content, attachment_count, author_is_bot, role_ids, reaction_emoji.
Discord 객체 전체를 장기간 보관하지 않는다.

## 10. 실행 제한과 128MB 최적화
- 프로젝트 최대 50블록, JSON 최대 200KB.
- 서버별 프로젝트 조회 캐시 TTL 30~60초, 최대 100개 서버.
- 전역 동시 실행 최대 2개, 서버별 동시 실행 최대 1개.
- 서버당 기본 10회/분 실행 제한.
- 한 분기 최대 50블록, 실행 시간 최대 15초(대기 포함).
- 실행별 변수 최대 50개.
- 이벤트마다 Supabase 클라이언트를 새로 만들지 않는다.
- 별도 스레드, subprocess, 무거운 폴링 금지.
- DB 장애 시 BLOCKS만 건너뛰고 기존 봇 기능은 계속 작동.

## 11. 이벤트 리스너 통합
- 기존 on_message를 덮어쓰지 않는다.
- 가능하면 기존 bot 인스턴스에 별도 listener로 연결한다.
- process_commands, 검열, 로그, 명령어 흐름을 보존한다.
- on_member_join/remove, on_message_edit/delete, on_reaction_add도 충돌 없이 연결한다.
- DM과 봇 계정 이벤트는 기본 무시한다.
- BLOCKS 봇 메시지가 무한 재실행되지 않도록 봇 작성자 메시지는 기본 제외.

## 12. 금지 기능
eval, exec, compile, 임의 Python/JavaScript, 동적 import, 쉘 명령, 임의 SQL, 파일 시스템 접근, 임의 외부 HTTP, 무한 루프, 재귀, 무제한 대기, 사용자 코드 실행을 절대 구현하지 않는다.
모든 블록은 명시된 allowlist만 실행한다. ID·필드 타입·길이·범위와 Discord 권한·서버 소속을 동작 직전에 검사한다.

## 13. 테스트
- 6개 이벤트 분기별 동작
- 채널 필터·이모지 필터
- 9개 조건 블록
- 메시지·임베드·답장·역할·경고·삭제·반응·DM·닉네임·스레드·고정·슬로우모드·로그
- wait/stop/cooldown/random
- 모든 변수와 기본 템플릿 치환
- 50개 초과, 200KB 초과, 알 수 없는 type 거부
- 다른 서버의 채널·역할·메시지 ID 거부
- 권한 부족 시 안전한 실패
- 128MB 환경의 메모리 사용량
- 기존 TEND 명령어·검열·경고·공지·역할 관리 회귀 테스트

## 14. 결과 보고
수정 파일, 추가 모듈, 환경변수, 테스트 결과, 미구현 항목을 보고한다. 구현하지 않은 블록을 지원한다고 보고하지 않는다. Discord API 제약으로 구현할 수 없는 항목은 편집기에서 비활성화하거나 사용자에게 안내한다.

최종 원칙: 기존 TEND 봇을 유지하고, allowlist 블록만 안전하게 실행하며, 128MB 환경에서 이벤트 기반으로 가볍게 동작한다.


---

# 15. 2세대 편집기와 중첩 실행 구조

기존의 평면형 블록 목록을 최종 UX로 간주하지 않는다. Entry/Scratch 계열의 시각적 블록 편집기처럼 동작해야 한다. 기존 TEND 로그인·Supabase·봇 프로세스·관리 기능은 유지한다.

## 15-1. 편집기 화면
- 데스크톱: 상단 프로젝트 바, 왼쪽 카테고리/블록 서랍, 중앙 무한 작업 캔버스, 선택적 오른쪽 속성 패널.
- 모바일: 상단 작업 바, 카테고리 탭, 블록 서랍은 접거나 짧게 표시하고 캔버스가 대부분을 차지한다. 가로 overflow 금지.
- 블록 전체를 한 번에 세로로 나열하지 않는다. 카테고리 탭을 누르면 그 카테고리 블록만 표시한다. 카테고리는 이벤트, 조건, 동작, 제어, 변수, 값, 고급.
- 블록 검색을 제공한다.
- 다크/화이트 모드는 localStorage의 tend-theme 값을 공유한다. 첫 화면부터 적용한다. 입력, select, textarea, 모달, 팝오버, 블록, 캔버스, 툴팁, 빈 상태, CTA, 푸터까지 모든 화면을 양쪽 테마로 확인한다.
- 모든 TEND/BLOCKS 로고는 공통 규칙으로 동일한 둥근 모서리를 적용한다. 소개, 베타 신청, 대시보드, 편집기, 관리자 화면 모두 동일해야 한다.
- 로그인/로그아웃은 기존 TEND Discord OAuth login.html과 기존 세션을 그대로 사용한다.

## 15-2. 캔버스 조작
- 무한 캔버스처럼 동작한다. 우클릭 또는 가운데 버튼 드래그로 상하좌우 패닝. 우클릭 컨텍스트 메뉴는 캔버스에서 차단한다.
- 휠/버튼 확대·축소 40~180%, 가능하면 포인터 위치 기준.
- 모바일 두 손가락 패닝/핀치 줌. 한 손가락은 블록 선택/드래그에 사용.
- 점 격자 배경, 연결선, 스냅 표시, 드롭 위치 미리보기를 제공한다.
- 블록을 놓은 위치와 대상 블록을 기준으로 연결/중첩한다. 목록 맨 끝에 무조건 추가하지 않는다.
- 실행 취소/다시 실행, 복제, 삭제, 자동 정렬, 줌 초기화. 입력 중 Delete 키로 블록을 지우지 않는다.

## 15-3. 블록 연결 의미
- 이벤트는 모자형 시작 블록이며 최상위에만 배치한다. 각 이벤트마다 독립 자동화 스택.
- 일반 동작/변수/제어 블록은 위·아래 연결 탭이 있는 퍼즐형 블록.
- 조건은 C자형 컨테이너이며 내부 children 스택을 갖는다. 조건이 참일 때만 내부를 실행한다. 조건 뒤의 next는 컨테이너 밖에서 이어진다.
- if/else는 then과 else의 독립 스택.
- 반복은 제한된 횟수의 C자형 블록으로만 제공한다. 무한 반복 금지.
- 이벤트 안에 조건, 조건 안에 동작, 조건 다음에 후속 동작을 연결할 수 있어야 한다. 단순히 들여쓰기나 색만 바꾼 것은 중첩 구현이 아니다.
- 이벤트는 최상위, 값 블록은 값 슬롯, 조건/제어 컨테이너는 statement 스택에만 놓을 수 있다.

## 15-4. 프로젝트 JSON v2
권장 구조:
~~~json
{
  "schema_version": 2,
  "variables": ["count"],
  "roots": [
    {
      "id": "uuid",
      "type": "event_message_create",
      "fields": {"channel_filter": ""},
      "next": {
        "id": "uuid",
        "type": "control_if",
        "fields": {"condition": "contains", "keyword": "안녕"},
        "children": [
          {"id": "uuid", "type": "action_reply", "fields": {"content": "안녕하세요!"}}
        ],
        "next": {"id": "uuid", "type": "action_log", "fields": {"message": "처리 완료"}}
      }
    }
  ]
}
~~~
- roots에는 event_*만 허용. 각 root의 next는 순서대로 연결되는 다음 statement.
- 컨테이너의 children은 배열로 통일. if_else는 then과 else 배열.
- control_if는 조건이 참일 때 children 실행. control_if_else는 then/else 분기.
- control_repeat_count는 1~20회. 반복 중첩 2단계, 전체 실행 단계 50, 총 실행시간 15초.
- ID는 UUID, 중복 금지. 트리 깊이 8, 전체 노드 50, JSON 200KB.
- 기존 v1 blocks 배열은 읽을 수 있어야 한다. event_*부터 다음 event_* 전까지를 root의 next 체인으로 변환한다. 의미가 불명확한 조건 범위를 추측하지 않는다.
- 저장은 v2. 로드는 v1/v2 모두 지원.

## 15-5. 추가 블록 카탈로그
기존 블록은 유지하고 아래 블록을 추가한다. 편집기, 검증기, 봇 실행기, 테스트의 이름과 필드는 반드시 동일해야 한다.

### 조건
- condition_member_is_bot
- condition_member_has_role
- condition_member_is_owner
- condition_message_contains_any
- condition_message_contains_all
- condition_variable_compare (equal/not_equal/greater/less/contains)
- condition_time_range (명시된 서버 시간대 기준)
- condition_has_permission
- condition_channel_is

### 동작
- action_edit_message: 현재 이벤트 또는 지정 메시지 수정, 같은 서버/채널 검증.
- action_create_channel: Manage Channels 권한, 이름/종류/카테고리 검증.
- action_set_channel_topic: Manage Channels 권한, 주제 길이 제한.
- action_timeout_member: Moderate Members 권한, 기간 상한, 서버 소속/역할 계층 확인.
- action_remove_timeout: 권한과 역할 계층 확인.
- action_create_poll: Discord poll 지원 여부 확인 후 생성.
- 기존 메시지/임베드/답장/역할/경고/삭제/반응/DM/닉네임/스레드/고정/슬로우모드/로그 동작 유지.

### 제어와 변수
- control_if, control_if_else, control_repeat_count.
- data_get_variable.
- 기존 wait/stop/cooldown/random 및 변수 변경/추가/수학 블록 유지.
- 백그라운드 무제한 실행이나 병렬 무제한 실행 금지.

## 15-6. 봇 런타임
- 기존 Discord client와 listener를 재사용하고 기존 명령어·검열·경고·공지 기능을 덮어쓰지 않는다.
- v2 트리를 깊이 우선으로 실행한다. 모든 노드는 allowlist 검증.
- 이벤트 root만 이벤트와 매칭한다. 각 root는 독립 실행하며 동시 실행 제한 적용.
- if/if_else의 children/then/else는 제한된 컨텍스트로 실행.
- 모든 동작 직전에 서버 소속, 채널/역할 ID, Discord 권한, 역할 계층, 길이를 재검증.
- 저장된 마지막 유효 프로젝트만 실행. 잘못된 node는 해당 실행만 실패 처리.
- v1은 안전한 변환 후 검증. 모호하면 실행하지 말고 로그에 기록.
- 128MB 환경 최적화: 새 봇 프로세스/클라이언트/워커 금지, 제한된 캐시, 이벤트 기반, 제한된 동시성.

## 15-7. 테스트
- 1920×1080, 1366×768, 768px, 390px, 360px에서 가로 overflow 0.
- 카테고리, 검색, drag/drop, 우클릭 패닝, zoom, 모바일 pinch, 값/변수 슬롯 삽입.
- 이벤트 내부 연결, 조건 내부 children, 조건 다음 next, if/else 두 분기.
- 저장/재로드 후 구조·순서·필드 보존. v1→v2 마이그레이션.
- 양 테마 모든 페이지의 CTA/입력/모달/푸터/로고 대비.
- 50노드 초과, 깊이 8 초과, 200KB 초과, 미지원 type, 중복 ID, 다른 서버 ID 거부.
- 실제 미구현 기능을 완료했다고 보고하지 않는다. 소스 점검과 실제 브라우저 시각 테스트를 구분해 보고한다.


---

# 16. Blockly / Entry·Scratch 방식 편집기와 런타임 호환성 (필수)

TEND BLOCKS 편집기는 Google Blockly 엔진을 사용해 Entry·Scratch 계열의 실제 연결형 블록 편집기로 전환되었다. 봇 런타임은 편집기가 저장하는 schema_version 2 구조를 읽어야 한다. 예전 평면형 v1 배열만 읽는 구현으로 끝내지 않는다.

## 16-1. 저장 JSON 계약

최상위 구조:
~~~json
{
  "schema_version": 2,
  "variables": ["count"],
  "roots": [
    {
      "id": "block-uuid",
      "type": "event_message_create",
      "fields": {},
      "values": {},
      "next": {
        "id": "block-uuid",
        "type": "control_if",
        "fields": {},
        "values": {
          "CONDITION": {
            "id": "block-uuid",
            "type": "condition_contains",
            "fields": {"keyword": "안녕"},
            "values": {}
          }
        },
        "children": [
          {
            "id": "block-uuid",
            "type": "action_reply",
            "fields": {"content": "안녕하세요!"},
            "values": {}
          }
        ]
      }
    }
  ]
}
~~~
- roots는 이벤트 블록 배열이다. 이벤트가 아닌 블록을 root로 허용하지 않는다.
- 각 statement node는 id, type, fields, values를 가진다. 다음 statement는 next 한 개로 연결된다.
- values는 Blockly의 값 입력 소켓에 연결된 expression node를 입력 이름 기준으로 저장한다.
- control_if / control_repeat_count는 children 배열을 가진다.
- control_if_else는 children과 else_children 배열을 가진다.
- 조건식은 values.CONDITION에 expression node로 저장한다.
- 값 블록(value_text, value_number, value_variable, value_user_name, value_server_name, value_channel_name, value_current_time)은 statement가 아니며 values 안에서만 허용한다.
- 편집기 필드 이름은 대문자 변환된 Blockly field name을 JSON fields의 키로 저장한다. 예: keyword → KEYWORD, channel_id → CHANNEL_ID, content → CONTENT. 기존 런타임의 소문자 fields 규약을 사용하려면 런타임 정규화 단계에서 대문자 키를 소문자로 변환하되, 충돌·중복 키를 거부한다.
- 편집기에서 조건의 문장형 UI를 표현하더라도 실제 저장은 type, fields, values, children, next 구조로 저장한다.

## 16-2. Blockly 타입별 런타임 의미
- event_*: 최상위 이벤트 루트. 이벤트 종류와 일치할 때만 실행한다.
- condition_*: Boolean expression. statement처럼 단독 실행하지 않는다. 부모 control_if의 values.CONDITION에서 평가한다.
- control_if: CONDITION을 평가하고 true일 때 children을 순서대로 실행한다. false면 children을 건너뛰고 next로 이동한다.
- control_if_else: true면 children, false면 else_children 중 하나만 실행한 후 next로 이동한다.
- control_repeat_count: TIMES 필드 횟수만큼 children을 실행한다. 1~20회만 허용한다.
- action_*: 명시된 Discord 동작만 실행한다.
- data_*: 실행별 변수 컨텍스트만 변경한다.
- value_*: 값 입력 위치에서만 평가한다. 허용된 문자열/숫자/변수 값만 반환한다.

## 16-3. 조건식과 값식
다음 condition_*는 Boolean을 반환한다.
- condition_contains: fields.KEYWORD 또는 values의 연결 텍스트 값을 메시지 내용에 포함하는지 검사.
- condition_has_role: fields.ROLE_ID의 역할을 이벤트 멤버가 보유하는지 검사.
- condition_starts_with: fields.TEXT 또는 연결된 텍스트 값으로 시작하는지 검사.
- condition_ends_with: fields.TEXT 또는 연결된 텍스트 값으로 끝나는지 검사.
- condition_equals: fields.TEXT 또는 연결된 텍스트 값과 정확히 일치하는지 검사.
- condition_channel_is: fields.CHANNEL_ID와 현재 채널 비교.
- condition_has_attachment: fields.EXPECTED 기준 첨부파일 여부.
- condition_is_bot: fields.EXPECTED 기준 작성자 봇 여부.
- condition_message_length: fields.OPERATOR와 fields.LENGTH 기준 글자 수 비교.
- condition_username_contains: fields.TEXT를 사용자 이름에서 검색.
- 조건 필드에 값 소켓이 연결된 경우, 소켓 값이 기본 필드보다 우선한다.

값 블록:
- value_text: fields.TEXT 문자열 반환.
- value_number: fields.NUMBER 숫자 반환.
- value_variable: fields.VARIABLE 변수 조회. 미정의 변수는 빈 문자열.
- value_user_name: 이벤트 사용자 표시 이름.
- value_server_name: 서버 이름.
- value_channel_name: 채널 이름.
- value_current_time: 지정된 서버 시간대의 현재 시간 문자열.
- 값 소켓에 아무 블록도 연결되지 않은 경우 해당 블록 정의의 안전한 기본값 또는 빈 문자열을 사용한다.

## 16-4. 실행기 구현
- 기존 Discord client, 기존 listener, 기존 Supabase 클라이언트를 재사용한다.
- schema_version 2를 검증한 뒤에만 실행한다.
- root 이벤트 매칭 → next 체인 순차 실행 → control 컨테이너의 children/else_children 재귀 실행 순서로 처리한다.
- 재귀는 무제한 허용하지 않는다. 최대 트리 깊이 8, 전체 노드 50, 실행 노드 누적 50, repeat 최대 20회, 전체 실행 15초로 제한한다.
- expression 평가기는 condition_*와 value_* allowlist만 처리한다. 임의 Python 실행이나 문자열 평가 금지.
- Discord API 동작은 기존 권한·서버 소속·역할 계층 검사를 그대로 수행한다.
- node의 type이 allowlist에 없으면 프로젝트 전체를 실행하지 말고 해당 프로젝트를 안전하게 비활성화하거나 실패 로그를 남긴다.
- values 안에 statement type이 들어가거나 children 안에 value/condition type이 들어가는 구조 오류를 거부한다.
- next에 event_*가 들어가는 구조 오류를 거부한다. 이벤트는 roots에서만 허용한다.
- UUID 중복, 누락된 id, 알 수 없는 input key, 예상하지 못한 field, 잘못된 숫자 범위, 과도한 문자열을 검증한다.
- 편집기 JSON의 fields key는 대문자일 수 있다. 런타임은 normalize_fields() 한 곳에서만 소문자 키로 변환한다. 같은 의미의 대문자/소문자 키가 중복되면 거부한다.

## 16-5. 이전 프로젝트 마이그레이션
- schema_version이 없고 blocks 배열이 있는 이전 프로젝트는 기존 v1 마이그레이션 규칙으로만 변환한다.
- 예전 condition_*가 평면 배열에 놓인 경우 조건이 어느 범위까지 적용됐는지 확실하지 않으면 자동으로 추측하지 않는다.
- 의미가 불명확한 기존 조건 프로젝트는 편집기에서 사용자에게 재구성이 필요하다고 안내하고, 원본 JSON을 덮어쓰지 않는다.
- 새 저장은 schema_version 2로만 저장한다.

## 16-6. 성능과 장애 격리
- Blockly 라이브러리는 브라우저에서만 사용한다. Discord 봇에는 Blockly 라이브러리나 브라우저 런타임을 설치하지 않는다.
- 봇은 JSON만 파싱한다. DOM, SVG, 브라우저 코드 실행 금지.
- 서버별 캐시·동시성·실행 제한은 앞선 10절을 그대로 지킨다.
- BLOCKS 파싱/실행 실패가 기존 TEND 명령어, 검열, 경고, 공지, 역할 관리 기능에 영향을 주면 안 된다.

## 16-7. 필수 테스트
- 이벤트 → 만약 → 조건식 → 내부 동작 → 다음 동작 순서.
- if/else의 참·거짓 두 경로.
- 조건 안에 조건을 넣는 중첩.
- 숫자 반복과 20회 상한.
- 텍스트/숫자/변수 값 소켓의 연결과 저장/재로드.
- 연결 해제, 블록 이동, 여러 블록 묶음 이동 후 JSON 구조 유지.
- 50노드/8단계/200KB 제한.
- 잘못된 root, 잘못된 next, 잘못된 values/children 타입 거부.
- 기존 v1 프로젝트 로드와 원본 보존.


---

# 17. Discord 역할·채널 ID 실연동 (필수)

편집기의 역할/채널 선택창은 표시용 문자열을 저장하면 안 된다. 사용자가 선택한 Discord 리소스의 실제 snowflake ID를 저장해야 한다.

## 17-1. 데이터 조회 계약
- 편집기는 선택한 서버의 리소스를 다음 RPC로 조회한다.
  `public.blocks_list_server_resources(target_server_id text)`
- RPC 결과 형식:
  `{ "channels": [{"id":"채널ID","name":"채널명","type":"text"}], "roles": [{"id":"역할ID","name":"역할명","mentionable":true}] }`
- 호출은 로그인한 베타 테스터 세션에서만 한다. 서버 ID는 현재 프로젝트의 server_id를 사용한다. 임의 서버 ID를 받아 조회하지 않는다.
- RPC 내부에서 blocks_is_beta_tester()와 blocks_has_server_access(target_server_id)를 반드시 확인한다.
- 프런트엔드 anon key로 직접 전체 Discord 인벤토리 테이블을 조회하지 않는다. 서버 리소스 RPC만 사용한다.
- 목록이 비어 있거나 조회에 실패하면 가짜 목록이나 ID를 만들지 말고, 편집기에 실패 상태와 새로고침 동작을 표시한다.

## 17-2. 실제 ID 저장 규칙
- channel 필드: channel_id 문자열을 저장한다.
- role 필드: role_id 문자열을 저장한다.
- 화면에는 #채널명 / @역할명 형태로 표시하되, JSON fields에는 ID만 기록한다.
- 채널/역할 이름이 바뀌어도 ID가 같으면 기존 프로젝트 연결은 유지한다.
- 삭제되었거나 현재 서버에 속하지 않는 ID는 실행 시 거부하고 실행 로그에 기록한다.
- 모든 리소스는 반드시 project.server_id에 속해야 한다. 다른 서버의 ID를 재사용하지 않는다.
- 채널 동작 전 봇의 View Channel / Send Messages 등 필요한 권한을 확인한다.
- 역할 지급/회수 전 Manage Roles 권한과 봇 역할의 계층을 확인한다. @everyone, managed role, 봇보다 높거나 같은 역할은 변경할 수 없다.

## 17-3. 편집기 필드
다음 필드는 숫자/문자열 직접 입력 대신 동적 Discord 리소스 드롭다운을 사용한다.
- event_message_create.fields.CHANNEL_FILTER: 전체 채널 또는 실제 채널 선택
- condition_has_role.fields.ROLE_ID: 역할 선택
- condition_channel_is.fields.CHANNEL_ID: 채널 선택
- action_send_message.fields.CHANNEL_ID: 메시지 전송 채널 선택
- action_send_embed.fields.CHANNEL_ID: 임베드 전송 채널 선택
- action_add_role.fields.ROLE_ID: 지급 역할 선택
- action_remove_role.fields.ROLE_ID: 회수 역할 선택
- action_set_slowmode.fields.CHANNEL_ID: 슬로우모드 적용 채널 선택
- 선택창은 채널/역할 이름을 보여주고 실제 ID를 value로 사용한다.
- 프로젝트를 다시 열었을 때 기존 ID가 여전히 목록에 있으면 해당 이름으로 표시한다. 목록에 없으면 "서버에서 삭제되었거나 동기화되지 않은 항목"으로 표시하고 임의 ID로 대체하지 않는다.

## 17-4. 봇 인벤토리 동기화
봇은 이미 실행 중인 기존 Discord client를 사용한다. 새 봇 프로세스나 별도 클라이언트를 만들지 않는다.
- 봇 시작 시 모든 연결 서버의 guild.channels와 guild.roles를 Supabase에 동기화한다.
- 서버 입장 시 즉시 동기화한다.
- on_guild_channel_create/update/delete, on_guild_role_create/update/delete 이벤트에서 해당 서버의 인벤토리를 갱신한다.
- 채널 테이블: public.discord_server_channels
  - server_id, channel_id, channel_name, channel_type, can_view, can_send, is_active, synced_at
  - 복합키 server_id + channel_id로 upsert.
  - can_send는 봇이 해당 텍스트/포럼 채널에서 실제 메시지를 보낼 수 있을 때만 true.
- 역할 테이블: public.discord_server_roles
  - server_id, role_id, role_name, mentionable, is_everyone
  - 복합키 server_id + role_id로 upsert.
  - @everyone도 저장하되 is_everyone=true로 표시한다. 선택 RPC에서는 제외한다.
- 동기화 완료 후 서버에서 삭제된 리소스는 해당 서버 범위에서만 정리한다.
- 동기화 실패는 로그에 남기고 기존 TEND 관리/검열/명령어 기능을 중단하지 않는다.
- Supabase service role key는 봇의 서버 환경변수에서만 사용한다. 브라우저 코드, GitHub 공개 파일, 응답 메시지에 절대 넣지 않는다.
- 128MB 환경에 맞게 전체 동기화는 시작/서버 변경 시에만 실행하고, 짧은 간격의 무거운 반복 폴링은 금지한다.

## 17-5. 검증
- 서버에 채널/역할이 있는 경우 선택창에 이름이 표시된다.
- 블록을 저장한 JSON에는 채널명/역할명이 아니라 정확한 ID가 들어간다.
- 편집기 새로고침 후에도 같은 이름과 ID가 복원된다.
- 다른 서버의 ID, 삭제된 ID, 권한 없는 리소스는 실행되지 않는다.
- 역할 테이블이 비어 있으면 봇 동기화 상태를 안내한다. 빈 목록을 정상 연결로 표시하지 않는다.
