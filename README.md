# 🚀 News Telegram Summary (NTS)

AI 기반 뉴스 수집 및 큐레이션 자동화 도구입니다. 매일 정해진 시간에 주요 뉴스 사이트에서 정보를 수집하고, Gemini AI를 통해 중복을 제거한 고품질 뉴스 TOP 15를 선정하여 텔레그램으로 전송합니다.

## 🌟 주요 기능

- **다채로운 뉴스 수집**: 다음(Daum) 뉴스 및 구글 뉴스 RSS를 통해 실시간 주요 뉴스를 수집합니다.
- **AI 스마트 큐레이션**: 최신 Gemini 3.x Flash 모델을 사용하여 수백 개의 뉴스 중 중복 주제를 제거하고 가장 중요한 15개 뉴스를 선별합니다.
- **상세 분석 제공**: 각 뉴스별로 AI가 분석한 '선정 이유(💡)'를 함께 제공합니다.
- **짧은 원문 링크**: 구글 뉴스의 긴 리다이렉트 주소를 Playwright를 통해 실제 언론사 원문 주소로 변환하여 가독성을 높였습니다.
- **높은 안정성**: API 호출 실패 시 자동 재시도(3회) 로직 및 에러 알림 기능을 포함합니다.
- **완전 자동화**: GitHub Actions를 통해 매일 3회(05:30, 09:30, 16:30 KST) 자동으로 실행됩니다.

## 🛠 기술 스택

- **Runtime**: Node.js (v24+)
- **Scraping**: Playwright, RSS-Parser
- **AI**: Google Gemini API (gemini-flash-latest, v3.x 기반)
- **Communication**: Telegram Bot API (Axios)
- **Automation**: GitHub Actions

## 🚀 시작하기

### 1. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 아래 정보를 입력합니다.

```env
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_TOKEN=your_telegram_bot_token
CHAT_ID=your_telegram_chat_id
```

### 2. 설치 및 실행
```bash
npm install
node index.js
```

## 🤖 GitHub Actions 배포

이 프로젝트는 GitHub Actions를 통해 서버 없이도 자동으로 작동하도록 설계되었습니다.

1. 저장소의 **Settings > Secrets and variables > Actions** 메뉴로 이동합니다.
2. 위 환경 변수 3개를 `Repository secrets`로 등록합니다.
3. 매일 정해진 시간(05:30, 09:30, 16:30 KST)에 자동으로 실행됩니다.

## 📅 실행 스케줄
- **1회차**: 오전 05:30 KST (조간 뉴스 요약)
- **2회차**: 오전 09:30 KST (오전 주요 이슈)
- **3회차**: 오후 16:30 KST (퇴근길 뉴스 요약)

---
*본 프로젝트는 LLM 코딩 실수 방지 행동 지침을 준수하여 제작되었습니다.*
