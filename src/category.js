// Sort a deal title into one simple category people understand at a glance.
// Order matters: the first matching category wins.

export const CATEGORIES = [
  ['外卖餐饮', /外卖|美团|饿了么|瑞幸|库迪|咖啡|奶茶|喜茶|霸王茶姬|蜜雪|kfc|肯德基|麦当劳|必胜客|汉堡王|星巴克|快餐|堂食|团购|餐券/i],
  ['银行支付', /立减金|银行|工行|建行|农行|中行|招行|交行|邮储|信用卡|银行卡|zfb|支付宝|微信支付|云闪付|数字人民币|红包|返现|话费|流量|缴费|京东plus|88vip|开卡/i],
  ['会员影音', /会员|vip|爱奇艺|腾讯视频|优酷|芒果|b站|bilibili|网易云|qq音乐|酷狗|喜马拉雅|网盘|视频月卡|年卡/i],
  ['母婴儿童', /母婴|宝宝|婴儿|儿童|孩子|小孩|奶粉|尿不湿|纸尿裤|扭扭车|玩具|童装|童鞋/],
  ['美妆个护', /隔离|粉底|遮瑕|口红|唇|眼影|睫毛|面膜|精华|面霜|乳液|水乳|爽肤水|洁面|洗面奶|黑头|防晒|卸妆|护手霜|身体乳|冷霜|香水|洗发|护发|沐浴|牙膏|牙刷|漱口|剃须|卫生巾|美妆|护肤/],
  ['服饰鞋包', /内裤|内衣|袜|打底|毛衣|卫衣|羽绒|外套|大衣|冲锋衣|裤|裙|衬衫|t恤|鞋|靴|帽|围巾|手套|包包|背包|书包|探路者|优衣库|衣服|服装|穿/i],
  ['数码家电', /充电宝|充电器|数据线|耳机|耳夹|音箱|手机|平板|电脑|笔记本|键盘|鼠标|显示器|相机|手表|手环|吹风机|电动牙刷|电热毯|取暖器|电暖|空调|冰箱|洗衣机(?!清|槽)|扫地|吸尘|电饭煲|空气炸锅|电动车|充电|电器|数码/],
  ['零食生鲜', /零食|饼干|曲奇|薯片|坚果|巧克力|糖|酸奶|牛奶|奶|鸡蛋|蛋|麦片|燕麦|面包|蛋糕|烤肠|腊肠|香肠|肉|牛排|鸡|虾|鱼|水果|苹果|橙|橘|车厘子|草莓|大米|米|面|螺蛳粉|方便面|饮料|可乐|矿泉水|茶|酒|食品|吃/],
  ['运动户外', /哑铃|瑜伽|健身|跑步|跳绳|露营|帐篷|骑行|自行车|羽毛球|篮球|足球|游泳|keep|迪卡侬/i],
  ['日用家居', /纸巾|厕纸|湿厕纸|泡脚|足浴|抽纸|卷纸|湿巾|洗衣|洗衣液|凝珠|清洁|清洗剂|消毒|垃圾袋|保鲜|收纳|置物|推车|拖把|毛巾|浴巾|床品|被子|枕头|四件套|暖贴|暖宝宝|雨伞|杯|锅|碗|厨房|家居|日用/],
];
export const OTHER = '其他';
export const ALL_CATEGORIES = [...CATEGORIES.map(([name]) => name), OTHER];

export function categorize(title = '', body = '') {
  const t = title.replace(/【[^】]*】/g, '');
  for (const [name, re] of CATEGORIES) if (re.test(t)) return name;
  // Title said nothing useful — try the first part of the post body.
  const b = body.slice(0, 200);
  if (b) for (const [name, re] of CATEGORIES) if (re.test(b)) return name;
  return OTHER;
}
