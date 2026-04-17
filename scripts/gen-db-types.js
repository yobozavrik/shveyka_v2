const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'packages', 'shared', 'src', 'types', 'database.ts');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  return vars;
}

function readVarFromEnvFiles(varName) {
  const candidates = [
    path.join(ROOT, '.env.local'),
    path.join(ROOT, '.env'),
    path.join(ROOT, 'crm', '.env.local'),
    path.join(ROOT, 'crm', '.env'),
    path.join(ROOT, 'worker-app', '.env.local'),
    path.join(ROOT, 'worker-app', '.env'),
  ];

  for (const file of candidates) {
    const envVars = parseEnvFile(file);
    if (envVars[varName]) return envVars[varName];
  }

  return '';
}

function runSupabase(args) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const out = fs.createWriteStream(OUTPUT, { flags: 'w' });

  return new Promise((resolve, reject) => {
    const child = spawn('supabase', args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: false,
    });

    child.stdout.pipe(out);

    child.on('error', (error) => {
      out.end();
      reject(error);
    });

    child.on('close', (code) => {
      out.end();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`supabase exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'url';

  if (mode === 'local') {
    await runSupabase(['gen', 'types', 'typescript', '--local']);
    console.log(`Generated DB types to: ${OUTPUT}`);
    return;
  }

  if (mode === 'remote') {
    const projectId = process.env.SUPABASE_PROJECT_ID || readVarFromEnvFiles('SUPABASE_PROJECT_ID');
    if (!projectId) {
      console.error('SUPABASE_PROJECT_ID is not set (env or .env files).');
      process.exit(1);
    }
    await runSupabase(['gen', 'types', 'typescript', '--project-id', projectId]);
    console.log(`Generated DB types to: ${OUTPUT}`);
    return;
  }

  const dbUrl = process.env.DATABASE_URL || readVarFromEnvFiles('DATABASE_URL');
  if (!dbUrl) {
    console.error('DATABASE_URL is not set (env or .env files).');
    process.exit(1);
  }

  await runSupabase(['gen', 'types', 'typescript', '--db-url', dbUrl]);
  console.log(`Generated DB types to: ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
