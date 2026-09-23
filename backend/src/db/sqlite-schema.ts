/**
 * SQLite 启动建表 DDL + 种子数据（自 mysql-schema.ts 翻译）
 * - AUTO_INCREMENT → AUTOINCREMENT；删除 ENGINE/CHARSET；TINYINT(1) → INTEGER
 * - MySQL 内联 INDEX 拆为独立 CREATE INDEX IF NOT EXISTS
 * - 种子语句去掉 FROM DUAL（SQLite 非法），幂等语义（WHERE NOT EXISTS）保留
 */
import type Database from 'better-sqlite3'

export const sqliteSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS dramas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    style TEXT DEFAULT '3d',
    aspect_ratio TEXT DEFAULT '16:9',
    total_episodes INTEGER DEFAULT 1,
    total_duration INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    thumbnail TEXT,
    tags TEXT,
    metadata TEXT,
    virtual_asset_group_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    script_content TEXT,
    description TEXT,
    duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    video_url TEXT,
    thumbnail TEXT,
    image_config_id INTEGER,
    video_config_id INTEGER,
    resolution TEXT DEFAULT '720p',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    description TEXT,
    appearance TEXT,
    styling TEXT,
    final_prompt TEXT,
    personality TEXT,
    image_url TEXT,
    public_url TEXT,
    virtual_asset_id TEXT,
    virtual_asset_uri TEXT,
    virtual_asset_source_url TEXT,
    virtual_asset_status TEXT,
    reference_images TEXT,
    seed_value TEXT,
    sort_order INTEGER,
    local_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER NOT NULL,
    episode_id INTEGER,
    location TEXT NOT NULL,
    time TEXT NOT NULL,
    prompt TEXT NOT NULL,
    lighting TEXT,
    final_prompt TEXT,
    storyboard_count INTEGER DEFAULT 1,
    image_url TEXT,
    public_url TEXT,
    status TEXT DEFAULT 'pending',
    local_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS storyboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    scene_id INTEGER,
    storyboard_number INTEGER NOT NULL,
    title TEXT,
    location TEXT,
    time TEXT,
    shot_type TEXT,
    angle TEXT,
    movement TEXT,
    result TEXT,
    atmosphere TEXT,
    image_prompt TEXT,
    video_prompt TEXT,
    bgm_prompt TEXT,
    sound_effect TEXT,
    description TEXT,
    duration INTEGER DEFAULT 0,
    composed_image TEXT,
    first_frame_image TEXT,
    last_frame_image TEXT,
    reference_images TEXT,
    video_url TEXT,
    subtitle_url TEXT,
    composed_video_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS episode_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_episode_characters_episode_id ON episode_characters (episode_id)`,
  `CREATE INDEX IF NOT EXISTS idx_episode_characters_character_id ON episode_characters (character_id)`,

  `CREATE TABLE IF NOT EXISTS episode_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_episode_scenes_episode_id ON episode_scenes (episode_id)`,
  `CREATE INDEX IF NOT EXISTS idx_episode_scenes_scene_id ON episode_scenes (scene_id)`,

  `CREATE TABLE IF NOT EXISTS episode_props (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    prop_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_episode_props_episode_id ON episode_props (episode_id)`,
  `CREATE INDEX IF NOT EXISTS idx_episode_props_prop_id ON episode_props (prop_id)`,

  `CREATE TABLE IF NOT EXISTS storyboard_characters (
    storyboard_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    PRIMARY KEY (storyboard_id, character_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_storyboard_characters_character_id ON storyboard_characters (character_id)`,

  `CREATE TABLE IF NOT EXISTS storyboard_props (
    storyboard_id INTEGER NOT NULL,
    prop_id INTEGER NOT NULL,
    PRIMARY KEY (storyboard_id, prop_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_storyboard_props_prop_id ON storyboard_props (prop_id)`,

  `CREATE TABLE IF NOT EXISTS ai_service_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT NOT NULL,
    provider TEXT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT,
    endpoint TEXT,
    query_endpoint TEXT,
    priority INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    settings TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS ai_service_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_name TEXT,
    service_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    default_url TEXT,
    preset_models TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS style_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    prompt TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (value)
  )`,

  `CREATE TABLE IF NOT EXISTS sys_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    storyboard_id INTEGER,
    drama_id INTEGER,
    scene_id INTEGER,
    character_id INTEGER,
    prop_id INTEGER,
    provider TEXT,
    prompt TEXT,
    model TEXT,
    params TEXT,
    task_id TEXT,
    result_url TEXT,
    local_path TEXT,
    status TEXT DEFAULT 'processing',
    error_msg TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sys_task_type ON sys_task (type)`,
  `CREATE INDEX IF NOT EXISTS idx_sys_task_drama_id ON sys_task (drama_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sys_task_storyboard_id ON sys_task (storyboard_id)`,

  `CREATE TABLE IF NOT EXISTS video_merges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER,
    drama_id INTEGER,
    title TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scenes TEXT,
    merged_url TEXT,
    duration INTEGER,
    task_id TEXT,
    error_msg TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS props (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    prompt TEXT,
    final_prompt TEXT,
    image_url TEXT,
    public_url TEXT,
    reference_images TEXT,
    local_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER,
    episode_id INTEGER,
    storyboard_id INTEGER,
    storyboard_num INTEGER,
    name TEXT,
    description TEXT,
    type TEXT,
    category TEXT,
    url TEXT,
    thumbnail_url TEXT,
    local_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    duration INTEGER,
    format TEXT,
    image_gen_id INTEGER,
    video_gen_id INTEGER,
    is_favorite INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 应用级全局设置（key-value，如 AI 内容语言 content_language）
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
]

/**
 * 风格预设种子数据 — value 存入 dramas.style，prompt 注入生图提示词（作为前缀拼接）
 *
 * prompt 统一按多维结构书写，保证跨模型/跨镜头的风格控制力：
 *   核心媒介与渲染 → 线条/造型 → 上色/材质 → 光影 → 色彩调性 → 背景处理 → 画质锚点 → avoid 禁忌项
 */
const LIVE_MODERN_REALISTIC_PROMPT = 'photorealistic contemporary live-action drama still, fictional actors with authentic human anatomy and natural facial proportions, realistic skin pores and fine hair detail, restrained professional makeup, contemporary wardrobe and production design appropriate to the story, soft motivated daylight mixed with practical interior lighting, true-to-life neutral color science, 35mm photography with natural depth of field, premium streaming-series production value, detailed real-world environments, high-resolution sharp facial focus, consistent actor appearance across shots, avoid anime, avoid illustration, avoid 3D CGI render, avoid doll-like face, avoid plastic waxy skin, avoid excessive beauty filter, avoid over-saturated colors, avoid distorted hands and facial features'
export const LIVE_XUANHUAN_V1_PROMPT = 'photorealistic live-action Chinese xuanhuan fantasy drama still, fictional actors with realistic skin and grounded human proportions, elaborate original fantasy costumes with tactile silk leather and metal materials, monumental fantasy architecture rooted in Chinese aesthetics, mythical creatures and elemental magic integrated through seamless cinematic VFX, volumetric clouds mist embers and luminous energy, epic scale with readable character emotion, dramatic contrast lighting and jewel-tone cinematic color grading, high-end theatrical production design, detailed 4K film texture, consistent actor appearance costume motifs and fantasy-world rules across shots, avoid anime, avoid illustration, avoid video-game HUD, avoid cheap cosplay, avoid obvious green-screen edges, avoid plastic CGI skin, avoid overexposed magic effects, avoid malformed anatomy'
export const LIVE_XUANHUAN_PROMPT = 'strictly photorealistic live-action Chinese xuanhuan fantasy feature-film photography, real adult human actors photographed through a physical full-frame cinema camera, authentic human anatomy and natural facial proportions, visible skin pores and peach fuzz, realistic eyes teeth hands and individual hair strands, restrained professional film makeup without beauty-filter smoothing, elaborate original fantasy costumes constructed from real woven silk leather metal embroidery and practical jewelry, monumental practical Chinese fantasy sets extended only by seamless high-end cinematic VFX, mythical creatures and elemental magic integrated into physically filmed plates with realistic light interaction, volumetric clouds mist embers and luminous energy, epic scale with readable human performance, dramatic motivated lighting, jewel-tone theatrical color grading, natural highlight roll-off, subtle 35mm film grain and optical lens response, detailed 4K live-action film texture, consistent actor appearance costume motifs and fantasy-world rules across shots, this is live-action photography rather than character art, absolutely no anime, no manga, no donghua, no illustration, no 2D or 2.5D art, no cel shading, no digital painting, no game character concept art, no video-game render, no 3D CG human, no doll-like face, no oversized eyes, no porcelain or plastic skin, no cheap cosplay, no obvious green-screen edges, no overexposed magic effects, no malformed anatomy'

export const stylePresetSeeds = [
  {
    name: '3D 漫剧', value: '3d', sortOrder: 1,
    prompt: 'high-quality 3D CG animation still, modern game-engine cinematic render, Unreal Engine and Pixar grade quality, semi-realistic stylized characters with refined facial features, clean sculpted anatomy, detailed skin shader with subtle subsurface scattering, PBR materials with crisp detailed textures, volumetric cinematic lighting with soft rim light, rich depth of field, polished film color grading, detailed environment art, sharp focus, consistent character design across shots, avoid flat lighting, avoid plastic waxy skin, avoid low-poly blurry look, avoid 2D flat cel shading, avoid anime line art',
    description: '游戏引擎级 3D 渲染，半写实角色，当前短剧主流的 3D 漫剧质感',
  },
  {
    name: '日漫赛璐璐', value: 'anime', sortOrder: 2,
    prompt: 'Japanese TV anime style, clean cel shading with hard-edged shadow shapes, crisp uniform black line art, vivid saturated color palette, expressive large-eyed character design with on-model proportions, detailed hand-painted anime backgrounds, dramatic anime key lighting with screentone highlights, key-visual poster quality, consistent character design across shots, avoid 3D CGI look, avoid painterly soft blending, avoid watercolor texture, avoid photorealism, avoid thick western comic outlines',
    description: '日式赛璐璐动画风格',
  },
  {
    name: '吉卜力手绘', value: 'ghibli', sortOrder: 3,
    prompt: 'Studio Ghibli hand-drawn animation style, soft painterly brushwork with organic hand-crafted line quality, lush warm watercolor painted backgrounds, gentle natural daylight with nostalgic warm glow, muted earthy natural color palette, whimsical cozy storybook atmosphere, subtle film-grain softness, theatrical background art quality, consistent character design across shots, avoid hard cel shading, avoid 3D render look, avoid neon over-saturated colors, avoid sharp digital edges, avoid photorealism',
    description: '吉卜力手绘治愈风',
  },
  {
    name: '水彩绘本', value: 'watercolor', sortOrder: 4,
    prompt: 'delicate watercolor storybook illustration, soft translucent color washes, visible cold-press paper texture, fluid hand-painted brushstrokes with gentle pigment bleeds, light airy atmosphere, harmonious pastel palette, whimsical children book charm, loose expressive edges, consistent character design across shots, avoid bold black outlines, avoid digital airbrush look, avoid harsh contrast, avoid 3D rendering, avoid photorealism',
    description: '水彩插画质感',
  },
  {
    name: '美式漫画', value: 'comic', sortOrder: 5,
    prompt: 'Western graphic-novel comic book style, bold confident black ink outlines, halftone dot shading and screentone gradients, dynamic saturated colors with dramatic contrast, dramatic spotlight lighting, flat graphic print look, sharp inking details, dynamic cinematic composition, consistent character design across shots, avoid painterly soft blending, avoid watercolor washes, avoid photorealistic rendering, avoid 3D CGI look, avoid anime cel shading',
    description: '美式漫画粗线条风格',
  },
  {
    name: '国风 2.5D', value: 'guofeng', sortOrder: 7,
    prompt: 'Chinese guofeng 2.5D illustration style, semi-realistic donghua-quality character art, elegant flowing line work, rich traditional Chinese aesthetic elements, layered ink-wash inspired atmospheric backgrounds, refined silk and fabric textures, soft luminous lighting with gentle haze, sophisticated muted jewel-tone palette, xianxia drama poster quality, consistent character design across shots, avoid flat cel shading, avoid western comic ink style, avoid photorealism, avoid plastic 3D look, avoid modern clothing and props unless specified',
    description: '国风动画/仙侠剧质感，2.5D 半写实',
  },
  {
    name: '韩系网漫', value: 'webtoon', sortOrder: 8,
    prompt: 'Korean webtoon manhwa style, clean digital painting with soft gradient shading, slim elegant character proportions, large expressive eyes with detailed highlights, soft glowing skin rendering, romantic dreamy lighting, modern pastel-to-vivid color palette, detailed fashion and fabric rendering, webtoon key visual quality, consistent character design across shots, avoid heavy black ink outlines, avoid halftone dots, avoid 3D render look, avoid watercolor paper texture, avoid chibi proportions',
    description: '韩国条漫/网漫精致上色风',
  },
  {
    name: '黑白漫画', value: 'noir', sortOrder: 9,
    prompt: 'black and white manga illustration, high-contrast monochrome ink work, dynamic hatching and cross-hatching shading, bold solid blacks with dramatic negative space, screentone gray gradation, expressive confident ink linework, cinematic noir lighting, professional manga page quality, consistent character design across shots, strictly no color, avoid grayscale blur smudging, avoid painterly soft edges, avoid photorealism, avoid 3D render look',
    description: '黑白漫/ Noir 高对比墨水风',
  },
  {
    name: '真人现代写实', value: 'realistic', sortOrder: 10,
    prompt: LIVE_MODERN_REALISTIC_PROMPT,
    description: '真人现代短剧写实质感，自然肤质、真实布光与生活化场景',
  },
  {
    name: '真人电影画风', value: 'live-cinematic-film', sortOrder: 11,
    prompt: 'premium photorealistic live-action feature-film still, fictional actors with natural detailed skin and expressive cinematic performance, carefully art-directed wardrobe and production design, anamorphic cinematic composition, layered foreground and background depth, shallow depth of field with organic lens falloff, motivated key light and subtle rim light, controlled highlight roll-off, rich but restrained theatrical color grading, fine 35mm film grain, atmospheric depth, high dynamic range, award-caliber cinematography, consistent actor appearance and film color pipeline across shots, avoid television-flat lighting, avoid anime, avoid illustration, avoid obvious CGI, avoid synthetic glossy skin, avoid excessive teal-orange grading, avoid over-sharpening, avoid deformed anatomy',
    description: '院线真人电影质感，宽银幕构图、胶片颗粒与高级电影调色',
  },
  {
    name: '真人纪录片风格', value: 'live-documentary', sortOrder: 12,
    prompt: 'photorealistic live-action observational documentary frame, authentic unstaged human behavior and candid emotion, fictional real-world subjects, available natural light and practical lighting, handheld eye-level camera language, honest skin texture without glamour retouching, lived-in locations with accurate environmental details, restrained natural colors, moderate depth of field, subtle sensor noise and documentary film grain, believable imperfect framing, journalistic visual clarity, consistent subject appearance across the sequence, avoid posed fashion photography, avoid beauty filters, avoid studio glamour lighting, avoid anime, avoid illustration, avoid 3D CGI, avoid artificial bokeh, avoid hyper-saturated commercial grading, avoid waxy skin',
    description: '纪实观察式真人影像，自然光、手持摄影与真实生活质感',
  },
  {
    name: '真人古代武侠', value: 'live-wuxia', sortOrder: 13,
    prompt: 'photorealistic live-action Chinese wuxia film still, fictional martial-arts heroes with realistic human faces and athletic anatomy, historically grounded hanfu and layered weathered fabrics, practical ancient Chinese sets, inns, bamboo forests and mountain passes, elegant sword choreography and dynamic body movement, wind-swept garments and hair, crisp action readability, dramatic natural backlight through mist and dust, restrained ink-inspired earth and jade color palette, cinematic 35mm lens depth, premium period-film production value, consistent actor faces costumes and weapons across shots, avoid anime, avoid illustration, avoid game-render appearance, avoid plastic armor, avoid modern objects, avoid excessive magical effects, avoid xianxia floating immortals, avoid waxy skin and malformed hands',
    description: '真人江湖武侠电影，真实古装、刀剑动作与山水意境',
  },
  {
    name: '真人玄幻影视', value: 'live-xuanhuan', sortOrder: 14,
    prompt: LIVE_XUANHUAN_PROMPT,
    description: '真人东方玄幻大片，宏大世界观、精致服化道与融合式特效',
  },
  {
    name: '真人仙侠影视', value: 'live-xianxia', sortOrder: 15,
    prompt: 'photorealistic live-action Chinese xianxia drama still, fictional immortal cultivators with natural human faces and refined but believable makeup, flowing layered hanfu with translucent silk and intricate embroidery, celestial palaces cloud seas ancient sects and misty sacred mountains, elegant wire-assisted movement, restrained spiritual energy and sword aura integrated as cinematic VFX, ethereal soft backlight with volumetric haze, pearl jade and moonlit color palette balanced by natural skin tones, romantic high-end costume-drama cinematography, detailed fabric hair and jewelry, consistent actor appearance costumes and cultivation-world design across shots, avoid anime, avoid illustration, avoid plastic 3D render, avoid cheap cosplay, avoid excessive bloom, avoid neon rainbow magic, avoid modern props, avoid waxy over-smoothed skin',
    description: '真人仙侠剧质感，飘逸古装、仙门云海与克制高级的灵力特效',
  },
  {
    name: '真人古装历史', value: 'live-historical', sortOrder: 16,
    prompt: 'photorealistic live-action Chinese historical period-drama still, fictional historical characters with realistic faces and age-appropriate natural makeup, dynasty-appropriate garments hair ornaments armor and social hierarchy details, hand-built palace courtyard market village and battlefield sets, natural linen silk wood stone and bronze textures, candlelight window light and overcast daylight used as motivated illumination, restrained classical color palette with deep reds muted golds ink blacks and earth tones, composed cinematic blocking, historically grounded atmosphere, premium television epic production value, consistent actor appearance wardrobe and period details across shots, avoid fantasy magic, avoid anime, avoid illustration, avoid modern objects, avoid cheap theatrical costumes, avoid plastic fabric, avoid glossy CGI architecture, avoid beauty-filter skin',
    description: '真人历史正剧，考究朝代服化道、礼制空间与厚重叙事感',
  },
  {
    name: '真人民国电影', value: 'live-republican-era', sortOrder: 17,
    prompt: 'photorealistic live-action Chinese Republican-era film still, fictional characters in historically accurate 1910s-1940s tailoring qipao changshan military uniforms and period hairstyles, layered old-city streets mansions train stations ballrooms and newspaper offices, tactile aged wood brass glass rain and cigarette haze, tungsten practical lamps mixed with cool window light, elegant noir-influenced composition, restrained sepia jade and burgundy palette, fine film grain and soft vintage lens character, emotionally charged period-drama cinematography, consistent actor appearance costumes and period props across shots, avoid modern cars electronics and signage, avoid anime, avoid illustration, avoid steampunk fantasy, avoid costume-party look, avoid plastic skin, avoid excessive monochrome filters',
    description: '真人民国电影质感，旗袍长衫、旧城空间与复古光影',
  },
  {
    name: '真人年代剧', value: 'live-period-drama', sortOrder: 18,
    prompt: 'photorealistic live-action Chinese social period-drama still, fictional families and workers portrayed with honest natural performances, period-accurate 1970s 1980s or 1990s clothing hairstyles furniture streets factories and household objects according to the story, unpolished lived-in interiors, soft daylight and practical tungsten bulbs, slightly faded analog color response, gentle film grain, restrained contrast, documentary-informed composition with warm human emotion, highly believable material wear and everyday detail, consistent actor appearance and selected decade across shots, avoid mixing decades, avoid modern smartphones LED screens and contemporary fashion, avoid anime, avoid illustration, avoid glossy commercial lighting, avoid excessive nostalgia filters, avoid waxy skin',
    description: '真人七八九十年代生活剧，年代考据、烟火气与胶片回忆感',
  },
  {
    name: '真人都市情感', value: 'live-urban-romance', sortOrder: 19,
    prompt: 'photorealistic contemporary live-action urban romance drama still, fictional adult actors with natural attractive facial detail and emotionally nuanced performance, sophisticated modern wardrobe and believable apartments offices cafes hospitals and city streets, soft window light and warm practical lamps, tasteful night-city reflections, flattering yet realistic skin tones, clean cinematic composition with intimate close-ups and gentle depth of field, polished premium streaming-drama color grade, subtle film grain, aspirational but lived-in production design, consistent actor appearance wardrobe continuity and relationship tone across shots, avoid fashion-ad poses, avoid excessive beauty filters, avoid plastic skin, avoid anime, avoid illustration, avoid 3D CGI, avoid empty luxury-showroom backgrounds, avoid neon color cast on faces',
    description: '真人都市情感剧，精致生活空间、自然人物表演与柔和电影光',
  },
  {
    name: '真人悬疑犯罪', value: 'live-crime-thriller', sortOrder: 20,
    prompt: 'photorealistic live-action crime mystery thriller still, fictional adult investigators suspects and witnesses with realistic weathered skin and restrained performances, grounded police stations alleys apartments warehouses and forensic environments, low-key motivated lighting with practical fluorescents street lamps and window slashes, controlled pools of shadow with readable facial detail, tense asymmetric composition, cool neutrals balanced by sodium amber and muted natural color, subtle rain haze dust and film grain, procedural realism and premium noir cinematography, consistent actor appearance evidence props and spatial continuity across shots, avoid graphic gore, avoid superhero styling, avoid anime, avoid illustration, avoid video-game render, avoid crushed unreadable blacks, avoid excessive blue tint, avoid glossy beauty skin, avoid implausible police equipment',
    description: '真人悬疑犯罪剧，低调光、程序化真实与压迫感电影构图',
  },
  {
    name: '真人科幻影视', value: 'live-grounded-scifi', sortOrder: 21,
    prompt: 'photorealistic grounded live-action science-fiction film still, fictional actors with realistic human faces and natural skin, believable near-future wardrobe technology and industrial production design, practical sets enhanced by seamless restrained VFX, physically plausible spacecraft laboratories megacities and interfaces, tactile metal glass fabric and weathered surfaces, volumetric atmospheric lighting with balanced practical sources, cinematic scale and strong depth, sophisticated steel neutral and selective accent-color palette, high dynamic range film photography, consistent actor appearance technology language and world rules across shots, avoid anime, avoid illustration, avoid glossy video-game CGI, avoid random hologram clutter, avoid superhero costumes, avoid plastic skin, avoid implausible machinery, avoid excessive blue monochrome',
    description: '真人硬科幻电影，可信未来科技、实景质感与克制融合特效',
  },
  {
    name: '真人战争史诗', value: 'live-war-epic', sortOrder: 22,
    prompt: 'photorealistic live-action historical war epic still, fictional soldiers and civilians with realistic faces fatigue and weathered clothing, period-accurate uniforms armor weapons vehicles and battlefield logistics according to the story, large-scale practical environments with smoke dust mud rain and wind, dynamic but legible battle composition, strong natural backlight through atmospheric haze, desaturated earth palette with controlled warm highlights, gritty 35mm film grain, tactile production design and sober human emotion, consistent actor appearance uniforms equipment and historical period across shots, avoid graphic gore, avoid propaganda-poster posing, avoid anime, avoid illustration, avoid video-game render, avoid pristine costumes, avoid modern equipment, avoid weightless explosions, avoid waxy skin',
    description: '真人战争史诗，考究装备、宏大战场与克制的人性叙事',
  },
  {
    name: '真人青春校园', value: 'live-youth-campus', sortOrder: 23,
    prompt: 'photorealistic live-action youth campus drama still, fictional young-adult college students with natural faces realistic skin and spontaneous expressive performance, contemporary classrooms libraries dormitories sports grounds music rooms and tree-lined campus paths, authentic casual wardrobe backpacks stationery and student-life props, bright soft daylight with warm golden-hour accents, fresh balanced colors and clean natural whites, gentle handheld or eye-level camera language, intimate shallow depth of field, optimistic premium coming-of-age film texture, consistent actor appearance wardrobe and campus continuity across shots, avoid childlike body proportions, avoid school-uniform fetishization, avoid beauty-filter faces, avoid anime, avoid illustration, avoid plastic 3D render, avoid overexposed pastel haze, avoid staged advertising poses',
    description: '真人青春校园剧，大学生活、自然青春感与清透阳光影调',
  },
  {
    name: '真人乡土现实', value: 'live-rural-realism', sortOrder: 24,
    prompt: 'photorealistic live-action rural social-realist drama still, fictional villagers and families with authentic faces natural age detail and understated performances, regionally accurate homes farmland roads markets workshops clothing and daily tools, available sunlight overcast skies and practical household lamps, tactile soil wood brick fabric and weathered surfaces, restrained earth and vegetation colors, observational medium shots and environmental portraits, subtle film grain, compassionate documentary-informed realism, consistent actor appearance season geography and local material culture across shots, avoid romanticized tourism imagery, avoid poverty spectacle, avoid glamour makeup, avoid anime, avoid illustration, avoid 3D CGI, avoid artificial HDR, avoid plastic skin, avoid generic studio sets',
    description: '真人乡土现实主义，地域生活细节、自然光与朴素纪实表演',
  },
  {
    name: '真人复古港风', value: 'live-hongkong-retro', sortOrder: 25,
    prompt: 'photorealistic live-action 1980s-1990s Hong Kong cinema still, fictional adult actors with expressive natural faces and era-appropriate hair makeup and wardrobe, dense streets tong lau interiors diners dance halls docks and rain-soaked alleys, practical neon signs tungsten bulbs fluorescent spill and humid night haze, bold but controlled red green amber and cyan color separation with believable skin tones, energetic off-center framing, vintage anamorphic lens bloom, rich shadow detail and visible 35mm film grain, tactile urban production design, consistent actor appearance era props and color pipeline across shots, avoid modern smartphones cars and LED architecture, avoid anime, avoid illustration, avoid cyberpunk exaggeration, avoid crushed blacks, avoid plastic skin, avoid clean digital sterility',
    description: '真人八九十年代港片质感，霓虹钨丝灯、潮湿街巷与胶片颗粒',
  },
]

/**
 * 旧版种子 prompt（v1 一句话风格描述）— 用于内容寻址升级：
 * 仅当库中行的 prompt 仍等于旧种子值（未被用户在设置页编辑过）才覆盖为新 prompt
 */
const LEGACY_SEED_PROMPTS: Record<string, string> = {
  '3d': '3D CG animation style, game-engine quality render, semi-realistic stylized characters, refined facial features, detailed materials and textures, cinematic lighting, high detail',
  anime: 'Japanese anime style, cel shading, clean crisp line art, vivid saturated colors, expressive character designs, detailed painted backgrounds',
  ghibli: 'Studio Ghibli style, hand-drawn animation, soft watercolor painted backgrounds, warm nostalgic lighting, gentle natural palette, whimsical cozy atmosphere',
  'live-xuanhuan': LIVE_XUANHUAN_V1_PROMPT,
  watercolor: 'watercolor illustration style, soft translucent washes, visible paper texture, delicate fluid brushwork, light airy atmosphere, hand-painted storybook feel',
  comic: 'Western comic book style, bold black ink outlines, halftone dot shading, dynamic saturated colors, dramatic contrast lighting, flat graphic novel look',
}

/**
 * 已下架的种子预设 — 内容寻址删除：仅当库中行的 prompt 仍是种子原文
 * （未被用户编辑过）才删除；用户改过的同名行视为用户数据保留。
 * live（旧版通用真人写实）：已由更明确的真人影视分类模板替代。
 */
const REMOVED_SEED_PROMPTS: Record<string, string> = {
  live: 'ultra-realistic cinematic live-action look, professional film photography, natural skin tones with detailed pores and realistic texture, true human anatomy and proportions, shallow depth of field with creamy bokeh, cinematic three-point lighting, subtle film grain, 35mm lens cinematic framing, true-to-life color grading, detailed real-world environments, consistent actor appearance across shots, avoid cartoon or anime features, avoid 3D render look, avoid illustration style, avoid plastic waxy skin, avoid over-smoothing beauty filter',
  'live-modern-realistic': LIVE_MODERN_REALISTIC_PROMPT,
}

// INSERT ... SELECT WHERE NOT EXISTS → 幂等：只补缺失行，不覆盖用户编辑
// （SQLite 无 FROM DUAL，无 FROM 的 SELECT 合法）
const SEED_SQL = 'INSERT INTO style_presets ("name", "value", "prompt", "description", "sort_order", "is_active", "created_at", "updated_at") SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM style_presets WHERE value = ?)'
// 内容寻址升级：命中旧种子原文才更新（用户在设置页改过的行不动）
const UPGRADE_SQL = 'UPDATE style_presets SET "name" = ?, "prompt" = ?, "description" = ?, "sort_order" = ?, "updated_at" = ? WHERE "value" = ? AND "prompt" = ?'
// 内容寻址下架：命中下架种子原文才删除
const REMOVE_SQL = 'DELETE FROM style_presets WHERE "value" = ? AND "prompt" = ?'

export function initSqliteSchema(sqlite: Database.Database) {
  for (const statement of sqliteSchemaStatements) {
    sqlite.exec(statement)
  }
  // Older releases used the same table names but had fewer columns.  CREATE
  // TABLE IF NOT EXISTS does not upgrade those tables, so add the newer,
  // nullable/defaulted columns idempotently before Drizzle prepares queries.
  // This keeps existing projects and AI-service settings intact.
  const upgrades: Record<string, Record<string, string>> = {
    dramas: {
      aspect_ratio: "TEXT DEFAULT '16:9'",
      virtual_asset_group_id: 'TEXT',
    },
    episodes: {
      content: 'TEXT',
      image_config_id: 'INTEGER',
      video_config_id: 'INTEGER',
      resolution: "TEXT DEFAULT '720p'",
    },
    characters: {
      styling: 'TEXT',
      final_prompt: 'TEXT',
      local_path: 'TEXT',
      public_url: 'TEXT',
      virtual_asset_id: 'TEXT',
      virtual_asset_uri: 'TEXT',
      virtual_asset_source_url: 'TEXT',
      virtual_asset_status: 'TEXT',
    },
    scenes: {
      lighting: 'TEXT',
      final_prompt: 'TEXT',
      local_path: 'TEXT',
      public_url: 'TEXT',
      deleted_at: 'TEXT',
    },
    props: {
      public_url: 'TEXT',
    },
    storyboards: {
      first_frame_image: 'TEXT',
      last_frame_image: 'TEXT',
      reference_images: 'TEXT',
      subtitle_url: 'TEXT',
      composed_video_url: 'TEXT',
      deleted_at: 'TEXT',
    },
    // Databases created by the original GORM backend used these join tables
    // without surrogate ids/timestamps.  Drizzle's current schema selects
    // those columns, so add them lazily while preserving all existing links.
    episode_characters: {
      id: 'INTEGER',
      created_at: "TEXT DEFAULT ''",
    },
    episode_props: {
      id: 'INTEGER',
      created_at: "TEXT DEFAULT ''",
    },
  }
  for (const [table, columns] of Object.entries(upgrades)) {
    const existing = new Set(
      (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(c => c.name),
    )
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(column)) {
        sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`)
      }
    }
  }
  // Backfill deterministic values for rows migrated from the legacy join
  // tables.  Keep this separate from the ALTER statements so it is safe to
  // run on every startup and does not touch already populated values.
  sqlite.exec(`
    UPDATE episode_characters
    SET id = rowid
    WHERE id IS NULL;
    UPDATE episode_characters
    SET created_at = datetime('now')
    WHERE created_at IS NULL OR created_at = '';
    UPDATE episode_props
    SET id = rowid
    WHERE id IS NULL;
    UPDATE episode_props
    SET created_at = datetime('now')
    WHERE created_at IS NULL OR created_at = '';
  `)
  const insertSeed = sqlite.prepare(SEED_SQL)
  const upgradeSeed = sqlite.prepare(UPGRADE_SQL)
  const removeSeed = sqlite.prepare(REMOVE_SQL)
  for (const s of stylePresetSeeds) {
    const ts = new Date().toISOString()
    insertSeed.run(s.name, s.value, s.prompt, s.description, s.sortOrder, ts, ts, s.value)
    const legacyPrompt = LEGACY_SEED_PROMPTS[s.value]
    if (legacyPrompt) {
      const res = upgradeSeed.run(s.name, s.prompt, s.description, s.sortOrder, ts, s.value, legacyPrompt)
      if (res.changes > 0) console.log(`🎨 风格预设「${s.name}」已升级为结构化提示词`)
    }
  }
  // Keep persisted asset prompt previews aligned with the current project
  // style. Match the exact old built-in prefix only, so user-authored details
  // after that prefix remain untouched and projects using another style are
  // not rewritten.
  for (const table of ['characters', 'scenes', 'props']) {
    sqlite.prepare(`
      UPDATE "${table}"
      SET final_prompt = ? || substr(final_prompt, ?), updated_at = ?
      WHERE drama_id IN (SELECT id FROM dramas WHERE style = 'live-xuanhuan')
        AND substr(final_prompt, 1, ?) = ?
    `).run(
      LIVE_XUANHUAN_PROMPT,
      LIVE_XUANHUAN_V1_PROMPT.length + 1,
      new Date().toISOString(),
      LIVE_XUANHUAN_V1_PROMPT.length,
      LIVE_XUANHUAN_V1_PROMPT,
    )
  }
  for (const [value, prompt] of Object.entries(REMOVED_SEED_PROMPTS)) {
    const res = removeSeed.run(value, prompt)
    if (res.changes > 0) console.log(`🗑️ 风格预设「${value}」已下架`)
  }
}
