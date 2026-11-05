/**
 * Automated TDD Test Suite for story ui-feedback-v2.3.0 (On-Page Visual Comment Pins & Bounding Boxes)
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

console.log('=== Running SnapUI v2.3.0 Visual Pins & E2E Verification Suite ===\n');

// 1. Manifest version 2.3.0
const manifestRaw = fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
assert(manifest.version === '2.3.0', `TC-1: manifest.json version must be '2.3.0' (got '${manifest.version}')`);

// 2. Content script v2.3 Visual Pins logic
const contentJs = fs.readFileSync(path.join(EXT_DIR, 'content.js'), 'utf8');

assert(
  contentJs.includes('renderOnPagePins') && contentJs.includes('mvl-fb-pins-layer'),
  'TC-2a: content.js must implement renderOnPagePins and render .mvl-fb-pins-layer'
);
assert(
  contentJs.includes('mvl-fb-pin-box') && contentJs.includes('mvl-fb-pin-badge') && contentJs.includes('mvl-fb-pin-bubble'),
  'TC-2b: content.js must render .mvl-fb-pin-box, .mvl-fb-pin-badge, and .mvl-fb-pin-bubble'
);
assert(
  contentJs.includes('data-pin-idx') && contentJs.includes('activeItemIndex = targetIdx'),
  'TC-2c: content.js must support pin click to switch active draft item'
);
assert(
  contentJs.includes('submittedPins.push') && contentJs.includes('mvl-fb-clear-pins'),
  'TC-2d: content.js must persist submittedPins and support clearing pins via #mvl-fb-clear-pins'
);
assert(
  contentJs.includes('pinsLayer.style.display = "none"') && contentJs.includes('captureAndCropRect'),
  'TC-2e: content.js must hide pinsLayer during capture to ensure clean screenshots'
);

// 3. Content CSS v2.3 Visual Pins styling
const contentCss = fs.readFileSync(path.join(EXT_DIR, 'content.css'), 'utf8');

assert(
  contentCss.includes('.mvl-fb-pins-layer') && contentCss.includes('pointer-events: none'),
  'TC-3a: content.css must set .mvl-fb-pins-layer with pointer-events: none'
);
assert(
  contentCss.includes('.mvl-fb-pin-box') && contentCss.includes('.mvl-fb-pin-badge') && contentCss.includes('.mvl-fb-pin-bubble'),
  'TC-3b: content.css must style pin-box, pin-badge, and pin-bubble'
);
assert(
  !contentCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'TC-3c: content.css must not use forbidden "transition: all"'
);
assert(
  contentCss.includes('.mvl-fb-pin-box.qa') && contentCss.includes('#10b981'),
  'TC-3d: content.css must style QA mode pins with emerald green (#10b981)'
);

// 4. Zero Emoji Check across all UI files
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
  assert(!hasEmoji, `TC-4: ${file} must not contain any emoji`);
});

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
