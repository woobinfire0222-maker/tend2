
# TEND BLOCKS — 기존 TEND Discord 봇 런타임 구현 지시서

이 프로젝트는 기존 TEND Discord 봇에 TEND BLOCKS 자동화 실행기를 추가하는 작업이다. 먼저 현재 프로젝트 구조와 기존 이벤트 처리, Supabase 연결, 경고/역할/메시지 처리 로직을 확인한 다음 구현한다. 기존 기능을 삭제하거나 중복 봇을 만들지 않는다.

## 1. 절대 지켜야 할 구조

- 현재 실행 중인 TEND Discord 봇 프로세스 하나에 런타임을 통합한다.
- 별도의 봇 프로세스, 별도 Discord 클라이언트, 작업마다 생성하는 서브프로세스를 만들지 않는다.
- TEND BLOCKS 편집기는 브라우저에서 실행되고, Supabase의 blocks_projects 테이블에 JSON으로 저장된다.
- 봇은 Discord 이벤트가 발생했을 때만 해당 서버의 활성 프로젝트를 읽어 실행한다.
- 기존 Supabase 연결 모듈과 기존 Discord 클라이언트를 재사용한다.
- 기존 TEND 기능과 명령어, 경고, 금칙어, 공지, 역할 관리 로직은 유지한다.
- TEND 호스팅은 메모리 128MB 수준이므로 메모리·CPU 사용량을 최소화한다.
- 음성, TTS, 음악, 음성 인식, AI 호출, 번역, 대형 외부 라이브러리, 무거운 백그라운드 폴링은 구현하지 않는다.

## 2. Supabase 데이터 구조

이미 적용된 테이블을 그대로 사용한다.

### blocks_projects
- id: UUID 프로젝트 ID
- owner_id: 프로젝트 소유자의 Supabase auth user UUID
- server_id: Discord 서버 ID 문자열
- name: 프로젝트 이름
- project_data: JSONB 프로젝트 데이터
- is_enabled: 실행 활성화 여부
- version: 저장할 때 증가하는 정수
- created_at, updated_at

봇은 service role 자격 증명을 서버 환경변수에서만 읽는다. 브라우저 코드나 로그에 service role key를 절대 노출하지 않는다. 기존 환경변수 이름을 우선 재사용하고, 없다면 SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY를 환경변수로 추가한다. 키를 소스 코드에 하드코딩하지 않는다.

### blocks_execution_logs
실행 결과를 저장한다.
- project_id
- owner_id
- server_id
- event_type
- status: success, failed, skipped 중 하나
- message: 최대 500자 요약
- created_at

로그에는 전체 Discord 메시지 내용, 토큰, 비밀값을 저장하지 않는다. 성공/실패 이유만 간단히 남긴다.

## 3. 프로젝트 JSON 형식

브라우저에서 저장되는 기본 구조는 다음과 같다.

    {
      "version": 1,
      "variables": ["count", "greeting"],
      "blocks": [
        {
          "id": "UUID",
          "type": "event_message_create",
          "fields": {
            "channel_filter": ""
          }
        },
        {
          "id": "UUID",
          "type": "condition_contains",
          "fields": {
            "keyword": "안녕하세요"
          }
        },
        {
          "id": "UUID",
          "type": "action_send_message",
          "fields": {
            "channel_id": "DISCORD_CHANNEL_ID",
            "content": "환영합니다!",
            "mention_mode": "none",
            "mention_id": "",
            "delete_after_seconds": "",
            "thread_mode": "none"
          }
        }
      ]
    }

프로젝트 JSON은 신뢰할 수 없는 사용자 입력이다. DB에서 읽은 데이터도 실행 전에 반드시 검증한다. 허용 목록에 없는 type은 건너뛰고 오류 로그를 남긴다.

## 4. 지원해야 할 블록과 동작

### 이벤트 블록
- event_message_create: Discord 메시지 생성 이벤트
- event_member_join: 멤버 입장 이벤트
- event_member_leave: 멤버 퇴장 이벤트

### 조건 블록
- condition_contains
  - fields.keyword
  - 현재 메시지 내용에 해당 단어가 포함되는지 검사한다.
  - 기본은 대소문자 구분 없는 비교로 처리한다.
- condition_has_role
  - fields.role_id
  - 이벤트 대상 멤버가 해당 역할을 가지고 있는지 확인한다.

### 메시지 동작
- action_send_message
  - fields.channel_id
  - fields.content
  - fields.mention_mode: none, everyone, here, user, role
  - fields.mention_id
  - fields.delete_after_seconds
  - fields.thread_mode: none, create, reply
  - channel_id가 해당 프로젝트의 server_id에 속하는 채널인지 확인한다.
  - 기본 멘션은 반드시 none이다.
  - 명시된 mention_mode와 mention_id만 허용 멘션으로 구성한다.
  - 일반 텍스트 안에 @everyone 또는 @here 문자열이 들어 있다고 자동으로 멘션하지 않는다.
  - 메시지 길이는 Discord 제한을 지킨다.
  - 삭제 시간은 0~86400초 범위로 제한한다.
  - 채널 전송 권한이 없거나 채널이 다른 서버 소속이면 동작을 건너뛴다.

