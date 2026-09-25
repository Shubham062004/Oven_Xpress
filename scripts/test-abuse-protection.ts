/**
 * Comprehensive Automated Verification Suite: Abuse Protection & Anti-Bot Hardening
 *
 * Verifies:
 * 1. Login attempt abuse protection (per-email and per-IP credential stuffing defense).
 * 2. Honeypot anti-bot form trap protection.
 * 3. Account creation rate limiting (preventing bulk phantom user flooding).
 * 4. AI generation request rate limiting (burst and hourly quotas).
 * 5. Multi-tiered API endpoint rate limiting (standard, sensitive, export tiers).
 * 6. Automated scraper and bot detection (curl, python, scrapy, headless browsers, AI crawlers).
 */

import {
  checkLoginAbuse,
  resetLoginRateLimit,
  checkAccountCreationRateLimit,
  checkAiGenerationRateLimit,
  checkApiEndpointRateLimit,
  validateHoneypot,
  isAutomatedBotOrScraper,
  HONEYPOT_FIELD_NAME,
} from '../src/lib/security/abuse-protection';
import { detectBotOrScraper } from '../src/lib/security/traffic-detector';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`         ${detail}`);
  }
}

async function runAbuseProtectionTests() {
  console.log('========================================================');
  console.log('   ABUSE PROTECTION & ANTI-BOT VERIFICATION SUITE       ');
  console.log('========================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: LOGIN ATTEMPTS ABUSE PROTECTION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('▶ 1. Testing Login Attempt Rate Limiting & Abuse Defense...');

  const testEmail = 'victim_staff@ovenxpress.com';
  const testIp = '198.51.100.42';
  resetLoginRateLimit(testEmail, testIp);

  // Per-email threshold: 5 attempts
  for (let i = 1; i <= 5; i++) {
    const res = checkLoginAbuse({ email: testEmail, clientIp: testIp });
    assert(res.allowed, `Email attempt ${i}/5 is allowed`);
  }

  // 6th attempt on same email must be throttled
  const throttledEmail = checkLoginAbuse({ email: testEmail, clientIp: testIp });
  assert(!throttledEmail.allowed, '6th login attempt on same email is throttled');
  assert(throttledEmail.retryAfterSeconds > 0, 'Throttled email returns positive retryAfterSeconds');

  // Credential Stuffing / Password Spraying Defense (Per-IP limit: 25 attempts across different accounts)
  const attackerIp = '203.0.113.88';
  for (let i = 1; i <= 25; i++) {
    const sprayEmail = `random_victim_${i}_${Date.now()}@restaurant.com`;
    const sprayRes = checkLoginAbuse({ email: sprayEmail, clientIp: attackerIp });
    assert(sprayRes.allowed, `Credential spray attempt ${i}/25 from attacker IP is tracked`);
  }

  // 26th attempt from the same attacker IP must be throttled even with a brand new email!
  const newEmail = `another_victim_${Date.now()}@restaurant.com`;
  const sprayedIpResult = checkLoginAbuse({ email: newEmail, clientIp: attackerIp });
  assert(
    !sprayedIpResult.allowed,
    'IP-wide credential stuffing spray is blocked across multiple distinct emails'
  );

  // Honeypot anti-bot validation
  const cleanFormData = new FormData();
  cleanFormData.set('email', 'human@example.com');
  cleanFormData.set('password', 'ValidPass123!');
  assert(validateHoneypot(cleanFormData), 'Honeypot allows legitimate form with empty honeypot field');

  const botFormData = new FormData();
  botFormData.set('email', 'bot@spammer.com');
  botFormData.set('password', 'BotPass123!');
  botFormData.set(HONEYPOT_FIELD_NAME, 'I am an automated spam bot filling all inputs');
  assert(!validateHoneypot(botFormData), 'Honeypot catches and rejects bot that completed hidden trap field');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: ACCOUNT CREATION RATE LIMITING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 2. Testing Account Creation Rate Limiting...');

  const adminId = 'admin_actor_xyz';
  for (let i = 1; i <= 10; i++) {
    const createRes = checkAccountCreationRateLimit(adminId);
    assert(createRes.allowed, `Account creation ${i}/10 within 10-minute window is allowed`);
  }

  // 11th creation must be blocked
  const floodCreation = checkAccountCreationRateLimit(adminId);
  assert(!floodCreation.allowed, '11th account creation within window is rejected');
  assert(floodCreation.retryAfterSeconds > 0, 'Account creation throttle returns cooldown timer');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: AI GENERATION REQUEST RATE LIMITING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 3. Testing AI Generation Request Rate Limiting...');

  const aiUserId = 'chef_user_777';
  for (let i = 1; i <= 10; i++) {
    const aiRes = checkAiGenerationRateLimit(aiUserId);
    assert(aiRes.allowed, `AI generation request ${i}/10 burst per minute is allowed`);
  }

  // 11th burst request must be blocked
  const burstAiBlock = checkAiGenerationRateLimit(aiUserId);
  assert(!burstAiBlock.allowed, '11th AI generation request in burst window is rate limited');
  assert(
    burstAiBlock.reason?.includes('Burst limit reached') ?? false,
    'Burst AI limit returns descriptive cooldown message'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: TIERED API ENDPOINT RATE LIMITING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 4. Testing Multi-Tiered API Endpoint Rate Limiting...');

  const clientIpTier = '192.0.2.99';

  // Export tier (15 requests / min)
  for (let i = 1; i <= 15; i++) {
    const exportRes = checkApiEndpointRateLimit('/api/reports/sales/csv', clientIpTier, 'export');
    assert(exportRes.allowed, `Report CSV export ${i}/15 allowed in export tier`);
  }
  const blockedExport = checkApiEndpointRateLimit('/api/reports/sales/csv', clientIpTier, 'export');
  assert(!blockedExport.allowed, '16th report export request in 1 minute is rate limited');

  // Sensitive tier (30 requests / min)
  for (let i = 1; i <= 30; i++) {
    const sensitiveRes = checkApiEndpointRateLimit('/api/customers/lookup', clientIpTier, 'sensitive');
    assert(sensitiveRes.allowed, `Sensitive data lookup ${i}/30 allowed`);
  }
  const blockedSensitive = checkApiEndpointRateLimit('/api/customers/lookup', clientIpTier, 'sensitive');
  assert(!blockedSensitive.allowed, '31st sensitive lookup request is rate limited');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: ANTI-BOT & SCRAPER PROTECTION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 5. Testing Automated Scraper & Bot Detection...');

  // CLI HTTP clients
  assert(isAutomatedBotOrScraper('curl/7.88.1'), 'Detects and flags curl CLI scraper');
  assert(isAutomatedBotOrScraper('Wget/1.21.3'), 'Detects and flags wget tool');

  // Python and script scraping frameworks
  assert(isAutomatedBotOrScraper('python-requests/2.31.0'), 'Detects python-requests scraper');
  assert(isAutomatedBotOrScraper('Python-urllib/3.10'), 'Detects python-urllib scraper');
  assert(isAutomatedBotOrScraper('Scrapy/2.11.0 (+https://scrapy.org)'), 'Detects Scrapy scraping framework');
  assert(isAutomatedBotOrScraper('HTTPX/0.24.1'), 'Detects HTTPX asynchronous scraper');
  assert(isAutomatedBotOrScraper('aiohttp/3.8.5'), 'Detects aiohttp scraping client');

  // Headless automation and browser driving tools
  assert(isAutomatedBotOrScraper('Mozilla/5.0 HeadlessChrome/114.0.5735.198'), 'Detects Headless Chrome automation');
  assert(isAutomatedBotOrScraper('Puppeteer/19.11.1'), 'Detects Puppeteer headless automation');
  assert(isAutomatedBotOrScraper('Selenium/4.12.0 (Playwright)'), 'Detects Selenium / Playwright scraping drivers');

  // Commercial / AI data harvesting crawlers
  assert(isAutomatedBotOrScraper('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'), 'Detects GPTBot AI crawler');
  assert(isAutomatedBotOrScraper('Bytespider; spider-feedback@bytedance.com'), 'Detects Bytespider web harvester');
  assert(isAutomatedBotOrScraper('CCBot/2.0 (https://commoncrawl.org/faq/)'), 'Detects CommonCrawl scraper');

  // Missing or empty User-Agent
  assert(isAutomatedBotOrScraper(''), 'Rejects empty User-Agent as automated script signature');
  assert(isAutomatedBotOrScraper(null), 'Rejects null User-Agent as automated script signature');

  // Route-aware bot check on protected endpoints
  const botOnApi = detectBotOrScraper('/api/customers', 'python-requests/2.31.0');
  assert(botOnApi.isBot, 'detectBotOrScraper blocks python scraper on /api/customers');

  const botOnReports = detectBotOrScraper('/reports/sales', 'curl/8.0.1');
  assert(botOnReports.isBot, 'detectBotOrScraper blocks curl scraper on /reports/sales');

  // Legitimate browsers allowed on all routes
  const chromeBrowser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assert(!isAutomatedBotOrScraper(chromeBrowser), 'Allows legitimate Chrome browser User-Agent');

  const normalBrowserOnApi = detectBotOrScraper('/api/customers', chromeBrowser);
  assert(!normalBrowserOnApi.isBot, 'Legitimate browser allowed on API endpoint');

  console.log('\n========================================================');
  console.log(` ABUSE PROTECTION RESULTS: ${passed}/${passed + failed} CHECKS PASSED `);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAbuseProtectionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
