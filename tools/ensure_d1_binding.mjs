import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'wrangler.jsonc');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const dbName = 'clue-morning-leaderboard';

function readConfig(){
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}
function writeConfig(config){
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
function hasBinding(config){
  return Array.isArray(config.d1_databases) && config.d1_databases.some(d => d?.binding === 'DB' && d?.database_id);
}
function run(args, capture=false){
  return execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: capture ? 'utf8' : undefined, stdio: capture ? ['ignore','pipe','pipe'] : 'inherit' });
}

let config = readConfig();
if(hasBinding(config)){
  console.log('Leaderboard D1 binding already present.');
  process.exit(0);
}

console.log('Looking for an existing Clue Morning leaderboard database...');
let rows=[];
try{
  const raw = run(['d1','list','--json'], true);
  rows = JSON.parse(raw);
}catch(err){
  console.error('Could not list D1 databases. Make sure Cloudflare login succeeded.');
  process.exit(1);
}
const existing = Array.isArray(rows) ? rows.find(x => x?.name === dbName) : null;
if(existing){
  const id = existing.uuid || existing.id || existing.database_id;
  if(!id){
    console.error('Found the leaderboard database but could not read its database ID.');
    process.exit(1);
  }
  config = readConfig();
  const others = Array.isArray(config.d1_databases) ? config.d1_databases.filter(d => d?.binding !== 'DB') : [];
  config.d1_databases = [...others, { binding:'DB', database_name:dbName, database_id:id }];
  writeConfig(config);
  console.log(`Bound existing D1 database: ${dbName}`);
  process.exit(0);
}

console.log('No existing leaderboard database found. Creating one...');
try{
  run(['d1','create',dbName,'--location=wnam','--binding=DB','--update-config']);
}catch(err){
  console.error('Failed to create the leaderboard D1 database.');
  process.exit(1);
}
config = readConfig();
if(!hasBinding(config)){
  console.error('D1 was created but the DB binding was not written to wrangler.jsonc.');
  process.exit(1);
}
console.log('Leaderboard D1 database created and bound.');
