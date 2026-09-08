import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFourGroupsCollection} from './content-integrity.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const sourcePath=path.join(root,'content','source','groups.json');

const boards=JSON.parse(await fs.readFile(sourcePath,'utf8'));
const result=validateFourGroupsCollection(boards);
assert.ok(result.valid,`Four Groups content integrity failed:\n- ${result.issues.join('\n- ')}`);
console.log(`Four Groups: ${boards.length} boards validated; every board has 4 groups, 16 unique tiles, unique group names, and no exact repeated groups/boards.`);
