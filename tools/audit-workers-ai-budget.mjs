import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  WORKERS_AI_MODEL,
  FREE_DAILY_NEURONS,
  CLUE_AI_DAILY_NEURON_CAP,
  CLUE_AI_FREE_HEADROOM,
  DAILY_AI_PLAN,
  estimateNeurons,
  reserveNeurons
} from '../src/content-ai.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');

assert.equal(FREE_DAILY_NEURONS,10000,'Cloudflare free Workers AI allocation changed in code; review current pricing before raising this value.');
assert.ok(CLUE_AI_DAILY_NEURON_CAP>0&&CLUE_AI_DAILY_NEURON_CAP<FREE_DAILY_NEURONS,'Clue Morning must stay below the free daily allocation with explicit headroom.');
assert.ok(CLUE_AI_FREE_HEADROOM>=5000,'Keep substantial account-wide headroom so other Workers AI usage cannot accidentally push the account into paid neurons.');
assert.equal(DAILY_AI_PLAN['four-groups'].target,1,'Four Groups batch should stay intentionally small.');
assert.equal(DAILY_AI_PLAN['deep-cut'].target,1,'Deep Cut batch should stay intentionally small.');
assert.ok(DAILY_AI_PLAN['four-groups'].maxAttempts<=2&&DAILY_AI_PLAN['deep-cut'].maxAttempts<=2,'Do not burn the free allocation retrying weak candidates.');
assert.equal(WORKERS_AI_MODEL,'@cf/zai-org/glm-4.7-flash','Use a Cloudflare-hosted model available on the Workers Free plan.');
assert.ok(estimateNeurons(1000,1000)>0);
assert.ok(reserveNeurons([{role:'user',content:'test'}],500)>0);

const wrangler=JSON.parse((await fs.readFile(path.join(root,'wrangler.jsonc'),'utf8')).replace(/^\uFEFF/,''));
assert.equal(wrangler?.ai?.binding,'AI','wrangler.jsonc must expose the Workers AI binding as env.AI.');
const worker=await fs.readFile(path.join(root,'src','worker-v5.js'),'utf8');
assert.match(worker,/runContentAiSchedule/,'The production Worker must invoke the budgeted AI scheduler.');
const schema=await fs.readFile(path.join(root,'schema.sql'),'utf8');
for(const table of ['ai_neuron_usage','ai_content_runs','ai_content_candidates'])assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`),`schema.sql is missing ${table}.`);

console.log(`Workers AI budget: ${CLUE_AI_DAILY_NEURON_CAP}/${FREE_DAILY_NEURONS} neurons max per UTC day, ${CLUE_AI_FREE_HEADROOM} free neurons reserved as headroom; batch target is one Four Groups + one Deep Cut candidate.`);