- action_send_embed
  - fields.channel_id
  - fields.embed_title
  - fields.author
  - fields.description
  - fields.color
  - fields.footer
  - fields.title_url
  - fields.thumbnail_url
  - fields.image_url
  - fields.timestamp
  - Discord Embed의 제목·설명·필드·URL 길이 제한을 검사한다.
  - URL은 HTTPS만 허용한다.
  - 잘못된 HEX 색상은 기본 색상으로 대체한다.

- action_reply
  - fields.content
  - fields.reply_target: event_message, latest_message, message_id
  - fields.target_message_id
  - fields.fallback: send_new, skip
  - fields.mention_author: false, true
  - 기본값은 작성자 멘션 false다.
  - 현재 이벤트 메시지 또는 명시한 메시지만 답글 대상으로 사용한다.
  - 대상이 없으면 fallback에 따라 새 메시지로 전송하거나 건너뛴다.

### 역할·경고 동작
- action_add_role
  - fields.role_id
  - action_remove_role
  - fields.role_id
  - action_warn
  - fields.reason

역할 지급/회수는 기존 TEND 역할 관리 함수를 우선 재사용한다. 역할이 같은 서버 소속인지, 봇에게 Manage Roles 권한이 있는지, 봇의 최고 역할보다 낮은지 검사한다. @everyone, 통합 관리 역할, 봇보다 높은 역할은 변경하지 않는다.

action_warn은 기존 TEND 경고 처리 로직을 재사용한다. 기존 warnings 테이블이나 기존 경고 기록 체계를 중복 생성하지 않는다.

### 제어·변수 블록
- control_wait
  - fields.seconds
  - 최대 10초
  - asyncio.sleep 등 비동기 대기를 사용한다. 이벤트 루프를 동기 방식으로 멈추지 않는다.
- data_set_variable
  - fields.variable
  - fields.value
- data_change_variable
  - fields.variable
  - fields.amount

변수는 한 번의 자동화 실행 컨텍스트 안에서만 유지한다. 별도 영구 저장 기능은 만들지 않는다. 메시지 문자열 안의 {{변수명}} 패턴은 현재 실행 컨텍스트의 값으로 치환한다. 없는 변수는 빈 문자열로 처리하고 로그에 과도한 정보를 남기지 않는다.

## 5. 실행 순서와 이벤트 해석

- 한 프로젝트의 blocks 배열은 최대 50개다. DB 제약과 별개로 봇에서도 50개를 초과하면 전체 실행을 거부한다.
- event_* 블록은 자동화 분기의 시작점이다.
- 각 이벤트 블록부터 다음 이벤트 블록 직전까지를 하나의 분기로 본다.
- 현재 이벤트 타입과 일치하는 분기만 실행한다.
- 조건 블록이 false를 반환하면 현재 분기 실행을 중단한다.
- 조건이 통과하면 뒤에 오는 동작 블록을 배열 순서대로 실행한다.
- 한 프로젝트 안에 이벤트 블록이 여러 개 있어도 이벤트 종류별 분기를 독립적으로 처리한다.
- 이벤트 블록이 없는 프로젝트는 실행하지 않는다.
- 무한 반복, 재귀 실행, 사용자 정의 코드, 임의 수식 실행 기능은 지원하지 않는다.
- 사용자가 만든 메시지가 다시 같은 자동화를 무한 실행하지 않도록 봇 자신의 메시지는 기본적으로 무시한다. 필요하면 별도 안전한 옵션을 추가하되 기본은 비활성이다.

## 6. 성능 제한 — 128MB 호스팅 기준

- 봇 시작 시 모든 프로젝트를 메모리에 전부 적재하지 않는다.
- Discord 이벤트가 들어온 서버에 대해 is_enabled=true인 프로젝트만 조회한다.
- 서버별 프로젝트 조회 결과는 짧은 TTL 캐시(권장 30~60초)를 사용한다.
- 캐시 최대 서버 수는 100개 이내로 제한하고 오래된 항목은 제거한다.
- 이벤트마다 새 Supabase 클라이언트를 만들지 않는다.
- 프로젝트 실행은 asyncio 기반으로 처리한다.
- 전역 동시 실행은 최대 2개, 서버별 동시 실행은 최대 1개부터 시작한다.
- 한 서버에서 1분에 실행할 수 있는 프로젝트 실행 횟수를 제한한다. 초기 기본값은 서버당 10회/분으로 한다.
- 블록 실행 도중 새 작업 프로세스를 만들거나, 별도 스레드를 무분별하게 생성하지 않는다.
- DB 조회 실패 시 봇의 기존 기능은 계속 작동해야 한다. BLOCKS 기능만 건너뛰고 로그를 남긴다.
- 프로젝트 데이터 캐시와 실행 컨텍스트에 사용자 메시지 원문이나 불필요한 객체를 장기간 보관하지 않는다.
- 이벤트 처리 중 예외가 발생해도 Discord 봇 전체가 종료되지 않게 한다.

