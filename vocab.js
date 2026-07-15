const CURATED_VOCAB = [
  {w:'abate',p:'/əˈbeɪt/',zh:'v. 减弱；减轻；平息',en:'to become less strong, severe, or widespread',src:['GRE'],senses:['天气：减弱','疼痛：缓解','情绪：平息'],ex:'The storm began to abate after midnight.',exZh:'午夜过后，暴风雨开始减弱。',syn:['diminish','subside','ease'],note:'a-（离开）+ bate（打）→ 力度退去。通常是不及物动词。',family:'abate v. · abatement n. 减轻、消除',collocations:'abate gradually · noise abatement · the pain abates',gl:[['storm','/stɔːrm/','n. 暴风雨；强烈风波'],['midnight','/ˈmɪdnaɪt/','n. 午夜'],['begin to','/bɪˈɡɪn tuː/','开始做某事']]},
  {w:'ubiquitous',p:'/juːˈbɪkwɪtəs/',zh:'adj. 无处不在的；普遍存在的',en:'seeming to be everywhere or in many places at the same time',src:['GRE','TOEFL'],senses:['事物：随处可见','技术：广泛普及'],ex:'Smartphones have become ubiquitous in modern society.',exZh:'智能手机在现代社会已无处不在。',syn:['omnipresent','pervasive','universal'],note:'来自拉丁语 ubique（everywhere）。不要和 unique（独一无二）混淆。',family:'ubiquity n. 无处不在 · ubiquitously adv.',collocations:'ubiquitous technology · ubiquitous presence · become ubiquitous',gl:[['smartphone','/ˈsmɑːrtfoʊn/','n. 智能手机'],['modern','/ˈmɑːdərn/','adj. 现代的'],['society','/səˈsaɪəti/','n. 社会']]},
  {w:'mitigate',p:'/ˈmɪtɪɡeɪt/',zh:'v. 缓和；减轻（危害或严重程度）',en:'to make something harmful or unpleasant less severe',src:['IELTS','TOEFL','GRE'],senses:['风险：降低','影响：缓解','处罚：从轻'],ex:'Planting trees can mitigate the effects of urban heat.',exZh:'植树可以缓解城市热岛效应。',syn:['alleviate','ease','moderate'],note:'强调减轻而不是彻底消除。反义词 exacerbate。',family:'mitigation n. 缓解 · mitigative adj.',collocations:'mitigate risk · mitigate damage · climate mitigation',gl:[['plant','/plænt/','v. 种植'],['effect','/ɪˈfekt/','n. 影响；效果'],['urban heat','/ˈɜːrbən hiːt/','城市热环境']]},
  {w:'pragmatic',p:'/præɡˈmætɪk/',zh:'adj. 务实的；讲求实际的',en:'dealing with problems in a practical way rather than relying on theory',src:['IELTS','GRE'],senses:['方法：务实的','决策：重实际效果的'],ex:'We need a pragmatic solution rather than an ideal one.',exZh:'我们需要一个务实的方案，而非理想化的方案。',syn:['practical','realistic','sensible'],note:'对比 dogmatic（教条的）和 idealistic（理想主义的）。',family:'pragmatism n. 实用主义 · pragmatically adv.',collocations:'pragmatic approach · pragmatic solution · pragmatic policy',gl:[['solution','/səˈluːʃən/','n. 解决方案'],['rather than','/ˈræðər ðæn/','而不是'],['ideal','/aɪˈdiːəl/','adj. 理想的']]},
  {w:'coherent',p:'/koʊˈhɪrənt/',zh:'adj. 连贯的；条理清楚的；一致的',en:'logical, well organized, and easy to understand',src:['IELTS','TOEFL'],senses:['论述：连贯的','整体：协调一致的','物理：相干的'],ex:'Her argument was clear, coherent, and well supported.',exZh:'她的论点清晰、连贯且论据充分。',syn:['logical','consistent','unified'],note:'co-（共同）+ here（黏合）→ 各部分黏合在一起。物理学中可指“相干的”。',family:'coherence n. 连贯性/相干性 · coherently adv.',collocations:'coherent argument · coherent structure · coherent light',gl:[['argument','/ˈɑːrɡjumənt/','n. 论点；论证'],['support','/səˈpɔːrt/','v. 支持；用证据证明'],['well supported','/wel səˈpɔːrtɪd/','证据充分的']]},
  {w:'ambiguous',p:'/æmˈbɪɡjuəs/',zh:'adj. 模棱两可的；含糊的；有歧义的',en:'open to more than one interpretation; not having one obvious meaning',src:['IELTS','TOEFL','GRE'],senses:['语言：有歧义','态度：含糊不清'],ex:'The wording of the law remains ambiguous.',exZh:'这项法律的措辞仍然含糊不清。',syn:['vague','equivocal','unclear'],note:'ambi-（两边）→ 可以向两边解释。反义 explicit / unambiguous。',family:'ambiguity n. 歧义 · ambiguously adv.',collocations:'ambiguous wording · ambiguous result · remain ambiguous',gl:[['wording','/ˈwɜːrdɪŋ/','n. 措辞；表达方式'],['law','/lɔː/','n. 法律；规律'],['remain','/rɪˈmeɪn/','v. 仍然是；保持']]},
  {w:'resilient',p:'/rɪˈzɪliənt/',zh:'adj. 有韧性的；有弹性的；能迅速恢复的',en:'able to recover quickly after difficulty, disturbance, or deformation',src:['IELTS','TOEFL'],senses:['心理/社会：复原力强的','材料：弹性恢复的','控制系统：抗扰且可恢复的','基础设施：韧性的'],ex:'Children are often remarkably resilient after setbacks.',exZh:'孩子们在遭遇挫折后往往表现出惊人的恢复力。',syn:['robust','adaptable','elastic'],note:'robust 偏重“受扰时仍稳定”，resilient 更强调“受冲击后恢复”。控制领域常译为“韧性/弹性”，指系统维持或恢复性能的能力。',family:'resilience n. 韧性、弹性、复原力 · resiliently adv.',collocations:'resilient control system · resilient infrastructure · cyber resilience · resilient network',gl:[['remarkably','/rɪˈmɑːrkəbli/','adv. 非常；显著地'],['setback','/ˈsetbæk/','n. 挫折；阻碍'],['recover','/rɪˈkʌvər/','v. 恢复；复原']]},
  {w:'exacerbate',p:'/ɪɡˈzæsərbeɪt/',zh:'v. 使恶化；加剧',en:'to make an existing problem, bad situation, or negative feeling worse',src:['GRE','IELTS'],senses:['问题：加剧','病情：恶化','矛盾：激化'],ex:'A shortage of housing may exacerbate social inequality.',exZh:'住房短缺可能加剧社会不平等。',syn:['aggravate','worsen','intensify'],note:'只能用于让负面情况变得更坏。反义 alleviate / mitigate。',family:'exacerbation n. 恶化、加剧',collocations:'exacerbate a problem · exacerbate tensions · acute exacerbation',gl:[['shortage','/ˈʃɔːrtɪdʒ/','n. 短缺；不足'],['housing','/ˈhaʊzɪŋ/','n. 住房；住宅供给'],['inequality','/ˌɪnɪˈkwɑːləti/','n. 不平等']]},
  {w:'empirical',p:'/ɪmˈpɪrɪkəl/',zh:'adj. 以观察或实验为依据的；实证的',en:'based on observation, experience, or experiment rather than theory',src:['TOEFL','GRE'],senses:['研究：实证的','证据：经验观察所得'],ex:'The theory is supported by substantial empirical evidence.',exZh:'该理论得到了大量实证证据的支持。',syn:['experimental','observational','evidence-based'],note:'学术写作高频：empirical evidence/study。对比 theoretical（理论的）。',family:'empiricism n. 经验主义 · empirically adv.',collocations:'empirical evidence · empirical study · empirical analysis',gl:[['theory','/ˈθɪri/','n. 理论'],['substantial','/səbˈstænʃəl/','adj. 大量的；实质的'],['evidence','/ˈevɪdəns/','n. 证据']]},
  {w:'plausible',p:'/ˈplɔːzəbəl/',zh:'adj. 看似合理的；貌似可信的',en:'seeming reasonable or likely to be true, although not necessarily proven',src:['IELTS','GRE'],senses:['解释：貌似合理','说法：听起来可信'],ex:'The scientist offered a plausible explanation for the change.',exZh:'科学家为这一变化提出了一个看似合理的解释。',syn:['credible','believable','reasonable'],note:'plausible 不等于 proven，只表示现有信息下“说得通”。',family:'plausibility n. 可信性 · plausibly adv.',collocations:'plausible explanation · plausible hypothesis · seem plausible',gl:[['scientist','/ˈsaɪəntɪst/','n. 科学家'],['offer','/ˈɔːfər/','v. 提供；提出'],['explanation','/ˌekspləˈneɪʃən/','n. 解释；说明']]},
  {w:'deteriorate',p:'/dɪˈtɪriəreɪt/',zh:'v. 恶化；退化；变坏',en:'to become worse in quality, condition, or value',src:['IELTS','TOEFL'],senses:['质量：下降','健康：恶化','关系/局势：变坏'],ex:'Air quality tends to deteriorate during the winter.',exZh:'空气质量在冬季往往会恶化。',syn:['decline','degrade','worsen'],note:'可用于健康、关系、质量和局势。既可作及物也可作不及物动词。',family:'deterioration n. 恶化、退化',collocations:'deteriorate rapidly · health deteriorates · environmental deterioration',gl:[['air quality','/er ˈkwɑːləti/','空气质量'],['tend to','/tend tuː/','往往；倾向于'],['during','/ˈdʊrɪŋ/','prep. 在……期间']]},
  {w:'conspicuous',p:'/kənˈspɪkjuəs/',zh:'adj. 显眼的；引人注目的；明显的',en:'easy to see or notice; attracting attention',src:['GRE'],senses:['外观：显眼','行为：引人注意','差异：明显'],ex:'His bright coat made him conspicuous in the crowd.',exZh:'鲜艳的外套使他在人群中格外显眼。',syn:['noticeable','prominent','striking'],note:'conspicuous consumption 指“炫耀性消费”。反义 inconspicuous。',family:'conspicuously adv. 显眼地 · conspicuousness n.',collocations:'conspicuous absence · conspicuous feature · conspicuous consumption',gl:[['bright','/braɪt/','adj. 鲜艳的；明亮的'],['coat','/koʊt/','n. 外套'],['crowd','/kraʊd/','n. 人群']]},
  {w:'allocate',p:'/ˈæləkeɪt/',zh:'v. 分配；拨给；划拨',en:'to give a particular amount of time, money, or resources for a purpose',src:['IELTS','TOEFL'],senses:['资金：拨款','资源：分配','时间：留出'],ex:'The council allocated more funds to public transport.',exZh:'委员会为公共交通拨出了更多资金。',syn:['assign','distribute','apportion'],note:'结构：allocate A to B / allocate A for B。',family:'allocation n. 分配、配额 · allocator n. 分配者',collocations:'allocate resources · allocate funds · memory allocation',gl:[['council','/ˈkaʊnsəl/','n. 委员会；地方议会'],['fund','/fʌnd/','n. 资金；基金'],['public transport','/ˈpʌblɪk ˈtrænspɔːrt/','公共交通']]},
  {w:'meticulous',p:'/məˈtɪkjələs/',zh:'adj. 一丝不苟的；极仔细的',en:'showing very careful attention to every detail',src:['GRE'],senses:['工作：细致严谨','记录：详尽准确'],ex:'She kept meticulous records of every experiment.',exZh:'她一丝不苟地记录了每一次实验。',syn:['scrupulous','thorough','painstaking'],note:'强调对细节投入极高注意力，可褒可贬。',family:'meticulously adv. 一丝不苟地 · meticulousness n.',collocations:'meticulous attention · meticulous records · meticulous planning',gl:[['keep records','/kiːp ˈrekərdz/','保存记录'],['experiment','/ɪkˈsperɪmənt/','n. 实验'],['every','/ˈevri/','det. 每一个']]},
  {w:'sustainable',p:'/səˈsteɪnəbəl/',zh:'adj. 可持续的；可长期维持的',en:'able to continue over time without exhausting resources or causing serious harm',src:['IELTS','TOEFL'],senses:['环境：可持续','商业：可长期维持','增长：可持续'],ex:'Cities must invest in sustainable forms of transport.',exZh:'城市必须投资于可持续的交通方式。',syn:['viable','maintainable','enduring'],note:'不只用于环保，也可描述商业模式、增长速度和财政。',family:'sustain v. 维持 · sustainability n. 可持续性 · sustainably adv.',collocations:'sustainable development · sustainable growth · sustainable energy',gl:[['invest in','/ɪnˈvest ɪn/','投资于；投入'],['form','/fɔːrm/','n. 形式；种类'],['transport','/ˈtrænspɔːrt/','n. 交通运输']]},
  {w:'counterpart',p:'/ˈkaʊntərpɑːrt/',zh:'n. 职能、地位或作用相当的人（物）',en:'a person or thing with the same position or function in another place or system',src:['TOEFL','GRE'],senses:['人物：职位相当者','事物：对应物'],ex:'The digital version is cheaper than its printed counterpart.',exZh:'数字版比对应的印刷版便宜。',syn:['equivalent','peer','correspondent'],note:'常用 one’s counterpart 表示另一组织中职位相当的人。',family:'counterpart 本身为可数名词',collocations:'foreign counterpart · digital counterpart · civilian counterpart',gl:[['digital','/ˈdɪdʒɪtəl/','adj. 数字的'],['version','/ˈvɜːrʒən/','n. 版本'],['printed','/ˈprɪntɪd/','adj. 印刷的']]},
  {w:'profound',p:'/prəˈfaʊnd/',zh:'adj. 深刻的；深远的；意义重大的',en:'very great, intense, or having a strong influence and lasting effect',src:['IELTS','TOEFL','GRE'],senses:['影响：深远','思想：深刻','情感：强烈'],ex:'The discovery had a profound impact on medicine.',exZh:'这项发现对医学产生了深远影响。',syn:['deep','far-reaching','intense'],note:'比 deep 更正式。也可表示知识渊博：a profound scholar。',family:'profoundly adv. 深刻地 · profundity n. 深奥',collocations:'profound impact · profound change · profound insight',gl:[['discovery','/dɪˈskʌvəri/','n. 发现'],['impact','/ˈɪmpækt/','n. 深远影响；冲击'],['medicine','/ˈmedɪsɪn/','n. 医学；药物']]},
  {w:'obsolete',p:'/ˌɑːbsəˈliːt/',zh:'adj. 过时的；废弃的；淘汰的',en:'no longer used or useful because something newer has replaced it',src:['TOEFL','GRE'],senses:['技术：淘汰的','制度：废弃的','词语：不再使用的'],ex:'Many traditional skills have become obsolete.',exZh:'许多传统技能已经过时。',syn:['outdated','antiquated','superseded'],note:'强调被新事物取代而不再使用，不只是“旧”。',family:'obsolescence n. 淘汰、废弃 · obsolescent adj. 正在淘汰的',collocations:'become obsolete · obsolete technology · planned obsolescence',gl:[['traditional','/trəˈdɪʃənəl/','adj. 传统的'],['skill','/skɪl/','n. 技能'],['become','/bɪˈkʌm/','v. 变得；成为']]}
];

