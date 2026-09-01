// Curated Unlimited Deep Cut catalog. Answer order is common -> deep cut.
const RAW=[
["film","film_nolan","Name a feature film directed by Christopher Nolan.","The Dark Knight|Inception|Interstellar|Oppenheimer|The Odyssey|Batman Begins|The Prestige|Dunkirk|Tenet|The Dark Knight Rises|Memento|Insomnia|Following"],
["film","film_kubrick","Name a feature film directed by Stanley Kubrick.","The Shining|2001: A Space Odyssey|A Clockwork Orange|Full Metal Jacket|Dr. Strangelove|Spartacus|Eyes Wide Shut|Barry Lyndon|Lolita|Paths of Glory|The Killing|Killer's Kiss|Fear and Desire"],
["film","film_miyazaki","Name a feature film directed by Hayao Miyazaki.","Spirited Away|My Neighbor Totoro|Princess Mononoke|Howl's Moving Castle|Kiki's Delivery Service|Ponyo|The Boy and the Heron|Nausicaä of the Valley of the Wind|Castle in the Sky|The Wind Rises|Porco Rosso|The Castle of Cagliostro"],
["film","film_pixar_1995_2010","Name a Pixar feature film released from 1995 through 2010.","Toy Story|Finding Nemo|The Incredibles|Monsters, Inc.|Cars|Up|WALL-E|Ratatouille|Toy Story 2|Toy Story 3|A Bug's Life"],
["television","tv_friends_six","Name one of the six central friends on Friends.","Rachel Green|Ross Geller|Monica Geller|Chandler Bing|Joey Tribbiani|Phoebe Buffay"],
["television","tv_seinfeld_four","Name one of the four central characters on Seinfeld.","Jerry Seinfeld|George Costanza|Elaine Benes|Cosmo Kramer"],
["television","tv_star_trek_1966_2001_live","Name a live-action Star Trek series that premiered from 1966 through 2001.","Star Trek~The Original Series~TOS|Star Trek: The Next Generation~The Next Generation~TNG|Star Trek: Deep Space Nine~Deep Space Nine~DS9|Star Trek: Voyager~Voyager|Star Trek: Enterprise~Enterprise"],
["television","tv_golden_girls","Name one of the four main Golden Girls.","Dorothy Zbornak|Rose Nylund|Blanche Devereaux|Sophia Petrillo"],
["music","music_beatles_members","Name a member of the Beatles.","John Lennon|Paul McCartney|George Harrison|Ringo Starr"],
["music","music_beatles_uk_studio","Name a Beatles studio album released in the UK during the band's original run.","Abbey Road|Sgt. Pepper's Lonely Hearts Club Band|The Beatles|Revolver|Rubber Soul|Let It Be|Help!|A Hard Day's Night|Please Please Me|With the Beatles|Beatles for Sale|Yellow Submarine"],
["music","music_metallica_studio","Name a Metallica studio album.","Master of Puppets|Metallica|Ride the Lightning|...And Justice for All|Kill 'Em All|Reload|Load|Death Magnetic|Hardwired... to Self-Destruct|72 Seasons|St. Anger"],
["music","music_pink_floyd_studio","Name a Pink Floyd studio album.","The Dark Side of the Moon|The Wall|Wish You Were Here|Animals|Meddle|The Piper at the Gates of Dawn|A Momentary Lapse of Reason|The Division Bell|Atom Heart Mother|Obscured by Clouds|A Saucerful of Secrets|More|Ummagumma|The Final Cut|The Endless River"],
["video_games","games_elder_scrolls_main","Name a main-series Elder Scrolls game.","The Elder Scrolls V: Skyrim|The Elder Scrolls IV: Oblivion|The Elder Scrolls III: Morrowind|The Elder Scrolls II: Daggerfall|The Elder Scrolls: Arena"],
["video_games","games_playstation_home","Name a numbered PlayStation home console.","PlayStation 2~PS2|PlayStation 4~PS4|PlayStation 5~PS5|PlayStation 3~PS3|PlayStation~PS1~PlayStation 1"],
["video_games","games_nintendo_home_consoles","Name a Nintendo home console from the NES through Switch 2.","Nintendo Switch~Switch|Wii|Nintendo 64~N64|Super Nintendo Entertainment System~SNES~Super Nintendo|Nintendo Entertainment System~NES|GameCube~Nintendo GameCube|Wii U|Nintendo Switch 2~Switch 2"],
["video_games","games_super_mario_kart_roster","Name a playable racer from the original Super Mario Kart.","Mario|Luigi|Princess Peach|Yoshi|Bowser|Toad|Koopa Troopa|Donkey Kong Jr."],
["literature","lit_austen_novels","Name one of Jane Austen's six completed novels.","Pride and Prejudice|Sense and Sensibility|Emma|Persuasion|Mansfield Park|Northanger Abbey"],
["literature","lit_harry_potter_books","Name a novel in the original seven-book Harry Potter series.","Harry Potter and the Sorcerer's Stone~Harry Potter and the Philosopher's Stone~Sorcerer's Stone~Philosopher's Stone|Harry Potter and the Chamber of Secrets|Harry Potter and the Prisoner of Azkaban|Harry Potter and the Goblet of Fire|Harry Potter and the Order of the Phoenix|Harry Potter and the Half-Blood Prince|Harry Potter and the Deathly Hallows"],
["literature","lit_narnia_books","Name a book in The Chronicles of Narnia.","The Lion, the Witch and the Wardrobe|Prince Caspian|The Voyage of the Dawn Treader|The Silver Chair|The Horse and His Boy|The Magician's Nephew|The Last Battle"],
["literature","lit_sherlock_novels","Name one of Arthur Conan Doyle's four Sherlock Holmes novels.","A Study in Scarlet|The Hound of the Baskervilles|The Sign of the Four|The Valley of Fear"],
["sports","sports_tennis_grand_slams","Name one of tennis's four Grand Slam tournaments.","Wimbledon|US Open|Australian Open|French Open"],
["sports","sports_golf_majors","Name one of the four men's major golf championships.","The Masters|U.S. Open|The Open Championship|PGA Championship"],
["sports","sports_nhl_original_six","Name one of the NHL's Original Six teams.","Montreal Canadiens|Toronto Maple Leafs|Boston Bruins|New York Rangers|Detroit Red Wings|Chicago Blackhawks"],
["sports","sports_baseball_positions","Name one of baseball's nine standard fielding positions.","Pitcher|Catcher|First Base|Second Base|Third Base|Shortstop|Left Field|Center Field|Right Field"],
["history","history_ancient_wonders","Name one of the Seven Wonders of the Ancient World.","Great Pyramid of Giza|Hanging Gardens of Babylon|Statue of Zeus at Olympia|Temple of Artemis at Ephesus|Mausoleum at Halicarnassus|Colossus of Rhodes|Lighthouse of Alexandria"],
["history","history_henry_viii_wives","Name one of Henry VIII's six wives.","Catherine of Aragon|Anne Boleyn|Jane Seymour|Anne of Cleves|Catherine Howard|Catherine Parr"],
["history","history_five_good_emperors","Name one of Rome's Five Good Emperors.","Marcus Aurelius|Hadrian|Trajan|Nerva|Antoninus Pius"],
["history","history_original_13_colonies","Name one of the original Thirteen Colonies.","Virginia|Massachusetts|New York|Pennsylvania|Maryland|Georgia|North Carolina|South Carolina|New Jersey|Connecticut|Rhode Island|Delaware|New Hampshire"],
["geography","geo_great_lakes","Name one of the Great Lakes.","Lake Michigan|Lake Superior|Lake Erie|Lake Ontario|Lake Huron"],
["geography","geo_continents","Name a continent in the seven-continent model.","North America|South America|Europe|Asia|Africa|Australia|Antarctica"],
["geography","geo_oceans","Name one of Earth's five oceans.","Pacific Ocean|Atlantic Ocean|Indian Ocean|Arctic Ocean|Southern Ocean"],
["geography","geo_south_america","Name a sovereign country in South America.","Brazil|Argentina|Colombia|Chile|Peru|Venezuela|Ecuador|Bolivia|Paraguay|Uruguay|Guyana|Suriname"],
["science","science_si_base_units","Name one of the seven SI base units.","Meter|Kilogram|Second|Ampere|Kelvin|Mole|Candela"],
["science","science_noble_gases","Name a noble gas element.","Helium|Neon|Argon|Krypton|Xenon|Radon|Oganesson"],
["science","science_quark_flavors","Name one of the six quark flavors.","Up|Down|Strange|Charm|Top|Bottom"],
["science","science_em_spectrum","Name a major region of the electromagnetic spectrum.","Visible light|Radio waves|Microwaves|Infrared|Ultraviolet|X-rays|Gamma rays"],
["space","space_planets","Name a planet in the Solar System.","Earth|Mars|Jupiter|Saturn|Venus|Mercury|Neptune|Uranus"],
["space","space_dwarf_planets","Name one of the five dwarf planets officially recognized by the IAU.","Pluto|Ceres|Eris|Makemake|Haumea"],
["space","space_moonwalkers","Name an astronaut who walked on the Moon.","Neil Armstrong|Buzz Aldrin|Alan Shepard|David Scott|John Young|Charles Duke|Gene Cernan|Harrison Schmitt|Pete Conrad|Alan Bean|Edgar Mitchell|James Irwin"],
["space","space_mercury_seven","Name one of NASA's original Mercury Seven astronauts.","John Glenn|Alan Shepard|Gus Grissom|Scott Carpenter|Wally Schirra|Gordon Cooper|Deke Slayton"],
["animals","animals_panthera","Name an extant species in the genus Panthera.","Lion|Tiger|Leopard|Jaguar|Snow leopard"],
["animals","animals_bears","Name one of the eight living bear species.","Brown bear|Polar bear|American black bear|Asian black bear|Giant panda|Sun bear|Sloth bear|Spectacled bear"],
["animals","animals_rhinos","Name one of the five living rhinoceros species.","White rhinoceros|Black rhinoceros|Indian rhinoceros|Javan rhinoceros|Sumatran rhinoceros"],
["animals","animals_camelids","Name a living species in the camelid family.","Dromedary|Bactrian camel|Llama|Alpaca|Vicuña|Guanaco|Wild Bactrian camel"],
["food","food_mother_sauces","Name one of the five French mother sauces.","Béchamel|Velouté|Espagnole|Tomato sauce|Hollandaise"],
["food","food_basic_tastes","Name one of the five basic tastes.","Sweet|Salty|Sour|Bitter|Umami"],
["food","food_mms_colors","Name a standard color of a regular M&M in the U.S.","Blue|Red|Green|Yellow|Orange|Brown"],
["food","food_roman_pastas","Name one of Rome's four classic pasta dishes.","Cacio e pepe|Carbonara|Pasta alla gricia|Amatriciana"],
["technology","tech_osi_layers","Name one of the seven layers of the OSI model.","Physical|Data Link|Network|Transport|Session|Presentation|Application"],
["technology","tech_http_methods_9110","Name an HTTP method defined by RFC 9110.","GET|HEAD|POST|PUT|DELETE|CONNECT|OPTIONS|TRACE"],
["technology","tech_git_objects","Name one of Git's four object types.","Blob|Tree|Commit|Tag"],
["technology","tech_acid","Name one of the four ACID properties of database transactions.","Atomicity|Consistency|Isolation|Durability"],
["mythology","myth_cronus_rhea_children","Name a child of Cronus and Rhea in Greek mythology.","Zeus|Hera|Poseidon|Hades|Demeter|Hestia"],
["mythology","myth_nine_muses","Name one of the nine Muses in Greek mythology.","Calliope|Clio|Erato|Euterpe|Melpomene|Polyhymnia|Terpsichore|Thalia|Urania"],
["mythology","myth_norse_worlds","Name one of the Nine Worlds in Norse mythology.","Asgard|Midgard|Jotunheim|Niflheim|Muspelheim|Vanaheim|Alfheim|Svartalfheim|Helheim"],
["mythology","myth_heliopolitan_ennead","Name a deity in the Great Ennead of Heliopolis.","Osiris|Isis|Set|Nephthys|Atum|Shu|Tefnut|Geb|Nut"],
["arts","arts_ballet_positions","Name one of the five basic ballet positions of the feet.","First position|Second position|Third position|Fourth position|Fifth position"],
["arts","arts_oscar_acting_categories","Name one of the four acting categories at the Academy Awards.","Best Actor|Best Actress|Best Supporting Actor|Best Supporting Actress"],
["arts","arts_orchestral_strings","Name a core instrument of the orchestral string section.","Violin|Viola|Cello|Double bass"],
["arts","arts_cmyk","Name one of the four process colors in CMYK printing.","Cyan|Magenta|Yellow|Black"],
["cars","cars_corvette_generations","Name a Chevrolet Corvette generation code.","C8|C7|C6|C5|C4|C3|C2|C1"],
["cars","cars_911_generations","Name a major Porsche 911 generation code.","992~911 992|991~911 991|997~911 997|996~911 996|993~911 993|964~911 964|930~911 930|901~911 Classic~Original 911"],
["cars","cars_lambo_v12_flagships","Name a Lamborghini V12 flagship model in the Miura-to-Revuelto lineage.","Countach|Aventador|Diablo|Murciélago|Miura|Revuelto"],
["cars","cars_civic_type_r_chassis","Name a Honda Civic Type R chassis code.","EK9|EP3|FK8|FL5|FN2|FD2|FK2"],
["language","lang_greek_alphabet","Name a letter of the Greek alphabet.","Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega"],
["language","lang_nato_alphabet","Name a code word in the NATO phonetic alphabet.","Alfa|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliett|Kilo|Lima|Mike|November|Oscar|Papa|Quebec|Romeo|Sierra|Tango|Uniform|Victor|Whiskey|X-ray|Yankee|Zulu"],
["language","lang_un_languages","Name one of the six official languages of the United Nations.","English|Spanish|French|Arabic|Chinese|Russian"],
["language","lang_german_cases","Name one of the four grammatical cases in German.","Nominative|Accusative|Dative|Genitive"],
["military","mil_us_branches","Name a branch of the U.S. Armed Forces.","Army|Navy|Marine Corps|Air Force|Space Force|Coast Guard"],
["military","mil_us_service_academies","Name one of the five U.S. federal service academies.","United States Military Academy|United States Naval Academy|United States Air Force Academy|United States Coast Guard Academy|United States Merchant Marine Academy"],
["military","mil_navy_officer_ranks","Name a commissioned officer rank in the U.S. Navy.","Ensign|Lieutenant Junior Grade|Lieutenant|Lieutenant Commander|Commander|Captain|Rear Admiral Lower Half|Rear Admiral|Vice Admiral|Admiral|Fleet Admiral"],
["military","mil_marine_enlisted_ranks","Name an enlisted rank in the U.S. Marine Corps.","Private|Private First Class|Lance Corporal|Corporal|Sergeant|Staff Sergeant|Gunnery Sergeant|Master Sergeant|First Sergeant|Master Gunnery Sergeant|Sergeant Major"],
["nature","nature_cloud_genera","Name one of the ten main cloud genera.","Cumulus|Cumulonimbus|Cirrus|Stratus|Stratocumulus|Altocumulus|Altostratus|Cirrostratus|Cirrocumulus|Nimbostratus"],
["nature","nature_mohs_minerals","Name a reference mineral on the Mohs hardness scale.","Diamond|Quartz|Topaz|Corundum|Apatite|Fluorite|Calcite|Gypsum|Talc|Orthoclase"],
["nature","nature_beaufort_terms","Name a standard descriptive term on the Beaufort wind force scale.","Calm|Light air|Light breeze|Gentle breeze|Moderate breeze|Fresh breeze|Strong breeze|Near gale~High wind|Gale|Strong gale|Storm|Violent storm|Hurricane"],
["nature","nature_usda_soil_orders","Name one of the twelve USDA soil orders.","Alfisols|Andisols|Aridisols|Entisols|Gelisols|Histosols|Inceptisols|Mollisols|Oxisols|Spodosols|Ultisols|Vertisols"],
["comics","comics_fantastic_four","Name a core member of the Fantastic Four.","Mister Fantastic~Reed Richards~Mr Fantastic|Invisible Woman~Sue Storm~Susan Storm|Human Torch~Johnny Storm|The Thing~Ben Grimm"],
["comics","comics_tmnt","Name one of the four Teenage Mutant Ninja Turtles.","Leonardo|Michelangelo|Donatello|Raphael"],
["comics","comics_original_xmen","Name one of the five original X-Men.","Cyclops~Scott Summers|Marvel Girl~Jean Grey|Beast~Hank McCoy|Angel~Warren Worthington III|Iceman~Bobby Drake"],
["comics","comics_infinity_stones","Name one of the six Infinity Stones.","Space Stone|Mind Stone|Reality Stone|Power Stone|Time Stone|Soul Stone"],
["board_games","board_monopoly_railroads","Name a railroad on the classic U.S. Monopoly board.","Reading Railroad|Pennsylvania Railroad|B. & O. Railroad|Short Line"],
["board_games","board_clue_suspects","Name one of the six classic suspects in Clue.","Miss Scarlet|Colonel Mustard|Mrs. White|Mr. Green|Mrs. Peacock|Professor Plum"],
["board_games","board_chess_piece_types","Name one of the six types of chess piece.","King|Queen|Rook|Bishop|Knight|Pawn"],
["board_games","board_catan_resources","Name a resource produced by terrain in base Catan.","Brick|Lumber|Wool|Grain|Ore"]
];

