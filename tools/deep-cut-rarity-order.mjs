const key=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');

// Deep Cut scores use answer-array position as the rarity prior. These overrides
// keep systematic source lists (chronological, anatomical, hardness order, etc.)
// from accidentally turning their source order into a claim about obscurity.
const RARITY_ORDER={
  quality_twelve_caesars:[
    'Julius Caesar','Augustus','Nero','Caligula','Claudius','Tiberius',
    'Vespasian','Titus','Domitian','Galba','Otho','Vitellius'
  ],
  quality_japan_prefectures:[
    'Tokyo','Osaka','Kyoto','Hiroshima','Hokkaido','Okinawa','Fukushima','Nagasaki',
    'Kanagawa','Fukuoka','Aichi','Chiba','Saitama','Hyogo','Shizuoka','Nagano',
    'Miyagi','Nara','Kumamoto','Kagoshima','Niigata','Ibaraki','Okayama','Yamaguchi',
    'Gunma','Tochigi','Gifu','Mie','Shiga','Wakayama','Ehime','Kagawa','Tokushima',
    'Kochi','Oita','Miyazaki','Yamagata','Akita','Iwate','Aomori','Toyama','Ishikawa',
    'Fukui','Yamanashi','Saga','Tottori','Shimane'
  ],
  quality_cranial_nerves:[
    'Vagus','Optic','Olfactory','Trigeminal','Facial','Vestibulocochlear','Oculomotor',
    'Hypoglossal','Glossopharyngeal','Accessory','Abducens','Trochlear'
  ],
  quality_mohs_minerals:[
    'Diamond','Quartz','Talc','Gypsum','Topaz','Calcite','Fluorite','Corundum','Apatite','Orthoclase'
  ],
  quality_cloud_genera:[
    'Cumulus','Stratus','Cumulonimbus','Cirrus','Stratocumulus','Altocumulus',
    'Nimbostratus','Altostratus','Cirrostratus','Cirrocumulus'
  ],
  quality_phanerozoic_periods:[
    'Jurassic','Cretaceous','Triassic','Cambrian','Quaternary','Devonian','Permian',
    'Carboniferous','Ordovician','Silurian','Paleogene','Neogene'
  ],
  quality_si_prefixes:[
    'kilo','mega','milli','micro','giga','nano','centi','tera','deci','pico','hecto','deca',
    'femto','peta','atto','exa','zepto','zetta','yocto','yotta','ronto','ronna','quecto','quetta'
  ]
};

export function applyDeepCutRarityOrder(prompts){
  for(const prompt of prompts){
    const order=RARITY_ORDER[prompt?.id];
    if(!order||!Array.isArray(prompt.answers))continue;
    const ranks=new Map(order.map((name,index)=>[key(name),index]));
    prompt.answers=prompt.answers
      .map((answer,index)=>({answer,index,rank:ranks.get(key(answer.name))??(order.length+index)}))
      .sort((a,b)=>a.rank-b.rank||a.index-b.index)
      .map(row=>row.answer);
  }
  return prompts;
}