// 词性与多义项单独维护，便于后续从授权词典数据中扩充。
const VOCAB_DETAILS = {
  abate:{pos:'vi. / vt.',meanings:[['vi.','（风暴、疼痛、愤怒等）减弱、消退、平息'],['vt.','减轻；降低；使停止'],['vt. 法律','撤销、废除；排除妨害']]},
  ubiquitous:{pos:'adj.',meanings:[['adj.','无处不在的；随处可见的'],['adj.','普遍存在或广泛使用的']]},
  mitigate:{pos:'vt.',meanings:[['vt.','减轻危害、痛苦或严重程度'],['vt. 法律','使处罚从轻；作为减轻情节']]},
  pragmatic:{pos:'adj.',meanings:[['adj.','务实的；注重实际效果的'],['adj. 语言学','语用的；与语境中的语言使用有关的']]},
  coherent:{pos:'adj.',meanings:[['adj.','连贯的；条理清楚的'],['adj.','各部分协调一致的'],['adj. 物理','相干的；具有固定相位关系的']]},
  ambiguous:{pos:'adj.',meanings:[['adj.','有歧义的；可作多种解释的'],['adj.','态度或含义不明确的；模棱两可的']]},
  resilient:{pos:'adj.',meanings:[['adj.','遭受困难后能迅速恢复的；复原力强的'],['adj. 材料','有弹性的；形变后能恢复的'],['adj. 控制/系统','受扰或受攻击后能维持、恢复关键性能的'],['adj. 基础设施','有韧性的；能承受冲击并恢复运行的']]},
  exacerbate:{pos:'vt.',meanings:[['vt.','使问题、矛盾或负面情绪加剧'],['vt. 医学','使病情恶化；诱发急性加重']]},
  empirical:{pos:'adj.',meanings:[['adj.','以观察、经验或实验为依据的；实证的'],['adj.','经验主义的；非纯理论推导的']]},
  plausible:{pos:'adj.',meanings:[['adj.','看似合理的；貌似可信的'],['adj.','能言善辩但未必真实的']]},
  deteriorate:{pos:'vi. / vt.',meanings:[['vi.','质量、健康、关系或局势恶化'],['vi.','材料或性能退化、劣化'],['vt. 较少用','使恶化；使变质']]},
  conspicuous:{pos:'adj.',meanings:[['adj.','显眼的；容易被注意到的'],['adj.','明显的；突出的'],['adj.','引人侧目或招摇的']]},
  allocate:{pos:'vt.',meanings:[['vt.','分配资源、时间或任务'],['vt.','拨给资金；划定用途'],['vt. 计算机','分配内存或系统资源']]},
  meticulous:{pos:'adj.',meanings:[['adj.','一丝不苟的；极注意细节的'],['adj.','精确而详尽的']]},
  sustainable:{pos:'adj.',meanings:[['adj.','可长期维持的；可持续的'],['adj. 环境','不耗尽资源或造成长期环境损害的'],['adj. 商业','在成本、增长或运营上可延续的']]},
  counterpart:{pos:'n. [C]',meanings:[['n.','另一组织中职位或职能相当的人'],['n.','另一系统中作用相同的对应物'],['n. 法律','契约或文件的副本']]},
  profound:{pos:'adj.',meanings:[['adj.','影响深远的；意义重大的'],['adj.','思想、见解或知识深刻的'],['adj.','情感或状态强烈、极度的'],['adj.','位置很深的；深部的']]},
  obsolete:{pos:'adj. / vt.',meanings:[['adj.','因被取代而过时、淘汰的'],['adj. 语言学','废弃的；不再通用的'],['vt. 较少用','使成为过时或淘汰的']]}
};
CURATED_VOCAB.forEach(word=>Object.assign(word,VOCAB_DETAILS[word.w]||{pos:'',meanings:[]}));

