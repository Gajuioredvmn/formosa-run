/* Five stages, four choices, sixteen destinations. Data shared with Godot by tools/export-data.cjs. */
window.FORMOSA_ROUTES = {
  apply(stages) {
    const copy = value => JSON.parse(JSON.stringify(value));
    const section = (len, k, dy, L, R, tags, extra = {}) => ({ len, k, dy, lanes: 3, sh: 2.1, shl: 1.8, L, R, tags, ...extra });
    const add = (id, template, fields, sections) => {
      stages[id] = Object.assign(copy(stages[template]), fields, { sections });
      if (fields.goal) { delete stages[id].children; delete stages[id].sign; }
    };
    add('s4f', 's4a', { label: '雲林・北港香路', name: '雲林北港', en: 'BEIGANG · YUNLIN', pano: 'westernplain', clouds: 113, county: '雲林縣', culture: ['朝天宮', '北港老街', '西螺大橋', '布袋戲'] }, [
      section(360, 0, 0, 'town', 'town', ['checkpoint', 'townhouse', 'templegate', 'lamps']),
      section(500, .0038, 4, 'paddy', 'farm', ['paddies', 'farmhouse', 'betel']),
      section(480, -.0045, 5, 'town', 'plaza', ['townhouse', 'templegate', 'parade_beigang', 'lanterns']),
      section(520, .0042, -5, 'town', 'river', ['redbridge', 'guardR', 'lamps']),
      section(480, -.0034, 8, 'farm', 'paddy', ['paddies', 'farmhouse']),
      section(520, .0048, -8, 'town', 'town', ['townhouse', 'nightmarket', 'lanterns']),
      section(460, -.0032, 3, 'farm', 'grass', ['betel', 'palmgroup']),
      section(520, 0, -3, 'grass', 'grass', ['palmgroup']),
    ]);
    add('s4g', 's4b', { label: '苗栗・三義客庄', name: '苗栗三義', en: 'SANYI · MIAOLI', pano: 'foothills', clouds: 127, county: '苗栗縣', culture: ['木雕街', '龍騰斷橋', '客家聚落', '油桐花'] }, [
      section(360, 0, 0, 'town', 'hills', ['checkpoint', 'townhouse', 'hakka', 'lamps']),
      section(480, .0052, 15, 'hills', 'tea', ['hakkavillage', 'teafarm', 'tung']),
      section(520, -.0058, 20, 'mountain', 'river', ['sanyi', 'redbridge', 'guardR']),
      section(480, .0061, -12, 'town', 'hills', ['townhouse', 'hakkavillage', 'tung']),
      section(520, -.0054, 24, 'tea', 'orchard', ['teafarm', 'farmhouse']),
      section(500, .0049, -20, 'hills', 'mountain', ['tung', 'coffee', 'guardR']),
      section(460, -.0042, -16, 'town', 'farm', ['hakka', 'townhouse', 'lamps']),
      section(520, 0, -11, 'grass', 'hills', ['palmgroup']),
    ]);
    add('s4h', 's4d', { label: '枋山・山海公路', name: '枋山', en: 'FANGSHAN COAST', pano: 'southcoast', clouds: 131, county: '屏東縣', culture: ['枋山芒果', '山海公路', '海岸礁岩', '落山風'] }, [
      section(360, 0, 0, 'town', 'shore', ['checkpoint', 'townhouse', 'mango', 'guardR']),
      section(540, .0055, 14, 'slope', 'shore', ['hillface', 'guardR', 'coastplants']),
      section(520, -.0062, -6, 'mountain', 'cliff', ['guardR', 'fruit', 'coastplants']),
      section(500, .0057, 18, 'town', 'shore', ['townhouse', 'mango', 'fruit', 'guardR']),
      section(560, -.0059, -14, 'slope', 'cliff', ['hillface', 'guardR', 'coastplants']),
      section(500, .0054, 10, 'orchard', 'shore', ['farmhouse', 'fruit', 'guardR']),
      section(480, -.0048, -12, 'hills', 'beach', ['palmgroup', 'tetrapods']),
      section(520, 0, -10, 'grass', 'shore', ['palmgroup', 'guardR']),
    ]);
    add('s5k', 's5b', { label: '臺中・高美濕地', name: '高美濕地', en: 'GAOMEI WETLANDS', pano: 'gaomei', clouds: 137, goal: '高美濕地木棧道', county: '臺中市', culture: ['風力發電機', '木棧道', '潮間帶', '大甲媽祖'] }, [
      section(360, 0, 0, 'town', 'mudflat', ['checkpoint', 'townhouse', 'wetland', 'guardR']),
      section(520, .0038, 3, 'farm', 'mudflat', ['windmill', 'wetland', 'egrets']),
      section(500, -.0046, -3, 'town', 'plaza', ['townhouse', 'templegate', 'parade_dajia']),
      section(540, .0044, 6, 'grass', 'mudflat', ['windmill', 'boardwalk', 'guardR']),
      section(500, -.0048, -6, 'farm', 'shore', ['farmhouse', 'windmill', 'oysters']),
      section(520, .0039, 4, 'town', 'mudflat', ['townhouse', 'wetland', 'lamps']),
      section(480, -.0032, -4, 'grass', 'shore', ['windmill', 'egrets']),
      section(420, 0, 0, 'plaza', 'mudflat', ['goal', 'boardwalk', 'windmill']),
    ]);
    add('s5l', 's5b', { label: '新竹・南寮漁港', name: '新竹南寮', en: 'NANLIAO · HSINCHU', pano: 'nanliao', clouds: 139, goal: '南寮漁港魚鱗天梯', county: '新竹市', culture: ['南寮漁港', '風箏', '魚鱗天梯', '竹塹城'] }, [
      section(360, 0, 0, 'town', 'harbor', ['checkpoint', 'townhouse', 'fishboats', 'lamps']),
      section(520, .0041, 4, 'town', 'harbor', ['townhouse', 'promenade', 'fishvillage', 'fishboats']),
      section(500, -.0045, -4, 'grass', 'beach', ['kite', 'palmgroup', 'guardR']),
      section(540, .0047, 5, 'town', 'plaza', ['townhouse', 'templegate', 'lamps']),
      section(500, -.0042, -5, 'farm', 'shore', ['windmill', 'kite', 'tetrapods']),
      section(520, .0038, 4, 'town', 'harbor', ['townhouse', 'fishboats', 'promenade']),
      section(480, -.0031, -4, 'grass', 'beach', ['palmgroup', 'bathers']),
      section(420, 0, 0, 'plaza', 'harbor', ['goal', 'fishboats', 'promenade']),
    ]);
    add('s5m', 's5d', { label: '苗栗・南庄桂花巷', name: '南庄', en: 'NANZHUANG', pano: 'nanzhuang', clouds: 149, goal: '南庄桂花巷', county: '苗栗縣', culture: ['桂花巷', '客家老街', '百年郵局', '山城溪谷'] }, [
      section(360, 0, 0, 'town', 'river', ['checkpoint', 'townhouse', 'hakka', 'lamps']),
      section(520, .0061, 24, 'tea', 'hills', ['teafarm', 'tung', 'hakkavillage']),
      section(500, -.0064, 18, 'mountain', 'river', ['guardR', 'ropebridge', 'tung']),
      section(540, .0067, -12, 'town', 'hills', ['townhouse', 'hakkavillage', 'coffee']),
      section(500, -.0058, 20, 'tea', 'mountain', ['teafarm', 'farmhouse']),
      section(520, .0055, -28, 'mountain', 'river', ['guardR', 'tung']),
      section(480, -.0046, -22, 'town', 'town', ['townhouse', 'hakka', 'lanterns']),
      section(420, 0, 0, 'plaza', 'town', ['goal', 'townhouse', 'hakka', 'lamps']),
    ]);
    add('s5n', 's5b', { label: '新北・九份山城', name: '九份', en: 'JIUFEN', pano: 'jiufen', clouds: 151, goal: '九份紅燈籠茶街', county: '新北市', culture: ['紅燈籠茶樓', '山城階巷', '金瓜石礦業', '陰陽海'] }, [
      section(360, 0, 0, 'town', 'hills', ['checkpoint', 'townhouse', 'jiufen', 'lamps']),
      section(520, .0066, 32, 'mountain', 'cliff', ['guardR', 'coffee', 'redlanterns']),
      section(500, -.0071, 26, 'town', 'cliff', ['townhouse', 'jiufen', 'guardR']),
      section(540, .0068, 20, 'mountain', 'hills', ['lanterns', 'stonehouse', 'guardR']),
      section(500, -.0065, -18, 'town', 'cliff', ['townhouse', 'redlanterns', 'guardR']),
      section(520, .0058, 12, 'hills', 'bay', ['guardR', 'fishvillage', 'coastplants']),
      section(480, -.0051, -16, 'town', 'town', ['townhouse', 'jiufen', 'nightmarket']),
      section(420, 0, 0, 'plaza', 'town', ['goal', 'redlanterns', 'coffee']),
    ]);
    add('s5o', 's5g', { label: '臺東・成功三仙台', name: '三仙台', en: 'SANXIANTAI', pano: 'sanxiantai', clouds: 157, goal: '三仙台八拱橋', county: '臺東縣', culture: ['八拱橋', '成功漁港', '海岸礁岩', '阿美族海洋文化'] }, [
      section(360, 0, 0, 'town', 'shore', ['checkpoint', 'townhouse', 'chenggong', 'fishboats']),
      section(520, .0054, 8, 'hills', 'cliff', ['guardR', 'coastplants', 'tribalgate']),
      section(500, -.0059, -6, 'town', 'harbor', ['townhouse', 'fishvillage', 'chenggong', 'promenade']),
      section(540, .006, 14, 'mountain', 'shore', ['guardR', 'totem', 'amis']),
      section(500, -.0056, -12, 'grass', 'beach', ['palmgroup', 'tetrapods']),
      section(520, .0051, 10, 'town', 'shore', ['townhouse', 'sanxiantai', 'guardR']),
      section(480, -.0044, -8, 'hills', 'cliff', ['coastplants', 'guardR', 'sanxiantai']),
      section(420, 0, 0, 'plaza', 'shore', ['goal', 'sanxiantai', 'totem']),
    ]);
    add('s5p', 's5e', { label: '花蓮・石梯坪海岸', name: '石梯坪', en: 'SHITIPING COAST', pano: 'shitiping', clouds: 163, goal: '石梯坪海蝕平台', county: '花蓮縣', culture: ['海蝕壺穴', '單面山', '石梯漁港', '阿美族聚落'] }, [
      section(360, 0, 0, 'town', 'pebble', ['checkpoint', 'townhouse', 'amis', 'lamps']),
      section(520, .0056, 12, 'mountain', 'cliff', ['guardR', 'coastplants']),
      section(500, -.0062, -8, 'town', 'harbor', ['townhouse', 'fishboats', 'fishvillage', 'promenade']),
      section(540, .0061, 16, 'hills', 'shore', ['guardR', 'totem', 'amis']),
      section(500, -.0058, -12, 'mountain', 'pebble', ['guardR', 'shitipingrocks']),
      section(520, .0053, 8, 'town', 'shore', ['townhouse', 'tribalgate', 'coastplants']),
      section(480, -.0045, -8, 'hills', 'cliff', ['guardR', 'coastplants']),
      section(420, 0, 0, 'plaza', 'shore', ['goal', 'pavilion', 'amis']),
    ]);
    const forks = {
      s1: ['s2n', 's2s'], s2n: ['s3w', 's3m'], s2s: ['s3sm', 's3se'],
      s3w: ['s4a', 's4f'], s3m: ['s4b', 's4g'], s3sm: ['s4c', 's4d'], s3se: ['s4h', 's4e'],
      s4a: ['s5a', 's5b'], s4f: ['s5k', 's5l'], s4b: ['s5c', 's5d'], s4g: ['s5m', 's5n'],
      s4c: ['s5e', 's5f'], s4d: ['s5o', 's5p'], s4h: ['s5g', 's5h'], s4e: ['s5i', 's5j'],
    };
    for (const [id, children] of Object.entries(forks)) {
      stages[id].children = children;
      stages[id].sign = { L: [stages[children[0]].label, '寶島風景線', stages[children[0]].name], R: [stages[children[1]].label, '寶島風景線', stages[children[1]].name] };
    }
    for (const [id, stage] of Object.entries(stages)) {
      stage.tod = id === 's5i' ? ['golden', 'sunset'] : ['day', 'day'];
      stage.time = 95;
    }
  },
};
