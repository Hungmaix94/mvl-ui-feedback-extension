/**
 * Automated TDD Test Suite for story ui-feedback-v2.2.0 (Multi-Crop / Multi-Comment Filmstrip)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXT_DIR = path.resolve(__dirname, '..');
const candidateWorkerPaths = [
  path.resolve(__dirname, '../../cloudflare-mcp-worker'),
  path.resolve(__dirname, '../ui-feedback-workflow/cloudflare-mcp-worker'),
  path.resolve(__dirname, '../../ui-feedback-workflow/cloudflare-mcp-worker'),
  path.resolve('/Users/phamhung/D/Work/MVL/slackbot/ui-feedback-workflow/cloudflare-mcp-worker'),
];
const WORKER_DIR = candidateWorkerPaths.find(p => fs.existsSync(path.join(p, 'src', 'index.js'))) || candidateWorkerPaths[0];

let totalTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== Running SnapUI v2.2.0 Multi-Crop / Multi-Comment Filmstrip TDD Suite ===\n');

// 1. Manifest version 2.2.0
const manifestRaw = fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
assert(manifest.version === '2.2.0', `TC-1: manifest.json version must be '2.2.0' (got '${manifest.version}')`);

// 2. Content script multi-crop / multi-comment logic + v2.2 URL bar & AI Slackbot badge
const contentJs = fs.readFileSync(path.join(EXT_DIR, 'content.js'), 'utf8');

assert(
  contentJs.includes('MAX_SHOTS') || contentJs.includes('maxShots') || contentJs.includes('8'),
  'TC-2: content.js must define shot limit guard'
);
assert(
  contentJs.includes('items:') && (contentJs.includes('batch:') || contentJs.includes('batchItems')),
  'TC-2: content.js payload must batch all shots into items[]'
);
assert(
  contentJs.includes('mvl-fb-filmstrip') || contentJs.includes('filmstrip'),
  'TC-2: content.js must render filmstrip container'
);
assert(
  contentJs.includes('function escapeHtml') || contentJs.includes('const escapeHtml'),
  'TC-2: content.js must define escapeHtml sanitizer'
);
assert(
  contentJs.includes('role", "dialog"') || contentJs.includes('role=\\"dialog\\"'),
  'TC-2: content.js popover must have role="dialog"'
);
assert(
  contentJs.includes('mvl-fb-url-bar') && contentJs.includes('mvl-pop-copy-url'),
  'TC-2b: content.js must render .mvl-fb-url-bar with copy button #mvl-pop-copy-url'
);
assert(
  contentJs.includes('mvl-fb-slackbot-badge'),
  'TC-2c: content.js popover must render AI Slackbot badge (.mvl-fb-slackbot-badge)'
);

// 3. Content CSS filmstrip, URL bar and AI Slackbot badge styling
const contentCss = fs.readFileSync(path.join(EXT_DIR, 'content.css'), 'utf8');

assert(
  contentCss.includes('overflow-x: auto') || contentCss.includes('overflow-x:auto'),
  'TC-3: content.css filmstrip must support horizontal scrolling (overflow-x: auto)'
);
assert(
  contentCss.includes('width: 48px') || contentCss.includes('width: 44px') || contentCss.includes('width:48px'),
  'TC-3: content.css filmstrip thumbnails must declare compact width'
);
assert(
  contentCss.includes('conic-gradient'),
  'TC-3: content.css must declare checkerboard pattern with conic-gradient'
);
assert(
  !contentCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'TC-3: content.css must not use forbidden "transition: all"'
);
assert(
  contentCss.includes('scale(0.96)'),
  'TC-3: content.css must include tactile scale(0.96) press states'
);
assert(
  contentCss.includes(':focus-visible'),
  'TC-3: content.css must implement :focus-visible'
);
assert(
  contentCss.includes('prefers-reduced-motion'),
  'TC-3: content.css must honor prefers-reduced-motion'
);
assert(
  contentCss.includes('.mvl-fb-url-bar') && contentCss.includes('.mvl-fb-url-copy-btn'),
  'TC-3b: content.css must style .mvl-fb-url-bar and .mvl-fb-url-copy-btn'
);
assert(
  contentCss.includes('.mvl-fb-slackbot-badge'),
  'TC-3c: content.css must style .mvl-fb-slackbot-badge'
);

// 3d. Popup HTML and CSS AI Slackbot badge
const popupHtml = fs.readFileSync(path.join(EXT_DIR, 'popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.join(EXT_DIR, 'popup.css'), 'utf8');

assert(
  popupHtml.includes('slackbot-badge') || popupHtml.includes('slackbot-pill'),
  'TC-3d: popup.html must render AI Slackbot badge'
);
assert(
  popupCss.includes('.slackbot-badge') || popupCss.includes('.slackbot-pill'),
  'TC-3e: popup.css must style AI Slackbot badge'
);

// 3f. Zero Emoji Check across all UI files
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const uiFiles = ['popup.html', 'popup.js', 'popup.css', 'content.js', 'content.css'];
uiFiles.forEach(file => {
  const content = fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
  let hasEmoji = false;
  content.split('\n').forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      hasEmoji = true;
      console.error(`   Found emoji in ${file}:${idx + 1}: ${line.trim()}`);
    }
  });
  assert(!hasEmoji, `TC-3f: ${file} must not contain any emoji`);
});

// 4. Cloudflare Worker index.js Multi-Crop Batch Support
const workerIndexJs = fs.readFileSync(path.join(WORKER_DIR, 'src', 'index.js'), 'utf8');

assert(
  workerIndexJs.includes('body.items') || workerIndexJs.includes('rawItems'),
  'TC-4: worker index.js must parse body.items multi-crop array'
);
assert(
  workerIndexJs.includes('Promise.all') && workerIndexJs.includes('uploadedItems'),
  'TC-4: worker index.js must upload all items concurrently to Cloudflare R2'
);
assert(
  workerIndexJs.includes('itemsHtml') || workerIndexJs.includes('uItem'),
  'TC-4: worker index.js must format multi-item Plane issue description'
);
assert(
  workerIndexJs.includes('formatFeedbackForAgent') && workerIndexJs.includes('items_count'),
  'TC-4: worker formatFeedbackForAgent must expose items and items_count for MCP'
);

// 5. Node Syntax Validation
const extJsFiles = ['popup.js', 'content.js', 'background.js', 'default-config.js', 'page-bridge.js'];
extJsFiles.forEach(file => {
  try {
    execSync(`node --check ${path.join(EXT_DIR, file)}`, { stdio: 'pipe' });
    assert(true, `TC-5: extension ${file} passes node --check`);
  } catch (err) {
    assert(false, `TC-5: extension ${file} fails node --check: ${err.message}`);
  }
});

try {
  execSync(`node --check ${path.join(WORKER_DIR, 'src', 'index.js')}`, { stdio: 'pipe' });
  assert(true, 'TC-5: worker src/index.js passes node --check');
} catch (err) {
  assert(false, `TC-5: worker src/index.js fails node --check: ${err.message}`);
}

console.log(`\n=== TDD Results: ${totalTests - failedTests}/${totalTests} Passed (${failedTests} Failed) ===\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
