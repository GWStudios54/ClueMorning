import assert from 'node:assert/strict';
import {TRAIL_PUZZLES} from '../src/puzzles.js';
import {isObviousTrailLayout} from './trail-layout.mjs';

assert.ok(TRAIL_PUZZLES.length>=365,`Need at least 365 Trail boards; found ${TRAIL_PUZZLES.length}`);
for(const puzzle of TRAIL_PUZZLES){
  assert.equal(puzzle.grid.length,16,`${puzzle.longest} should use a 4x4 grid`);
  assert.ok(puzzle.words.includes(puzzle.longest),`${puzzle.longest} must remain solvable`);
  assert.ok(puzzle.words.length>=20,`${puzzle.longest} has only ${puzzle.words.length} valid words`);
  assert.equal(isObviousTrailLayout(puzzle.grid,puzzle.longest),false,`${puzzle.longest} is exposed as a row/column snake`);
}
console.log(`Trail layout audit: ${TRAIL_PUZZLES.length} boards retain 20+ words and no 16-letter answer is exposed as a row/column snake.`);