function normalizeVocabEntry(word){
  const meanings=Array.isArray(word.meanings)?word.meanings:[];
  return {
    ...word,
    p:word.p||'暂无音标',
    pos:word.pos||'未标注',
    zh:word.zh||'暂无中文释义',
    en:word.en||'No English definition is available in the source data.',
    src:Array.isArray(word.src)?word.src:[],
    meanings,
    senses:Array.isArray(word.senses)?word.senses:[],
    ex:word.ex||'',
    exZh:word.exZh||'',
    syn:Array.isArray(word.syn)?word.syn:[],
    note:word.note||'基础释义来自开放双解词典 ECDICT。',
    family:word.family||'暂无词形变化记录',
    collocations:word.collocations||'暂无可靠搭配数据',
    gl:Array.isArray(word.gl)?word.gl:[],
  };
}

const GENERATED_VOCAB=typeof EXAM_VOCAB==='undefined'?[]:EXAM_VOCAB;
const generatedByWord=new Map(GENERATED_VOCAB.map(word=>[word.w.toLocaleLowerCase(),word]));
const curatedKeys=new Set(CURATED_VOCAB.map(word=>word.w.toLocaleLowerCase()));
const mergedCurated=CURATED_VOCAB.map(curated=>{
  const base=generatedByWord.get(curated.w.toLocaleLowerCase());
  if(!base)return normalizeVocabEntry(curated);
  const seen=new Set(curated.meanings.map(item=>item[1]));
  const extraMeanings=(base.meanings||[]).filter(item=>!seen.has(item[1]));
  const definitions=[curated.en,base.en].filter(Boolean).filter((item,index,array)=>array.indexOf(item)===index).join('\n');
  return normalizeVocabEntry({...base,...curated,src:[...new Set([...(base.src||[]),...(curated.src||[])])],en:definitions,meanings:[...curated.meanings,...extraMeanings]});
});
const VOCAB=[...mergedCurated,...GENERATED_VOCAB.filter(word=>!curatedKeys.has(word.w.toLocaleLowerCase())).map(normalizeVocabEntry)];