## 7. Discord 이벤트 연결

기존 이벤트 처리 구조를 먼저 조사한다.

- on_message를 이미 사용 중이면 기존 핸들러를 덮어쓰지 않는다.
- 가능한 경우 @bot.listen("on_message") 형태로 BLOCKS 런타임을 별도 연결한다.
- 기존 on_message 안에서 처리해야 한다면 기존 검열, 명령어 처리, process_commands 흐름을 보존한다.
- on_member_join, on_member_remove 이벤트도 기존 이벤트와 충돌하지 않도록 연결한다.
- DM, 다른 서버 이벤트, 봇 계정의 메시지는 프로젝트 실행 조건과 일치하지 않으면 무시한다.

## 8. 보안 및 남용 방지

절대로 다음 기능을 추가하지 않는다.
- eval, exec, compile
- 임의 Python/JavaScript 코드 실행
- 동적 import
- 쉘 명령 실행
- 파일 시스템 접근
- 외부 URL 임의 요청
- 무한 루프, 재귀, 무제한 대기
- 임의 SQL 실행

블록 type은 위에 정의한 allowlist로만 실행한다. fields의 타입·길이·ID 형식을 모두 검사한다. 모든 채널·역할·멤버 ID가 현재 이벤트 서버에 속하는지 확인한다.

멘션은 기본 차단한다. @everyone/@here는 사용자가 mention_mode에서 명시적으로 선택한 경우에만 제한적으로 허용한다. 사용자·역할 멘션은 mention_id가 정확히 유효할 때만 허용한다.

봇에 권한이 없거나 Discord API에서 오류가 나면 실행을 중단하고 해당 프로젝트 로그에 짧은 실패 사유를 기록한다. 오류가 발생해도 다른 프로젝트 실행이나 기존 TEND 기능은 중단하지 않는다.

## 9. 로그 정책

blocks_execution_logs에 다음 값을 저장한다.
- project_id: 현재 프로젝트 UUID
- owner_id: 프로젝트 owner_id
- server_id: 현재 Discord 서버 ID 문자열
- event_type: message_create, member_join, member_leave
- status: success, failed, skipped
- message: 실행 요약, 최대 500자

메시지 전체 내용, Discord OAuth 토큰, Supabase 키, 환경변수, 민감한 사용자 데이터는 기록하지 않는다. 로그 기록 실패가 자동화 실행이나 기존 봇 기능을 중단시키면 안 된다.

## 10. 구현 및 검증 순서

1. 현재 TEND 봇 구조, 이벤트 핸들러, DB 연결 모듈, 기존 역할·경고 기능을 먼저 조사한다.
2. 기존 기능을 유지하는 방식으로 blocks runtime 모듈을 추가한다.
3. DB에서 활성 프로젝트를 읽는 함수와 서버별 캐시를 구현한다.
4. JSON 구조 검증과 allowlist 검증을 구현한다.
5. 이벤트 블록 분기, 조건, 변수 치환을 구현한다.
6. 메시지/임베드/답글/역할/경고/대기 동작을 구현한다.
7. 실행 제한, 동시 실행 제한, 로그 기록을 구현한다.
8. 기존 이벤트 핸들러와 통합한다.
9. 다음 테스트를 실행한다.
   - 활성화되지 않은 프로젝트는 실행되지 않는가
   - 다른 서버의 프로젝트가 실행되지 않는가
   - 이벤트 종류가 일치할 때만 실행되는가
   - 조건 false일 때 뒤의 동작이 중단되는가
   - 변수 {{name}} 치환이 작동하는가
   - 채널·역할 ID가 다른 서버 소속이면 거부되는가
   - 50개 초과 블록이 거부되는가
   - 잘못된 블록 type이 안전하게 무시되는가
   - 동시 실행 제한과 서버별 rate limit이 적용되는가
   - 실행 실패가 기존 봇 기능에 영향을 주지 않는가
10. 수정한 파일 목록, 추가한 환경변수, 테스트 결과, 남은 작업을 보고한다.

## 11. 최종 목표

사용자가 TEND BLOCKS 사이트에서 만든 프로젝트를 저장하고 실행 활성화하면, 기존 TEND 봇이 해당 서버에서 발생하는 Discord 이벤트를 감지해 JSON 블록을 안전하게 해석하고 실행한다. 브라우저는 설정과 저장만 담당하고 실제 Discord API 동작은 기존 봇이 담당한다.

가장 중요한 원칙은 기존 TEND 기능을 망가뜨리지 않는 것, 임의 코드 실행을 허용하지 않는 것, 128MB 메모리 제한을 넘기지 않는 것이다.
