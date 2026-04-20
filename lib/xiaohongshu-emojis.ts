export interface XHSEmoji {
  code: string
  name: string
  pinyin: string
  imageUrl?: string
  category: string
  tags?: string[]
}

export interface UnicodeEmoji {
  char: string
  name: string
  category: string
}

export const XHS_EMOJI_CATEGORIES = {
  expression: '😊 表情',
  gesture: '👋 手势',
  action: '🎯 动作',
  object: '🎁 物品',
  special: '🔢 特殊',
} as const

// 顺序与小红书网页版一致
export const XHS_EMOJIS: XHSEmoji[] = [
  // 😊 表情（小红薯角色）
  { code: '[微笑R]',     name: '微笑',     pinyin: 'weixiao',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/9366d16631e3e208689cbc95eefb7cfb0901001e.png', category: 'expression' },
  { code: '[害羞R]',     name: '害羞',     pinyin: 'haixiu',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/219fe9d7e40b14dd7a6712203143bb1f9972bc5c.png', category: 'expression' },
  { code: '[失望R]',     name: '失望',     pinyin: 'shiwang',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b862c8f94da375f55805a97c152efeeb5099c149.png', category: 'expression' },
  { code: '[汗颜R]',     name: '汗颜',     pinyin: 'hanyan',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/87e23e577662f3268362518f7f4e90e30b4ea284.png', category: 'expression' },
  { code: '[哇R]',       name: '哇',       pinyin: 'wa',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/e0771182c12362d41f70356f714d84dccc4d07bc.png', category: 'expression' },
  { code: '[喝奶茶R]',   name: '喝奶茶',   pinyin: 'henaicha',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/364ad5d3e0d5c3b1aa101c9243f488be97d9e8d7.png', category: 'expression' },
  { code: '[自拍R]',     name: '自拍',     pinyin: 'zipai',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d4fe00be555964ddf8301e256cd906b9032679a5.png', category: 'expression' },
  { code: '[偷笑R]',     name: '偷笑',     pinyin: 'touxiao',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d1a34cf8aeac526d36890d3e8f727192a6808ecf.png', category: 'expression' },
  { code: '[飞吻R]',     name: '飞吻',     pinyin: 'feiwen',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/81cedd016ad9d8bef38b2cd0c1e725454df53598.png', category: 'expression' },
  { code: '[石化R]',     name: '石化',     pinyin: 'shihua',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a61db6b1917b6c5c1e8f30bbeea9118a7bdbbe74.png', category: 'expression' },
  { code: '[笑哭R]',     name: '笑哭',     pinyin: 'xiaoku',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ca75b2fc85b0a3e171fe5df1cbf90efdcd3ba571.png', category: 'expression' },
  { code: '[赞R]',       name: '赞',       pinyin: 'zan',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/1b81c5ec3f7006f6b8baf7c006773f5f9d1ab6d7.png', category: 'expression' },
  { code: '[蹲后续H]',   name: '蹲后续',   pinyin: 'dunhuxu',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a633dcf8d48c500ae11532d0583c529b89286c66.webp', category: 'expression' },
  { code: '[暗中观察R]', name: '暗中观察', pinyin: 'anzhongguancha', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/0a9cd643452c7b717b9735a23c550295baa69f02.png', category: 'expression' },
  { code: '[买爆R]',     name: '买爆',     pinyin: 'maibao',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/c402c10ac31e2e024393cfa7ca61d014579d9191.png', category: 'expression' },
  { code: '[大笑R]',     name: '大笑',     pinyin: 'daxiao',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/aed28089f6578522cd490f636955efe6dd27da38.png', category: 'expression' },
  { code: '[色色R]',     name: '色色',     pinyin: 'sese',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/913a9e2c42916a338b9fa20cf780ae435f51acac.png', category: 'expression' },
  { code: '[生气R]',     name: '生气',     pinyin: 'shengqi',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/91515ae9718d8cce4f8de909683011b538d35327.png', category: 'expression' },
  { code: '[哭惹R]',     name: '哭惹',     pinyin: 'kure',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/14b005f7afd5f7c88620478b610bf1de90c4ceab.png', category: 'expression' },
  { code: '[萌萌哒R]',   name: '萌萌哒',   pinyin: 'mengmengda',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/c255f0ae809f8045561a80737b6aec25139f7607.png', category: 'expression' },
  { code: '[斜眼R]',     name: '斜眼',     pinyin: 'xieyan',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/6062be312a922da7998f99fb773e06cea0a640df.png', category: 'expression' },
  { code: '[可怜R]',     name: '可怜',     pinyin: 'kelian',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/36338a7a39e27341b34e845e28561378e9ad1ede.png', category: 'expression' },
  { code: '[鄙视R]',     name: '鄙视',     pinyin: 'bishi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/0dbbe487e5157d9fb720df7e59fe45a7927af647.png', category: 'expression' },
  { code: '[皱眉R]',     name: '皱眉',     pinyin: 'zhoumei',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/fd82d69014a4a50397e20fc6b23ae8dba1c74998.png', category: 'expression' },
  { code: '[抓狂R]',     name: '抓狂',     pinyin: 'zhuakuang',     imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/13619bff18deffe1d2dcc4be0a6ba7ee0394926b.png', category: 'expression' },
  { code: '[捂脸R]',     name: '捂脸',     pinyin: 'wulian',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/83278234fdeb5c36682334f6eb756d243ee62201.png', category: 'expression' },
  { code: '[派对R]',     name: '派对',     pinyin: 'paidui',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/7a6287c7f65fabdc15fa8f06b2696cccc21e86f2.png', category: 'expression' },
  { code: '[吧唧R]',     name: '吧唧',     pinyin: 'baji',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/238271771c806047fc928b6ba49a6d8e7a741e5e.png', category: 'expression' },
  { code: '[惊恐R]',     name: '惊恐',     pinyin: 'jingkong',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/114d21cd3f1b4a1591cc997ddd5976bb0cec8f4c.png', category: 'expression' },
  { code: '[抠鼻R]',     name: '抠鼻',     pinyin: 'koubi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5fd4922d00a004260912247dad6ca7149d8a1f75.png', category: 'expression' },
  { code: '[再见R]',     name: '再见',     pinyin: 'zaijian',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/c34602650951342f09ca6e00d6f4c4ac57208a07.png', category: 'expression' },
  { code: '[叹气R]',     name: '叹气',     pinyin: 'tanqi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5ce63c6024defb2f6334aa153fd0fd238a683779.png', category: 'expression' },
  { code: '[睡觉R]',     name: '睡觉',     pinyin: 'shuijiao',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d98472a962e744dd238f2b4f5dba2665dcb8360b.png', category: 'expression' },
  { code: '[得意R]',     name: '得意',     pinyin: 'deyi',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b02bf85f97acbd6be1749148e163b36920655f92.png', category: 'expression' },
  { code: '[吃瓜R]',     name: '吃瓜',     pinyin: 'chigua',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a38d15b09910f65756d521f1f46031c44694214a.png', category: 'expression' },
  { code: '[扶墙R]',     name: '扶墙',     pinyin: 'fuqiang',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/6eb56b590b5c70e4559cf5bd93056a6e74ffc474.png', category: 'expression' },
  { code: '[黑薯问号R]', name: '黑薯问号', pinyin: 'heishuwenhao',  imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/e4835a534cddad71286ad4e8f0514fded208360d.png', category: 'expression' },
  { code: '[黄金薯R]',   name: '黄金薯',   pinyin: 'huangjinshu',   imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/08b0e51ac813a53bebeb0b9391df5094d4777951.png', category: 'expression' },
  { code: '[吐舌头H]',   name: '吐舌头',   pinyin: 'tushetou',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/e4533cbaa5829c6ffd92992414290987e39ba6be.png', category: 'expression' },
  { code: '[扯脸H]',     name: '扯脸',     pinyin: 'chelian',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d968308cfaf571fbc75cbcd7ec0cefe9150a390a.png', category: 'expression' },
  { code: '[doge]',      name: 'doge',     pinyin: 'doge',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b7c0498189d449e8f22946be494d6bad48eda5ab.png', category: 'expression' },

  // 👋 手势
  { code: '[种草R]',     name: '种草',     pinyin: 'zhongcao',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/035c8044c53dbf7df2cf28d6ec35eb325567121b.png', category: 'gesture' },
  { code: '[拔草R]',     name: '拔草',     pinyin: 'bacao',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/c9e8d66eabeaa823b91e4caeb62088a1521dbe63.png', category: 'gesture' },
  { code: '[点赞R]',     name: '点赞',     pinyin: 'dianzan',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/391438d25580a034707791b5f165c27f8899025a.png', category: 'gesture' },
  { code: '[向右R]',     name: '向右',     pinyin: 'xiangyou',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ae143d3423b5af03ae6b63dc197872ec6a59a6ff.png', category: 'gesture' },
  { code: '[合十R]',     name: '合十',     pinyin: 'heshi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/fbdbb2547a281e18ee9759e3d658d417871996c0.png', category: 'gesture' },
  { code: '[okR]',       name: 'OK',       pinyin: 'ok',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/65bce6a5e07c5adecd8a9660f833266c4cffa0e6.png', category: 'gesture' },
  { code: '[加油R]',     name: '加油',     pinyin: 'jiayou',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ab059229949e73619961c5ee1f7ee10d2318c170.png', category: 'gesture' },
  { code: '[握手R]',     name: '握手',     pinyin: 'woshou',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d0d01ced40255c3855c80fc641b432758c041dea.png', category: 'gesture' },
  { code: '[鼓掌R]',     name: '鼓掌',     pinyin: 'guzhang',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/59bbbe6fc2879f6ef42e63b3264096a9f4d403c7.png', category: 'gesture' },
  { code: '[弱R]',       name: '弱',       pinyin: 'ruo',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ab298d8a629530f3bb98b94718acb6f20b2cbc66.png', category: 'gesture' },
  { code: '[耶R]',       name: '耶',       pinyin: 'ye',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b7d3bb36a6422f92f2447f2b300d3aff0b7baa21.png', category: 'gesture' },
  { code: '[抱拳R]',     name: '抱拳',     pinyin: 'baoquan',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/0ae972c2da43acd565596fb0234c558f84b0a390.png', category: 'gesture' },
  { code: '[勾引R]',     name: '勾引',     pinyin: 'gouyin',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/0b219f805826238b85eb114bb1781bf5d5808cbf.png', category: 'gesture' },
  { code: '[拳头R]',     name: '拳头',     pinyin: 'quantou',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/20bb351c9538975e1a3b8ec4aa5821ad9d6f2215.png', category: 'gesture' },
  { code: '[拥抱R]',     name: '拥抱',     pinyin: 'yongbao',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/efc3b7a9e6df5d2be0233e203adf0d1110623441.png', category: 'gesture' },
  { code: '[举手R]',     name: '举手',     pinyin: 'jushou',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/84320b00dda66dcb661b5fb5d75ded2de4754b0a.png', category: 'gesture' },

  // 🎯 动作
  { code: '[露营R]',     name: '露营',     pinyin: 'luying',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/bc046729a7265fa579fb9c26289f9e9fcaa83beb.png', category: 'action' },
  { code: '[猪头R]',     name: '猪头',     pinyin: 'zhutou',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/e7eae4ef972a29818a56d6e00f85304152a58430.png', category: 'action' },
  { code: '[老虎R]',     name: '老虎',     pinyin: 'laohu',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/f6d52ce0dd3bfa963a5a624e9da8417d02c9f752.png', category: 'action' },
  { code: '[集美R]',     name: '集美',     pinyin: 'jimei',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/124387198d229cb5aa2be5dd74db4af820e85dcd/xhs_theme_xy_emotion_redmoji_jimei.png', category: 'action' },
  { code: '[仙女R]',     name: '仙女',     pinyin: 'xiannv',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/3a0d4108b32e366f7438d448a8157e9e4247e5b3/xhs_theme_xy_emotion_redmoji_xiannv.png', category: 'action' },
  { code: '[红书R]',     name: '红书',     pinyin: 'hongshu2',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/182d040c46942e0ba1c8eeb66bf7047dad751e72.png', category: 'action' },
  { code: '[开箱R]',     name: '开箱',     pinyin: 'kaixiang',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/200ada9354c5c974164bffa594ad4e33614404aa.png', category: 'action' },
  { code: '[探店R]',     name: '探店',     pinyin: 'tanding',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b9dfa6d9e5cb81b2f0bdd77e14b1841608c03224.png', category: 'action' },
  { code: '[ootdR]',     name: 'OOTD',     pinyin: 'ootd',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/595650f7fb0ee6a475c6bdbe4d6a707524ed9c90.png', category: 'action' },
  { code: '[同款R]',     name: '同款',     pinyin: 'tongkuan',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/1a573c081b4aad6814c23a33d51c86a69670b90f.png', category: 'action' },
  { code: '[打卡R]',     name: '打卡',     pinyin: 'daka',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/89214fad0c95300ab58a96037fddafa0415d387e.png', category: 'action' },
  { code: '[飞机R]',     name: '飞机',     pinyin: 'feiji',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/9ac94463031f15e8c73db4a457a35ac473822a00.png', category: 'action' },
  { code: '[拍立得R]',   name: '拍立得',   pinyin: 'pailidei',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d87604b3ab8b56e98023ae582deea40230595fcc.png', category: 'action' },
  { code: '[薯券R]',     name: '薯券',     pinyin: 'shuquan',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/080302ac0fd8f847753853c50cd0cf00709c4419.png', category: 'action' },
  { code: '[优惠券R]',   name: '优惠券',   pinyin: 'youhuiquan',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/68ef659532ab68296aa14f89e29829da4d9aed5a.png', category: 'action' },
  { code: '[购物车R]',   name: '购物车',   pinyin: 'gouwuche',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/3598e9b2a43cd1ca6ec4b4dc7670541c7bdda2fa.png', category: 'action' },
  { code: '[kissR]',     name: 'kiss',     pinyin: 'kiss',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/071e9c9d731ce31f5ece64babda5f3d4d9207496.png', category: 'action' },
  { code: '[礼物R]',     name: '礼物',     pinyin: 'liwu',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/39e0ed44f24bd2d211161a5086705ab1d4439c41.png', category: 'action' },
  { code: '[生日蛋糕R]', name: '生日蛋糕', pinyin: 'shengridangao', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/259be907840312a7013dae79ff6f99012dabe24b.png', category: 'action' },
  { code: '[私信R]',     name: '私信',     pinyin: 'sixin',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/2062069d03c2927cc823ad0f65c4db645e968058.png', category: 'action' },
  { code: '[请文明R]',   name: '请文明',   pinyin: 'qingwenming',   imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d070fee56c6069ac246ffb0cba1eaf3609df9680.png', category: 'action' },
  { code: '[请友好R]',   name: '请友好',   pinyin: 'qingyouhao',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5c4d2abd9058163b496e054d7448d91c212282d3.png', category: 'action' },
  { code: '[氛围感R]',   name: '氛围感',   pinyin: 'fenweigan',     imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/acad9319c8ad606833872094506ebbfffd321344.png', category: 'action' },
  { code: '[清单R]',     name: '清单',     pinyin: 'qingdan',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/20eab20210e0958b0da33174b7f4606eca92b92b.png', category: 'action' },
  { code: '[电影R]',     name: '电影',     pinyin: 'dianying',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/3eec7a10e8cf68f44dbcb930ecb05f2927f8ae1e.png', category: 'action' },
  { code: '[学生党R]',   name: '学生党',   pinyin: 'xueshengdang',  imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/04984e414827730e5689900e1e45d3fd0c50a6d6.png', category: 'action' },

  // 🎁 物品
  { code: '[彩虹R]',     name: '彩虹',     pinyin: 'caihong',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5862336b380dc7bd68f068e19b8ef613b7913c3d.png', category: 'object' },
  { code: '[爆炸R]',     name: '爆炸',     pinyin: 'baozha',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/58ed0344253015243334e5b1fd6b642ee3e0346c.png', category: 'object' },
  { code: '[炸弹R]',     name: '炸弹',     pinyin: 'zhadan',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/403d2c9ede2e95cb8b82dd348da4b2aac0bf9d62.png', category: 'object' },
  { code: '[火R]',       name: '火',       pinyin: 'huo',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/51f1d8e7c5b4182c05510f3aeadecee19e968b42.png', category: 'object' },
  { code: '[啤酒R]',     name: '啤酒',     pinyin: 'pijiu',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/9e71d86b28f1ba48b58291b53bf6156810fb9377.png', category: 'object' },
  { code: '[咖啡R]',     name: '咖啡',     pinyin: 'kafei',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b3b5dbb3a564a68115a4343fe536a20e34d3c953.png', category: 'object' },
  { code: '[钱袋R]',     name: '钱袋',     pinyin: 'qiandai',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/026f431acf58d6d2a19963a68dbf70c53359eada.png', category: 'object' },
  { code: '[流汗R]',     name: '流汗',     pinyin: 'liuhan',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/4fc14b31e947deec15d0a1b3f96ae57214ab2bb2.png', category: 'object' },
  { code: '[发R]',       name: '发',       pinyin: 'fa',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/8a61d522a0a19e51280b780af24d2cf972195d24.png', category: 'object' },
  { code: '[红包R]',     name: '红包',     pinyin: 'hongbao',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d708e5bb8b0d5e1a0628a3e2324bfde507736f1c.png', category: 'object' },
  { code: '[福R]',       name: '福',       pinyin: 'fu',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/7d0da07b800a4b999e06ce66759336be05f3f3a0.png', category: 'object' },
  { code: '[鞭炮R]',     name: '鞭炮',     pinyin: 'bianpao',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/3415b947b0b66b01c4fabdec2b729c34a5f8a0b2.png', category: 'object' },
  { code: '[庆祝R]',     name: '庆祝',     pinyin: 'qingzhu',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/51eab29d66493ab028e9a446c6c10fa606e1e412.png', category: 'object' },
  { code: '[烟花R]',     name: '烟花',     pinyin: 'yanhua',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/64071df3b7c40545149a1d26fcfdf0e704c96c2c.png', category: 'object' },
  { code: '[气球R]',     name: '气球',     pinyin: 'qiqiu',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a57b1e6f8e48ac2a4171afe620df545dd760fd08.png', category: 'object' },
  { code: '[看R]',       name: '看',       pinyin: 'kan',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/f3c0659718c26f36ca3d57466c9cc0a9120e52f8.png', category: 'object' },
  { code: '[新月R]',     name: '新月',     pinyin: 'xinyue',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a1493a29d6a4b63caa73a2a2af4706186dbccd6b.png', category: 'object' },
  { code: '[满月R]',     name: '满月',     pinyin: 'manyue',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/bf117e6b7458e3bec281b34d9ed767aed94cdc40.png', category: 'object' },
  { code: '[大便R]',     name: '大便',     pinyin: 'dabian',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/82e3b1495613b1c173c8a5d4efcd9cc32ecfb6b9.png', category: 'object' },
  { code: '[太阳R]',     name: '太阳',     pinyin: 'taiyang',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/fe0276430f14dad6b791528ba3acd0c541998a28.png', category: 'object' },
  { code: '[晚安R]',     name: '晚安',     pinyin: 'wanan',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/937f70403d7a0b65d0b42fcd67e0efd8618c3d05.png', category: 'object' },
  { code: '[星R]',       name: '星',       pinyin: 'xing',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b98fbe9d7371faf3ff43342f166297cf6446531d.png', category: 'object' },
  { code: '[玫瑰R]',     name: '玫瑰',     pinyin: 'meigui',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/abc0a1cd8434c5348e89e887cf8a4f93f352558c.png', category: 'object' },
  { code: '[凋谢R]',     name: '凋谢',     pinyin: 'diaoxie',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5f58213013b6d97a190fc42b1e2aed344e746ba3.png', category: 'object' },
  { code: '[郁金香R]',   name: '郁金香',   pinyin: 'yujinxiang',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ee78f61c5c20e159e97bee4612bc2089c358f33b.png', category: 'object' },
  { code: '[樱花R]',     name: '樱花',     pinyin: 'yinghua',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ef50e51cb37c948b56dc856fed12e5643597c1dc.png', category: 'object' },
  { code: '[海豚R]',     name: '海豚',     pinyin: 'haitun',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/b1a4ebde71f735db6c2f45dfce4e23126fc28c32.png', category: 'object' },
  { code: '[放大镜R]',   name: '放大镜',   pinyin: 'fangdajing',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/257c99be653d2ccc3f25b7426aa1e5a269e85421.png', category: 'object' },
  { code: '[刀R]',       name: '刀',       pinyin: 'dao',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/a4d581be51146d70d81679d603d579da040e7183.png', category: 'object' },
  { code: '[辣椒R]',     name: '辣椒',     pinyin: 'lajiao',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/9ad29f04bb78c2551f3e5d57425618a78455b20e.png', category: 'object' },
  { code: '[黄瓜R]',     name: '黄瓜',     pinyin: 'huanggua',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/c15e57a392c37774bfa119af17cfc4f1c5b9ec70.png', category: 'object' },
  { code: '[葡萄R]',     name: '葡萄',     pinyin: 'putao',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5978958778577a9baa16b93cc0979d9d70291919.png', category: 'object' },
  { code: '[草莓R]',     name: '草莓',     pinyin: 'caomei',        imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d29f5474efafbe34835214c37c42f6159fbba789.png', category: 'object' },
  { code: '[桃子R]',     name: '桃子',     pinyin: 'taozi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/4d64f9e067d75a9722f46d8f858d7afbb43908ed.png', category: 'object' },
  { code: '[红薯R]',     name: '红薯',     pinyin: 'hongshu',       imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/bfb8a6309b8b42af2cf7c8ce20d1d4fb9a64b512.png', category: 'object' },
  { code: '[栗子R]',     name: '栗子',     pinyin: 'lizi',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/3160dda81f09abd55fc26312a53f5945cd975834.png', category: 'object' },
  { code: '[红色心形R]', name: '红色心形', pinyin: 'hongsexinxing', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d6125900d5de3969a1bb075e23d361c4bd78b0eb.png', category: 'object' },
  { code: '[黄色心形R]', name: '黄色心形', pinyin: 'huangsexinxing',imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/5421d25d7566afe3fbd5a91c9e704ea2afa4a639.png', category: 'object' },
  { code: '[绿色心形R]', name: '绿色心形', pinyin: 'lvsexinxing',   imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d384e2e381f4c96257b29ccc054d70d82af786f7.png', category: 'object' },
  { code: '[蓝色心形R]', name: '蓝色心形', pinyin: 'lansexinxing',  imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/284e12f435d3c09056dd264384adbdbb82833c15.png', category: 'object' },
  { code: '[紫色心形R]', name: '紫色心形', pinyin: 'zisexinxing',   imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/ca6e9a1c66a32bd7f2c5c49f1b51507c8f16c902.png', category: 'object' },
  { code: '[爱心R]',     name: '爱心',     pinyin: 'aixin',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/fc7cec55e0e1a0ffd8668d89ea2921c23c63539e.png', category: 'object' },
  { code: '[两颗心R]',   name: '两颗心',   pinyin: 'liangkexin',    imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/58b58fa86c33cf358b83aef0e5c9a89298cbc1e4.png', category: 'object' },

  // 🔢 特殊
  { code: '[浅肤色R]',   name: '浅肤色',   pinyin: 'qianfuse',      imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/691d1d3544521be6fa0ffbf58d6a9743d5303a16.png', category: 'special' },
  { code: '[中浅肤色R]', name: '中浅肤色', pinyin: 'zhongqianfuse', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/573a26c25f11bacad6a6e266833fdf21fe893e17.png', category: 'special' },
  { code: '[中等肤色R]', name: '中等肤色', pinyin: 'zhongdengfuse', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/e24ca827231348b427b5b3e0b0c6675f9eced27b.png', category: 'special' },
  { code: '[中深肤色R]', name: '中深肤色', pinyin: 'zhongshenfuse', imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/414cc459c8d22b93b79e97b76b0f4a906557c564.png', category: 'special' },
  { code: '[有R]',       name: '有',       pinyin: 'you',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/6c4ed27842a186f3a89a65f74cc9b3984e12e5e6.png', category: 'special' },
  { code: '[可R]',       name: '可',       pinyin: 'ke',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/1901af71ad54c620e4c2d895fb6a2af28cd83ca5.png', category: 'special' },
  { code: '[蹲R]',       name: '蹲',       pinyin: 'dun',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/682af0d49dcf04c340abff12b81558621850b900.png', category: 'special' },
  { code: '[零R]',       name: '零',       pinyin: 'ling',          imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/51f0fc07ddd7d44751b41d53f102114fd7255881.png', category: 'special' },
  { code: '[一R]',       name: '一',       pinyin: 'yi',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/1f6bad36efca7e77f20e5c0339c44564cf0a6fa0.png', category: 'special' },
  { code: '[二R]',       name: '二',       pinyin: 'er',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/bdb8a0f60e918177ee4de71aebced4a68658f545.png', category: 'special' },
  { code: '[三R]',       name: '三',       pinyin: 'san',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/f41145ef41eaf9f8d42e208cace1f2a0f9ed602b.png', category: 'special' },
  { code: '[四R]',       name: '四',       pinyin: 'si',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/9e3c5dc71bee8d45b9be5ffe63554abf86512fe1.png', category: 'special' },
  { code: '[五R]',       name: '五',       pinyin: 'wu',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d8c24a51ffbe618a13fc19748e0d4e7cf80dba78.png', category: 'special' },
  { code: '[六R]',       name: '六',       pinyin: 'liu',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/55962ff13b3cb8cc3388d5acd8627d8aa40b8fb8.png', category: 'special' },
  { code: '[七R]',       name: '七',       pinyin: 'qi',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/4d19093baf638f86987d9ccb9f530060b573d5a0.png', category: 'special' },
  { code: '[八R]',       name: '八',       pinyin: 'ba',            imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d245ba7b1bdc7f73928e282194acc654b10a3bbb.png', category: 'special' },
  { code: '[九R]',       name: '九',       pinyin: 'jiu',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/bdd4d21ae715040c7afb737317797266ef14f727.png', category: 'special' },
  { code: '[加一R]',     name: '+1',       pinyin: 'jiayi',         imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/d5f1bbb77a939d7521ebe80439b39a77f05310ff.png', category: 'special' },
  { code: '[满R]',       name: '满',       pinyin: 'man',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/6775ba4a34325edc384a932c5aa9ff4b7be059d4.png', category: 'special' },
  { code: '[禁R]',       name: '禁',       pinyin: 'jin',           imageUrl: 'https://picasso-static.xiaohongshu.com/fe-platform/f168e3aa080bff213e57b5b8367b4fb161e99ce8.png', category: 'special' },
]

// ─── 通用表情（微信风格 Unicode）─────────────────────────────
export const UNICODE_EMOJI_CATEGORIES = {
  face:        '😊 表情',
  gesture:     '👍 手势',
  love:        '❤️ 爱心',
  nature:      '🌸 自然',
  celebration: '🎉 庆祝',
  food:        '🍕 美食',
  travel:      '✈️ 旅行',
} as const

export const UNICODE_EMOJIS: UnicodeEmoji[] = [
  // 😊 面部表情
  { char: '😀', name: '大笑',     category: 'face' },
  { char: '😁', name: '嘻嘻',     category: 'face' },
  { char: '😂', name: '笑哭',     category: 'face' },
  { char: '🤣', name: '笑倒',     category: 'face' },
  { char: '😃', name: '哈哈',     category: 'face' },
  { char: '😄', name: '开心',     category: 'face' },
  { char: '😅', name: '苦笑',     category: 'face' },
  { char: '😆', name: '眯眼笑',   category: 'face' },
  { char: '😉', name: '眨眼',     category: 'face' },
  { char: '😊', name: '微笑',     category: 'face' },
  { char: '😋', name: '馋嘴',     category: 'face' },
  { char: '😎', name: '耍酷',     category: 'face' },
  { char: '😍', name: '花痴',     category: 'face' },
  { char: '🥰', name: '心心眼',   category: 'face' },
  { char: '😘', name: '飞吻',     category: 'face' },
  { char: '🤩', name: '星星眼',   category: 'face' },
  { char: '🥳', name: '派对脸',   category: 'face' },
  { char: '🤗', name: '拥抱',     category: 'face' },
  { char: '🤔', name: '思考',     category: 'face' },
  { char: '🤨', name: '挑眉',     category: 'face' },
  { char: '😐', name: '冷漠',     category: 'face' },
  { char: '😑', name: '无语',     category: 'face' },
  { char: '😶', name: '沉默',     category: 'face' },
  { char: '🙄', name: '翻白眼',   category: 'face' },
  { char: '😏', name: '坏笑',     category: 'face' },
  { char: '😒', name: '不屑',     category: 'face' },
  { char: '😞', name: '失落',     category: 'face' },
  { char: '😔', name: '低落',     category: 'face' },
  { char: '😟', name: '担心',     category: 'face' },
  { char: '😕', name: '困惑',     category: 'face' },
  { char: '🙁', name: '不开心',   category: 'face' },
  { char: '☹️', name: '皱眉',     category: 'face' },
  { char: '😣', name: '痛苦',     category: 'face' },
  { char: '😖', name: '崩溃',     category: 'face' },
  { char: '😫', name: '累了',     category: 'face' },
  { char: '😩', name: '很累',     category: 'face' },
  { char: '🥺', name: '可怜',     category: 'face' },
  { char: '😢', name: '流泪',     category: 'face' },
  { char: '😭', name: '大哭',     category: 'face' },
  { char: '😤', name: '生气',     category: 'face' },
  { char: '😠', name: '愤怒',     category: 'face' },
  { char: '😡', name: '暴怒',     category: 'face' },
  { char: '🤬', name: '爆粗口',   category: 'face' },
  { char: '🤯', name: '爆头',     category: 'face' },
  { char: '😳', name: '脸红',     category: 'face' },
  { char: '🥵', name: '太热',     category: 'face' },
  { char: '🥶', name: '太冷',     category: 'face' },
  { char: '😱', name: '吓到',     category: 'face' },
  { char: '😨', name: '恐惧',     category: 'face' },
  { char: '😰', name: '冷汗',     category: 'face' },
  { char: '😓', name: '汗颜',     category: 'face' },
  { char: '🤪', name: '疯了',     category: 'face' },
  { char: '😵', name: '头晕',     category: 'face' },
  { char: '🥴', name: '迷糊',     category: 'face' },
  { char: '😪', name: '困意',     category: 'face' },
  { char: '😴', name: '睡觉',     category: 'face' },
  { char: '🥱', name: '打哈欠',   category: 'face' },
  { char: '🤤', name: '流口水',   category: 'face' },
  { char: '😷', name: '生病',     category: 'face' },
  { char: '🤒', name: '发烧',     category: 'face' },
  { char: '🤕', name: '受伤',     category: 'face' },
  { char: '🤢', name: '恶心',     category: 'face' },
  { char: '🤮', name: '呕吐',     category: 'face' },
  { char: '🤧', name: '打喷嚏',   category: 'face' },
  { char: '🤑', name: '发财',     category: 'face' },
  { char: '😈', name: '恶魔',     category: 'face' },
  { char: '😇', name: '天使',     category: 'face' },

  // 👍 手势
  { char: '👍', name: '赞',       category: 'gesture' },
  { char: '👎', name: '踩',       category: 'gesture' },
  { char: '👏', name: '鼓掌',     category: 'gesture' },
  { char: '🙌', name: '好棒',     category: 'gesture' },
  { char: '🤝', name: '握手',     category: 'gesture' },
  { char: '✊', name: '握拳',     category: 'gesture' },
  { char: '👊', name: '拳头',     category: 'gesture' },
  { char: '🤜', name: '碰拳右',   category: 'gesture' },
  { char: '🤛', name: '碰拳左',   category: 'gesture' },
  { char: '✋', name: '手掌',     category: 'gesture' },
  { char: '👋', name: '挥手',     category: 'gesture' },
  { char: '🤚', name: '举手',     category: 'gesture' },
  { char: '🙏', name: '祈祷',     category: 'gesture' },
  { char: '👌', name: 'OK',       category: 'gesture' },
  { char: '✌️', name: 'V',        category: 'gesture' },
  { char: '🤞', name: '交叉手指', category: 'gesture' },
  { char: '🤟', name: '我爱你',   category: 'gesture' },
  { char: '🤘', name: '摇滚',     category: 'gesture' },
  { char: '🤙', name: '打电话',   category: 'gesture' },
  { char: '👈', name: '指左',     category: 'gesture' },
  { char: '👉', name: '指右',     category: 'gesture' },
  { char: '👆', name: '指上',     category: 'gesture' },
  { char: '👇', name: '指下',     category: 'gesture' },
  { char: '☝️', name: '第一',     category: 'gesture' },
  { char: '💪', name: '肌肉',     category: 'gesture' },
  { char: '🫶', name: '比心',     category: 'gesture' },
  { char: '👐', name: '张开手',   category: 'gesture' },
  { char: '🤲', name: '双手',     category: 'gesture' },

  // ❤️ 爱心
  { char: '❤️', name: '红心',     category: 'love' },
  { char: '🧡', name: '橙心',     category: 'love' },
  { char: '💛', name: '黄心',     category: 'love' },
  { char: '💚', name: '绿心',     category: 'love' },
  { char: '💙', name: '蓝心',     category: 'love' },
  { char: '💜', name: '紫心',     category: 'love' },
  { char: '🖤', name: '黑心',     category: 'love' },
  { char: '🤍', name: '白心',     category: 'love' },
  { char: '🤎', name: '棕心',     category: 'love' },
  { char: '💔', name: '心碎',     category: 'love' },
  { char: '❣️', name: '感叹心',   category: 'love' },
  { char: '💕', name: '双心',     category: 'love' },
  { char: '💞', name: '旋转心',   category: 'love' },
  { char: '💓', name: '心跳',     category: 'love' },
  { char: '💗', name: '粉心',     category: 'love' },
  { char: '💖', name: '闪耀心',   category: 'love' },
  { char: '💘', name: '心箭',     category: 'love' },
  { char: '💝', name: '礼物心',   category: 'love' },
  { char: '💟', name: '心形装饰', category: 'love' },
  { char: '♥️', name: '花色心',   category: 'love' },
  { char: '✨', name: '闪光',     category: 'love' },
  { char: '💫', name: '星星',     category: 'love' },
  { char: '⭐', name: '星',       category: 'love' },
  { char: '🌟', name: '发光星',   category: 'love' },
  { char: '💯', name: '百分',     category: 'love' },

  // 🌸 自然
  { char: '🌸', name: '樱花',     category: 'nature' },
  { char: '🌺', name: '芙蓉',     category: 'nature' },
  { char: '🌻', name: '向日葵',   category: 'nature' },
  { char: '🌹', name: '玫瑰',     category: 'nature' },
  { char: '🌷', name: '郁金香',   category: 'nature' },
  { char: '🌼', name: '雏菊',     category: 'nature' },
  { char: '💐', name: '鲜花',     category: 'nature' },
  { char: '🍀', name: '四叶草',   category: 'nature' },
  { char: '🌿', name: '绿叶',     category: 'nature' },
  { char: '🍃', name: '叶子',     category: 'nature' },
  { char: '🍁', name: '枫叶',     category: 'nature' },
  { char: '🌈', name: '彩虹',     category: 'nature' },
  { char: '☀️', name: '太阳',     category: 'nature' },
  { char: '🌙', name: '月亮',     category: 'nature' },
  { char: '⚡', name: '闪电',     category: 'nature' },
  { char: '🔥', name: '火焰',     category: 'nature' },
  { char: '💧', name: '水滴',     category: 'nature' },
  { char: '❄️', name: '雪花',     category: 'nature' },
  { char: '🌊', name: '海浪',     category: 'nature' },
  { char: '🌤️', name: '晴天',     category: 'nature' },
  { char: '⛅', name: '多云',     category: 'nature' },
  { char: '🌧️', name: '下雨',     category: 'nature' },
  { char: '🌨️', name: '下雪',     category: 'nature' },

  // 🎉 庆祝活动
  { char: '🎉', name: '派对',     category: 'celebration' },
  { char: '🎊', name: '礼花',     category: 'celebration' },
  { char: '🎈', name: '气球',     category: 'celebration' },
  { char: '🎁', name: '礼物',     category: 'celebration' },
  { char: '🎀', name: '蝴蝶结',   category: 'celebration' },
  { char: '🏆', name: '奖杯',     category: 'celebration' },
  { char: '🥇', name: '金牌',     category: 'celebration' },
  { char: '🥈', name: '银牌',     category: 'celebration' },
  { char: '🥉', name: '铜牌',     category: 'celebration' },
  { char: '🎯', name: '目标',     category: 'celebration' },
  { char: '🎮', name: '游戏',     category: 'celebration' },
  { char: '🎬', name: '电影',     category: 'celebration' },
  { char: '🎤', name: '麦克风',   category: 'celebration' },
  { char: '🎧', name: '耳机',     category: 'celebration' },
  { char: '🎵', name: '音符',     category: 'celebration' },
  { char: '🎶', name: '音乐',     category: 'celebration' },
  { char: '🎨', name: '调色盘',   category: 'celebration' },
  { char: '📸', name: '拍照',     category: 'celebration' },
  { char: '📷', name: '相机',     category: 'celebration' },
  { char: '💎', name: '钻石',     category: 'celebration' },
  { char: '👑', name: '皇冠',     category: 'celebration' },
  { char: '🌟', name: '明星',     category: 'celebration' },
  { char: '🔔', name: '铃铛',     category: 'celebration' },
  { char: '📣', name: '喇叭',     category: 'celebration' },
  { char: '✅', name: '对勾',     category: 'celebration' },

  // 🍕 美食
  { char: '🍕', name: '披萨',     category: 'food' },
  { char: '🍔', name: '汉堡',     category: 'food' },
  { char: '🍟', name: '薯条',     category: 'food' },
  { char: '🌮', name: '墨西哥卷', category: 'food' },
  { char: '🍜', name: '拉面',     category: 'food' },
  { char: '🍝', name: '意面',     category: 'food' },
  { char: '🍣', name: '寿司',     category: 'food' },
  { char: '🍱', name: '便当',     category: 'food' },
  { char: '🥟', name: '饺子',     category: 'food' },
  { char: '🍛', name: '咖喱',     category: 'food' },
  { char: '🍲', name: '火锅',     category: 'food' },
  { char: '🥗', name: '沙拉',     category: 'food' },
  { char: '🍰', name: '蛋糕',     category: 'food' },
  { char: '🎂', name: '生日蛋糕', category: 'food' },
  { char: '🧁', name: '纸杯蛋糕', category: 'food' },
  { char: '🍩', name: '甜甜圈',   category: 'food' },
  { char: '🍪', name: '饼干',     category: 'food' },
  { char: '🍫', name: '巧克力',   category: 'food' },
  { char: '🍬', name: '糖果',     category: 'food' },
  { char: '🍭', name: '棒棒糖',   category: 'food' },
  { char: '🍦', name: '冰淇淋',   category: 'food' },
  { char: '🧋', name: '奶茶',     category: 'food' },
  { char: '☕', name: '咖啡',     category: 'food' },
  { char: '🍵', name: '茶',       category: 'food' },
  { char: '🥤', name: '饮料',     category: 'food' },
  { char: '🍺', name: '啤酒',     category: 'food' },
  { char: '🥂', name: '香槟',     category: 'food' },
  { char: '🍷', name: '红酒',     category: 'food' },

  // ✈️ 旅行
  { char: '✈️', name: '飞机',     category: 'travel' },
  { char: '🚀', name: '火箭',     category: 'travel' },
  { char: '🚂', name: '火车',     category: 'travel' },
  { char: '🚗', name: '汽车',     category: 'travel' },
  { char: '🚢', name: '轮船',     category: 'travel' },
  { char: '🏔️', name: '山峰',     category: 'travel' },
  { char: '🌋', name: '火山',     category: 'travel' },
  { char: '🏖️', name: '海滩',     category: 'travel' },
  { char: '🏕️', name: '露营',     category: 'travel' },
  { char: '🏝️', name: '小岛',     category: 'travel' },
  { char: '🌍', name: '地球',     category: 'travel' },
  { char: '🗺️', name: '地图',     category: 'travel' },
  { char: '🧭', name: '指南针',   category: 'travel' },
  { char: '🏰', name: '城堡',     category: 'travel' },
  { char: '🏯', name: '日本城',   category: 'travel' },
  { char: '⛪', name: '教堂',     category: 'travel' },
  { char: '🕌', name: '清真寺',   category: 'travel' },
  { char: '🗼', name: '铁塔',     category: 'travel' },
  { char: '🗽', name: '自由女神', category: 'travel' },
  { char: '🎡', name: '摩天轮',   category: 'travel' },
  { char: '🎢', name: '过山车',   category: 'travel' },
  { char: '🌉', name: '夜桥',     category: 'travel' },
  { char: '🌆', name: '城市',     category: 'travel' },
  { char: '🌄', name: '日出',     category: 'travel' },
  { char: '🌅', name: '日落',     category: 'travel' },
  { char: '🧳', name: '行李箱',   category: 'travel' },
  { char: '🎫', name: '门票',     category: 'travel' },
  { char: '📍', name: '位置',     category: 'travel' },
]

// ─── XHS 官方表情工具函数 ────────────────────────────────────
export function getEmojisByCategory(category: string): XHSEmoji[] {
  return XHS_EMOJIS.filter(e => e.category === category)
}

export function searchEmojisByName(keyword: string): XHSEmoji[] {
  return XHS_EMOJIS.filter(e =>
    e.name.includes(keyword) || e.code.includes(keyword)
  )
}

export function getHotEmojis(): XHSEmoji[] {
  const hotCodes = [
    '[微笑R]', '[笑哭R]', '[萌萌哒R]', '[暗中观察R]', '[买爆R]',
    '[得意R]', '[哭惹R]', '[吃瓜R]', '[蹲后续H]', '[doge]',
    '[种草R]', '[拔草R]', '[点赞R]', '[打卡R]', '[探店R]',
    '[开箱R]', '[集美R]', '[爱心R]', '[红包R]', '[派对R]',
  ]
  return XHS_EMOJIS.filter(e => hotCodes.includes(e.code))
}

// ─── 通用 Unicode 表情工具函数 ──────────────────────────────
export function getUnicodeEmojisByCategory(category: string): UnicodeEmoji[] {
  return UNICODE_EMOJIS.filter(e => e.category === category)
}

export function searchUnicodeEmojis(keyword: string): UnicodeEmoji[] {
  return UNICODE_EMOJIS.filter(e => e.name.includes(keyword) || e.char.includes(keyword))
}

export function getHotUnicodeEmojis(): UnicodeEmoji[] {
  const hot = ['❤️','😂','🥰','😭','🤣','✨','😊','🎉','💕','🙏','😍','😁','👍','🔥','💯','🌸','🥺','😅','🤔','😏']
  return UNICODE_EMOJIS.filter(e => hot.includes(e.char))
}

export function getAllCategories() {
  return Object.entries(XHS_EMOJI_CATEGORIES).map(([key, name]) => ({ key, name }))
}

export function renderEmojiText(text: string): string {
  return text
}

export function hasXHSEmoji(text: string): boolean {
  return /\[.+?[RH]\]|\[doge\]/.test(text)
}

export function extractEmojis(text: string): string[] {
  return text.match(/\[.+?[RH]\]|\[doge\]/g) || []
}
