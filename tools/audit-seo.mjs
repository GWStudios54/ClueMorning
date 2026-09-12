import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const sitemap=read('public/sitemap.xml');
const robots=read('public/robots.txt');
const worker=read('src/worker-v4.js');
const router=read('src/worker-v5.js');
const wrangler=read('wrangler.jsonc');
const games=read('public/games/index.html');
const lastCall=read('public/games/last-call/index.html');
const about=read('public/about/index.html');
const deepLink=read('public/deep-link.js');
const sw=read('public/sw.js');

const routes=[
  '/', '/about/', '/games/', '/games/letter-grid/', '/games/four-groups/', '/games/letter-trail/',
  '/games/triple-link/', '/games/word-steps/', '/games/deep-cut/', '/games/last-call/',
  '/games/tileworks/', '/games/pangram/', '/games/all-seven/'
];
const guideRoutes=['/games/letter-grid/','/games/four-groups/','/games/letter-trail/','/games/triple-link/','/games/word-steps/','/games/deep-cut/'];
const bonusRoutes=['/games/tileworks/','/games/pangram/','/games/all-seven/'];

const checks=[
  ['robots advertises sitemap',robots.includes('Sitemap: https://cluemorning.com/sitemap.xml')],
  ['robots allows public crawl',robots.includes('Allow: /')&&robots.includes('Disallow: /api/')],
  ['sitemap excludes retired Lineup',!sitemap.includes('/games/lineup/')],
  ['homepage SEO says seven daily games',worker.includes('7 Free Daily Word, Logic & Trivia Games')&&worker.includes('seven free daily word, logic, trivia, and push-your-luck games')],
  ['homepage has seven-item structured data',worker.includes('numberOfItems:7')&&worker.includes("name:'Last Call'")],
  ['old Lineup route permanently redirects',worker.includes("path==='/games/lineup/'")&&worker.includes("Response.redirect(new URL('/games/deep-cut/',url),301)")],
  ['guide response polish corrects six-game copy',worker.includes("replaceAll('six free daily games','seven free daily games')")&&worker.includes('href="/games/last-call/"')],
  ['legacy play query URLs permanently redirect home',router.includes("url.searchParams.has('play')")&&router.includes('Response.redirect(target.toString(),301)')&&!router.includes("target.hash=`play=${play}`")],
  ['served HTML does not create persistent play fragments',!router.includes("replaceAll('/?play=','/#play=')")],
  ['legacy play fragments return to Today',deepLink.includes("classList.toggle('active',tab.dataset.tab==='today')")&&deepLink.includes("addEventListener('hashchange',returnHome)")],
  ['deep-link cleanup client is injected on homepage',router.includes('/deep-link.js?v=3')],
  ['PWA cache includes deep-link client',sw.includes("'/deep-link.js'" )],
  ['Wrangler uses routing worker v5',wrangler.includes('"main": "src/worker-v5.js"')],
  ['games hub is indexable',games.includes('<meta name="robots" content="index,follow,max-image-preview:large">')&&games.includes('<link rel="canonical" href="https://cluemorning.com/games/">')],
  ['games hub lists all seven daily games',games.includes('The seven daily games')&&games.includes('/games/last-call/')],
  ['Last Call has a dedicated indexable guide',lastCall.includes('<title>Last Call — Free Daily Push-Your-Luck Trivia Game | Clue Morning</title>')&&lastCall.includes('<link rel="canonical" href="https://cluemorning.com/games/last-call/">')],
  ['About page links daily and bonus hubs',about.includes('/games/last-call/')&&about.includes('/games/pangram/')&&about.includes('/games/all-seven/')],
  ['bonus games receive complete server SEO',bonusRoutes.every(route=>worker.includes(`'${route}':{`))]
];
for(const route of routes)checks.push([`sitemap includes ${route}`,sitemap.includes(`<loc>https://cluemorning.com${route}</loc>`)]);
for(const route of [...guideRoutes,...bonusRoutes,'/games/','/games/last-call/','/games/lineup/'])checks.push([`worker-first includes ${route}`,wrangler.includes(`"${route}"`)]);

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`\n${failed.length} SEO audit check(s) failed.`);process.exit(1)}
console.log(`\nSEO audit passed (${checks.length} checks).`);
