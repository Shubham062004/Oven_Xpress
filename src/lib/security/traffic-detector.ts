/**
 * Traffic Anomaly & Malicious Probe Detection
 *
 * Inspects incoming request metadata (path, headers, query params) to detect:
 * 1. Exploitation probes targeting sensitive files (.env, .git, .aws, credentials).
 * 2. Vulnerability scanners targeting unmaintained software (WordPress, phpMyAdmin, cPanel, WebShells).
 * 3. Path traversal sequences (../, %2e%2e, backslashes).
 * 4. Known automated penetration testing and attacker scanner tools (sqlmap, nikto, masscan).
 * 5. Dangerous HTTP methods (TRACE, TRACK).
 */

export interface ProbeDetectionResult {
  isSuspicious: boolean;
  reason?: string;
  statusCode?: number;
  anomalyType?: 'SUSPICIOUS_PROBE' | 'PATH_TRAVERSAL_ATTEMPT' | 'MALICIOUS_USER_AGENT';
}

// Regex patterns for sensitive files and known probe paths
const SENSITIVE_FILE_PATTERNS = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.svn/i,
  /^\/\.hg/i,
  /^\/\.bzr/i,
  /^\/\.aws/i,
  /^\/\.ssh/i,
  /^\/\.config/i,
  /^\/\.ds_store/i,
  /^\/web\.config/i,
  /^\/config\.json/i,
  /^\/package\.json/i,
  /^\/backup/i,
  /^\/dump\.sql/i,
];

// Patterns for common vulnerability scanner paths (CMS, web shells, DB management)
const SCANNER_PATH_PATTERNS = [
  /\/wp-admin/i,
  /\/wp-login\.php/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/pma/i,
  /\/myadmin/i,
  /\/mysql/i,
  /\/admin\.php/i,
  /\/eval-stdin\.php/i,
  /\/shell\.php/i,
  /\/c99\.php/i,
  /\/r57\.php/i,
  /\/wso\.php/i,
  /\/actuator/i,
  /\/solr/i,
  /\/invoker/i,
];

// Path traversal sequences
const TRAVERSAL_PATTERNS = [
  /\.\./,
  /%2e%2e/i,
  /%252e%252e/i,
  /\.\.\\/,
  /\/\.\./,
];

// Known attacker user agents
const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /acunetix/i,
  /havij/i,
  /nmap/i,
  /dirbuster/i,
  /gobuster/i,
  /wpscan/i,
];

/**
 * Inspects a request path and headers for suspicious patterns.
 */
export function detectSuspiciousTraffic(
  pathname: string,
  userAgent?: string | null
): ProbeDetectionResult {
  // 1. Path traversal detection
  for (const pattern of TRAVERSAL_PATTERNS) {
    if (pattern.test(pathname)) {
      return {
        isSuspicious: true,
        reason: 'Path traversal sequence detected in request URI',
        statusCode: 400,
        anomalyType: 'PATH_TRAVERSAL_ATTEMPT',
      };
    }
  }

  // 2. Sensitive configuration/credential file probes
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(pathname)) {
      return {
        isSuspicious: true,
        reason: 'Attempted access to protected environment or system configuration artifact',
        statusCode: 404,
        anomalyType: 'SUSPICIOUS_PROBE',
      };
    }
  }

  // 3. Known scanner / web shell probes
  for (const pattern of SCANNER_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return {
        isSuspicious: true,
        reason: 'Probe pattern matching known exploit or scanner signature',
        statusCode: 404,
        anomalyType: 'SUSPICIOUS_PROBE',
      };
    }
  }

  // 4. Malicious scanner user agents
  if (userAgent) {
    for (const pattern of SUSPICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        return {
          isSuspicious: true,
          reason: `Automated vulnerability scanner user-agent signature detected: ${userAgent}`,
          statusCode: 403,
          anomalyType: 'MALICIOUS_USER_AGENT',
        };
      }
    }
  }

  return { isSuspicious: false };
}

// Regex patterns for automated scraping libraries, CLI tools, and headless engines
const BOT_SCRAPER_PATTERNS = [
  /^curl\//i,
  /^wget\//i,
  /^python-requests/i,
  /^python-urllib/i,
  /^requests\//i,
  /^scrapy/i,
  /^httpx/i,
  /^aiohttp/i,
  /^libwww-perl/i,
  /^guzzlehttp/i,
  /^go-http-client/i,
  /^apache-httpclient/i,
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /bytespider/i,
  /gptbot/i,
  /ccbot/i,
  /claudebot/i,
  /semrushbot/i,
  /ahrefsbot/i,
];

/**
 * Detects whether an incoming request exhibits bot or automated scraper characteristics.
 * Blocks scraping on protected application and data routes.
 */
export function detectBotOrScraper(
  pathname: string,
  userAgent?: string | null
): { isBot: boolean; reason?: string } {
  const isProtectedDataRoute =
    pathname.startsWith('/api') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/salary') ||
    pathname.startsWith('/purchases');

  if (!isProtectedDataRoute) {
    return { isBot: false };
  }

  if (!userAgent || userAgent.trim().length === 0) {
    return {
      isBot: true,
      reason: 'Empty or missing User-Agent header on protected data endpoint',
    };
  }

  const trimmed = userAgent.trim();
  for (const pattern of BOT_SCRAPER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isBot: true,
        reason: `Automated scraper/bot detected (${trimmed}) on protected path ${pathname}`,
      };
    }
  }

  return { isBot: false };
}
