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
