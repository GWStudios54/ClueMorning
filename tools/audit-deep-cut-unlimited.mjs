import { auditDeepCutUnlimitedCatalog, deepCutUnlimitedSession } from "../src/deep_cut_unlimited.js";

const audit=auditDeepCutUnlimitedCatalog();
if(!audit.ok){
  console.error("Unlimited Deep Cut audit failed:");
  for(const error of audit.errors)console.error(`- ${error}`);
  process.exit(1);
}

const usage={};
for(let slot=0;slot<5000;slot++)for(const p of deepCutUnlimitedSession(slot,8))usage[p.domain]=(usage[p.domain]||0)+1;
const counts=Object.values(usage);
console.log(`Unlimited Deep Cut: ${audit.prompts} curated prompts across ${audit.domains} domains.`);
console.log(`Simulated 5,000 games / 40,000 rounds. Domain usage range: ${Math.min(...counts)}-${Math.max(...counts)}.`);
console.log(audit.domainCounts);