const CATALOG=RAW.map(([domain,id,prompt,packed])=>({domain,id,prompt,answers:packed.split("|").map(part=>{const [name,...aliases]=part.split("~");return aliases.length?{name,aliases}:{name}})}));
function normalize(v){return String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,rnd){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const BY_DOMAIN=new Map();for(const p of CATALOG){if(!BY_DOMAIN.has(p.domain))BY_DOMAIN.set(p.domain,[]);BY_DOMAIN.get(p.domain).push(p)}const DOMAINS=[...BY_DOMAIN.keys()].sort();

export function deepCutUnlimitedSession(slot,rounds=8){
  const n=Math.max(0,Math.floor(Number(slot)||0)),rnd=mulberry32(hashString(`deepcut-unlimited-v2::${n}`));
  const domains=shuffle(DOMAINS,rnd).slice(0,Math.min(rounds,DOMAINS.length));
  return domains.map(domain=>{const pool=BY_DOMAIN.get(domain),offset=hashString(`deepcut-domain::${domain}`)%pool.length;return pool[(n+offset)%pool.length]});
}

export function auditDeepCutUnlimitedCatalog(){
  const errors=[],ids=new Set(),domainCounts={},banned=/\b(beginning with|ending with|containing the letter|with \d+ letters?)\b/i;
  for(const p of CATALOG){
    domainCounts[p.domain]=(domainCounts[p.domain]||0)+1;
    if(!p.id||ids.has(p.id))errors.push(`Duplicate/missing id: ${p.id||"(blank)"}`);ids.add(p.id);
    if(!p.domain)errors.push(`Missing domain: ${p.id}`);
    if(!p.prompt||banned.test(p.prompt))errors.push(`Mechanical prompt: ${p.id}`);
    if(!Array.isArray(p.answers)||p.answers.length<4)errors.push(`Too few answers: ${p.id}`);
    const variants=new Set();
    for(const a of p.answers||[])for(const v of [a.name,...(a.aliases||[])]){const key=normalize(v);if(!key)errors.push(`Blank answer: ${p.id}`);if(variants.has(key))errors.push(`Duplicate answer/alias in ${p.id}: ${v}`);variants.add(key)}
  }
  if(DOMAINS.length<16)errors.push(`Only ${DOMAINS.length} domains`);
  if(CATALOG.length<80)errors.push(`Only ${CATALOG.length} prompts`);
  for(let slot=0;slot<5000;slot++){
    const set=deepCutUnlimitedSession(slot,8);
    if(set.length!==8)errors.push(`Slot ${slot} has ${set.length} rounds`);
    if(new Set(set.map(p=>p.domain)).size!==set.length)errors.push(`Slot ${slot} repeats a domain`);
    if(new Set(set.map(p=>p.id)).size!==set.length)errors.push(`Slot ${slot} repeats a prompt`);
  }
  return {ok:errors.length===0,errors,prompts:CATALOG.length,domains:DOMAINS.length,domainCounts};
}

export const UNLIMITED_DEEP_CUT_PROMPTS=CATALOG;
export const UNLIMITED_DEEP_CUT_DOMAINS=DOMAINS;
