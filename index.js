const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { chromium } = require('playwright');
const axios = require('axios');
const Parser = require('rss-parser');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const parser = new Parser();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeAll() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let allNews = [];

    // 1. Daum Scaping (제목 + 요약)
    try {
        await page.goto('https://news.daum.net/', { waitUntil: 'networkidle' });
        const daum = await page.$$eval('.list_newsissue li', elms => 
            elms.map(el => {
                const a = el.querySelector('.tit_g a') || el.querySelector('a.item_newsheadline2');
                const desc = el.querySelector('.desc_g');
                if (!a) return null;
                return { 
                    title: a.innerText.split('\n')[0].trim(), 
                    description: desc ? desc.innerText.trim() : '',
                    link: a.href, 
                    source: 'Daum' 
                };
            }).filter(item => item !== null)
        );
        allNews.push(...daum);
    } catch (e) { console.error('Daum error', e); }

    // 2. Google News RSS (제목 + 요약)
    try {
        const feed = await parser.parseURL('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko');
        const google = feed.items.map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content || '',
            link: item.link,
            source: 'Google'
        }));
        allNews.push(...google);
    } catch (e) { console.error('Google RSS error', e); }

    await browser.close();
    return allNews.filter(n => n.title && n.title.length > 5);
}

async function getTopNewsWithGemini(newsList) {
    const newsSummary = newsList.map((n, i) => 
        `[${i}] 제목: ${n.title}\n요약: ${n.description.substring(0, 100)}\n출처: ${n.source}`
    ).join('\n\n');

    const prompt = `
당신은 전문 뉴스 편집자입니다. 아래 제공된 뉴스 목록을 분석하여 독자에게 가장 중요한 뉴스 10개를 선별해 주세요.

**수행 작업:**
1. **주제 중복 제거**: 동일한 사건이나 주제를 다루는 뉴스는 그룹화하고, 그 중 가장 정보량이 많거나 품질이 좋은 기사 하나만 선택하세요.
2. **중요도 산정**: 시의성이 높고 사회적 영향력이 큰 뉴스를 우선하세요.
3. **최종 선정**: 중복되지 않는 서로 다른 주제의 뉴스 10개를 선정하여 중요도 순으로 나열하세요.

**응답 형식 (JSON 배열만 답변):**
[
  {"index": 번호, "reason": "선정 이유 요약"}
]

**뉴스 목록:**
${newsSummary}
    `;

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: prompt }] }]
                }
            );

            const resultText = response.data.candidates[0].content.parts[0].text;
            const jsonMatch = resultText.match(/\[[\s\S]*\]/);
            const selectedIndices = JSON.parse(jsonMatch[0]);

            return {
                news: selectedIndices.map(item => ({
                    ...newsList[item.index],
                    reason: item.reason
                })),
                error: null
            };
        } catch (e) {
            lastError = e.response ? e.response.data.error : { message: e.message };
            console.error(`Gemini API Attempt ${attempt} failed:`, lastError);
            
            if (attempt < 3) {
                console.log('Waiting 1 minute before retry...');
                await sleep(60000); // 1분 대기
            }
        }
    }

    // 3회 재시도 모두 실패 시
    return {
        news: newsList.slice(0, 10).map(n => ({ ...n, reason: 'AI 분석 실패로 자동 선정됨' })),
        error: lastError
    };
}

async function resolveFinalUrls(news) {
    console.log('Resolving final URLs with Playwright...');
    const browser = await chromium.launch({ headless: true });
    const resolvedNews = [];

    for (const item of news) {
        if (!item.link.includes('google.com')) {
            resolvedNews.push(item);
            continue;
        }

        const page = await browser.newPage();
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
            try {
                await page.waitForURL(u => !u.href.includes('google.com'), { timeout: 5000 });
            } catch (e) {}
            resolvedNews.push({ ...item, link: page.url() });
        } catch (e) {
            resolvedNews.push(item);
        }
        await page.close();
    }

    await browser.close();
    return resolvedNews;
}

async function sendTelegram(news, errorInfo = null) {
    const date = new Date().toISOString().split('T')[0];
    let message = `🚀 [${date}] AI 엄선 주요 뉴스 TOP 10\n\n`;

    news.forEach((n, i) => {
        message += `${i + 1}. ${n.title}\n💡 ${n.reason}\n🔗 ${n.link}\n(출처: ${n.source})\n\n`;
    });

    if (errorInfo) {
        message += `⚠️ AI 분석 중 에러가 발생하여 기본 목록으로 발송되었습니다.\n`;
        message += `에러 코드: ${errorInfo.code || 'N/A'}\n`;
        message += `에러 메시지: ${errorInfo.message}\n\n`;
    }

    message += `Gemini AI가 상세 요약 정보를 바탕으로 선별한 목록입니다. 🍀`;

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
        chat_id: CHAT_ID,
        text: message
    });
}

async function main() {
    if (!TELEGRAM_TOKEN || !GEMINI_API_KEY) {
        throw new Error('Missing environment variables.');
    }

    console.log('Step 1: Scaping all news with descriptions...');
    const allNews = await scrapeAll();
    console.log(`Collected ${allNews.length} news items.`);

    console.log('Step 2: AI Filtering (Gemini) - Top 10 with Retry Logic...');
    const { news: topNews, error: errorInfo } = await getTopNewsWithGemini(allNews);

    console.log('Step 3: Resolving final URLs...');
    const finalNews = await resolveFinalUrls(topNews);

    console.log('Step 4: Sending to Telegram...');
    await sendTelegram(finalNews, errorInfo);
    console.log('Successfully finished!');
}

main().catch(console.error);
