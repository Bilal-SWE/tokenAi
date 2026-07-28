#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.tokenai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configurations
const DEFAULT_SERVER_URL = 'http://localhost:3001';

// Ignored files and folders list
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'out', '.gemini', '.agents',
  'bin', 'obj', 'temp', 'tmp', 'venv', '.venv', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'
]);
const IGNORED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.mp4', '.mp3', '.wav', '.zip', '.gz', '.tar', '.pdf',
  '.dmg', '.exe', '.dll', '.so', '.dylib', '.map'
]);

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.warn('Failed to parse config file, using defaults.');
    }
  }
  return { serverUrl: DEFAULT_SERVER_URL, token: '' };
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function promptInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function handleLogin() {
  console.log('=== TokenAI CLI Login ===');
  const email = await promptInput('Email: ');
  const password = await promptInput('Password: ');

  if (!email || !password) {
    console.error('Email and password are required.');
    process.exit(1);
  }

  const config = loadConfig();
  const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

  console.log(`Connecting to server at ${serverUrl}...`);
  try {
    const response = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Auth failed' }));
      console.error(`Login failed: ${err.error}`);
      process.exit(1);
    }

    const data = await response.json();
    config.token = data.token;
    saveConfig(config);
    console.log('Login successful! Credentials saved.');
  } catch (error) {
    console.error('Error connecting to TokenAI API:', error.message);
    process.exit(1);
  }
}

function scanFiles(dir, allFiles = []) {
  const list = fs.readdirSync(dir);
  for (const name of list) {
    const fullPath = path.join(dir, name);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (IGNORED_DIRS.has(name)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanFiles(fullPath, allFiles);
    } else if (stat.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (IGNORED_EXTS.has(ext)) continue;
      // Skip files > 500KB
      if (stat.size > 500 * 1024) continue;
      allFiles.push(relPath);
    }
  }
  return allFiles;
}

function getRelevantFiles(promptText, filePaths) {
  const relevantFiles = [];
  const lowercasePrompt = promptText.toLowerCase();

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath).toLowerCase();
    // Check if the prompt mentions the full relative path or just the file name
    if (lowercasePrompt.includes(filePath.toLowerCase()) || lowercasePrompt.includes(fileName)) {
      try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        relevantFiles.push({ path: filePath, content });
      } catch (e) {
        // Skip unreadable files
      }
    }
  }
  return relevantFiles;
}

async function handlePrompt(promptText, specificFiles = []) {
  const config = loadConfig();
  if (!config.token) {
    console.error('Not logged in. Please run "tokenai login" first.');
    process.exit(1);
  }

  const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

  console.log('Scanning project files...');
  const filePaths = scanFiles(process.cwd());

  let files = [];
  if (specificFiles.length > 0) {
    for (const f of specificFiles) {
      if (fs.existsSync(f)) {
        files.push({
          path: f,
          content: fs.readFileSync(f, 'utf8')
        });
      } else {
        console.warn(`File context not found: ${f}`);
      }
    }
  } else {
    // Automatically match files mentioned in the prompt
    files = getRelevantFiles(promptText, filePaths);
  }

  if (files.length > 15) {
    console.warn(`Warning: Found ${files.length} relevant files. Limiting active file content to the first 15 files.`);
    files = files.slice(0, 15);
  }

  console.log(`Workspace directory structure contains ${filePaths.length} files.`);
  console.log(`Sending prompt with context of ${files.length} matched file contents to save tokens...`);

  try {
    const response = await fetch(`${serverUrl}/api/coder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify({
        prompt: promptText,
        files: files,
        filePaths: filePaths
      })
    });

    if (!response.ok) {
      if (response.status === 402) {
        console.error('Insufficient credits. Please recharge your wallet.');
      } else {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        console.error(`Request failed: ${err.error || err.details || 'Unknown error'}`);
      }
      process.exit(1);
    }

    const result = await response.json();
    console.log(`AI Response received (used ${result.tokensUsed} tokens, cost: ${result.cost} credits).`);
    console.log(`New wallet balance: ${result.newBalance} credits.`);

    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let modifiedCount = 0;

    while ((match = fileRegex.exec(result.response)) !== null) {
      const filePath = match[1];
      const fileContent = match[2];
      const absolutePath = path.resolve(process.cwd(), filePath);

      // Ensure directory exists
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

      const exists = fs.existsSync(absolutePath);
      fs.writeFileSync(absolutePath, fileContent, 'utf8');

      if (exists) {
        console.log(`[UPDATE] ${filePath}`);
      } else {
        console.log(`[CREATE] ${filePath}`);
      }
      modifiedCount++;
    }

    if (modifiedCount === 0) {
      console.log('No file modifications were returned by the AI.');
      // Print explanations if no files modified
      console.log('\nAI Explanation:');
      console.log(result.response);
    } else {
      console.log(`\nSuccessfully applied ${modifiedCount} file changes.`);
    }

  } catch (error) {
    console.error('Error connecting to backend API:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage:');
    console.log('  tokenai login               - Authenticate with your TokenAI account');
    console.log('  tokenai "prompt"            - Ask AI to code or modify files');
    console.log('  tokenai "prompt" --file f.js - Focus context on specific file(s)');
    process.exit(0);
  }

  if (command === 'login') {
    await handleLogin();
  } else {
    // Treat everything as prompt
    let promptText = command;
    let specificFiles = [];

    // Parse options (simple)
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--file' || args[i] === '-f') {
        const file = args[i + 1];
        if (file) {
          specificFiles.push(file);
          i++;
        }
      }
    }

    await handlePrompt(promptText, specificFiles);
  }
}

main();
