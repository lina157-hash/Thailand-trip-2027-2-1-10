/* 旅遊靈感：芭達雅、曼谷的景點與必吃美食。
   每張卡片顯示該地點或菜色的實景照片（Wikimedia Commons，少數用 Unsplash）；沒有實景照片或載不到時，顯示「上網看照片」按鈕，不放示意圖。
   type：see＝景點、eat＝美食；city：曼谷、芭達雅，或兩地都吃得到的「曼谷・芭達雅」。
   營業時間、票價常變動，卡片上只寫不太會變的資訊，細節請出發前再確認。 */
window.INSPIRE = (() => {
  const CAT = {
    watArun: 'temple', goldenMount: 'temple', sanctuary: 'temple', bigBuddha: 'temple', erawan: 'temple', watBenja: 'temple', watSuthat: 'temple',
    talatNoi: 'old', yaowarat: 'old', jimThompson: 'old',
    chatuchak: 'market', joddFairs: 'market', asiatique: 'market', floatingMarket: 'market', thepprasit: 'market', srinakarin: 'market', pratunam: 'market', maeklong: 'market', damnoen: 'market',
    siamParagon: 'shop', terminal21: 'shop', mbk: 'shop', centralPattaya: 'shop',
    kohLarn: 'nature', jomtien: 'nature', nongNooch: 'nature', lumphini: 'nature', viewpoint: 'nature', bangKrachao: 'nature',
    massage: 'play', rooftop: 'play', muayThai: 'play', cooking: 'play', riverBoat: 'play', artParadise: 'play', pattayaWalking: 'play',
    tomYum: 'dish', padThai: 'dish', somTam: 'dish', chickenRice: 'dish', boatNoodles: 'dish', kraPao: 'dish', massaman: 'dish', greenCurry: 'dish', khaoSoi: 'dish', khaoKhaMoo: 'dish', plaPao: 'dish', curryCrab: 'dish',
    mangoRice: 'snack', mooPing: 'snack', thaiTea: 'snack', roti: 'snack', coconutIce: 'snack', khanomKrok: 'snack', fruitShake: 'snack',
    jayFai: 'restaurant', somboon: 'restaurant', kruaApsorn: 'restaurant', afterYou: 'restaurant', glassHouse: 'restaurant', mumAroi: 'restaurant',
  };
  // 實景照片：Wikimedia Commons 的檔名（作者與授權看檔案頁），找不到實景的就留空，卡片會顯示「上網看照片」
  const WM = {
    erawan: "Erawan Shrine Ratchaprasong.jpg",
    watArun: "Wat Arun from Chao Phraya River.jpg",
    goldenMount: "Wat Saket, Golden Mount, Bangkok, Thailand.jpg",
    watBenja: "Wat Benchamabophit ubosot.jpg",
    watSuthat: "Wat Suthat Giant Swing.jpg",
    sanctuary: "Sanctuary of Truth Pattaya.jpg",
    bigBuddha: "Big Buddha in Pattaya.jpg",
    talatNoi: "Talat Noi, Samphanthawong, Bangkok, Thailand - panoramio.jpg",
    yaowarat: "Yaowarat at night (32455695783).jpg",
    jimThompson: "Jim Thompson house.jpg",
    lumphini: "Lumphini Park.jpg",
    bangKrachao: "Bang Kachao, Phra Pradaeng District, Samut Prakan, Thailand - panoramio (1).jpg",
    viewpoint: "Pattaya beach from view point.jpg",
    kohLarn: "Koh Larn,Thailand.jpg",
    jomtien: "Jomtien Beach 1.jpg",
    nongNooch: "Nong Noogh Garden(1).jpg",
    riverBoat: "Chao Phraya Express Boat Orange Flag 2.jpg",
    muayThai: "Thai Boxing at Ratchadamnoen Boxing Stadium.jpg",
    rooftop: "Sky Bar at State Tower Bangkok.jpg",
    chatuchak: "Chatuchak Weekend Market 2.jpg",
    joddFairs: "Jodd Fairs DanNeramit 2023-05-03.jpg",
    asiatique: "Asiatique The Riverfront Bangkok.jpg",
    pratunam: "Pratunam market day.jpg",
    maeklong: "Maeklong Railway Market - SRT NKF 1227 (20241012b) (54222672984).jpg",
    damnoen: "Damnoen saduak floating market.jpg",
    floatingMarket: "Pattaya Floating Market (1).jpg",
    pattayaWalking: "Pattaya, Walking Street at night, Thailand.jpg",
    siamParagon: "Thailand Bangkok SiamParagon Night.jpg",
    terminal21: "Terminal 21 Asok Bangkok 20202021.jpg",
    mbk: "MBK Center (New facade).jpg",
    centralPattaya: "CentralFestival Pattaya Beach.jpg",
    massage: "Traditional Thai massage.jpg",
    cooking: "Thai-Cooking-Class-Chiang-Mai-Thailand.jpg",
    tomYum: "Tom yum goong-01.jpg",
    padThai: "Pad Thai en Bangkok, Tailandia (23790424338).jpg",
    somTam: "Som Tam green papaya salad, Bangkok, Thailand.jpg",
    chickenRice: "2013 Khao man kai CM.jpg",
    kraPao: "Kraphao mu khai dao.jpg",
    massaman: "Massaman curry, Bang Kapi, Bangkok.jpg",
    greenCurry: "Thai green curry with chicken at restaurant Thai Street Food in Porvoo.jpg",
    khaoSoi: "Khao soi Chiang Mai.jpg",
    khaoKhaMoo: "Khao kha moo thailand.jpg",
    plaPao: "Thai grilling fish with salt,Katori-city,Japan.JPG",
    curryCrab: "Pu Phat Phong Kari.jpg",
    mangoRice: "Mango with glutinous rice.jpg",
    thaiTea: "Thai iced tea.jpg",
    roti: "Roti kluai khai chiang mai 01.jpg",
    coconutIce: "Coconut Ice Cream, Bangkok.jpg",
    khanomKrok: "Khanom krok - Thailand.jpg",
    jayFai: "Bangkok street food - Jay Fai - 51444505872.jpg",
    somboon: "Pu Phat Phong Kari.jpg",
  };
  // Commons 沒有合適實景時用的 Unsplash 照片
  const UNSPLASH = {"boatNoodles": {"id": "photo-1555126634-323283e090fa", "page": "https://unsplash.com/photos/noddle-dish-on-white-ceramic-bowl-H5Hj8QV2Tx4", "by": "Mae Mu"}, "mooPing": {"id": "photo-1665111915476-b91b328a3c37", "page": "https://unsplash.com/photos/a-plate-of-food-l2RuDTo3igs", "by": "tommao wang"}, "fruitShake": {"id": "photo-1758184875542-2a30993210b4", "page": "https://unsplash.com/photos/fresh-fruit-smoothies-stand-with-colorful-drinks-menu-BRbXI2EYetY", "by": "Aleksandr Galichkin"}};

  const P = (type, city, name, en, key, desc, tip, map) => ({ type, cat: CAT[key] || (type === 'eat' ? 'dish' : 'temple'), city, name, en, photo: WM[key] ? { wm: WM[key] } : UNSPLASH[key] || null, desc, tip, map });
  return [
    // 景點 · 曼谷
    P('see', '曼谷', '鄭王廟', 'Wat Arun', 'watArun', '沿著昭披耶河，收藏寺廟的細緻紋理與河岸風景。傍晚從對岸看最漂亮。', '寺廟請穿著遮肩、過膝的衣物。從臥佛寺附近的碼頭搭渡船過河只要幾分鐘。', 'Wat Arun'),
    P('see', '曼谷', 'Talat Noi 老城散步', 'Talat Noi', 'talatNoi', '走進老街巷弄，找一杯咖啡，也找城市日常。牆上塗鴉和老鐵件很好拍。', '巷子窄，適合幾個人分組慢慢走。', 'Talat Noi Bangkok'),
    P('see', '曼谷', '恰圖恰週末市集', 'Chatuchak Weekend Market', 'chatuchak', '上萬個攤位的超大市集，衣服、雜貨、小吃都有。本次旅程的週末是 2/6、2/7。', '2/6 已排進共同行程。市集很大，先約好集合點和時間。', 'Chatuchak Weekend Market'),
    P('see', '曼谷', '中國城耀華力路', 'Yaowarat Road', 'yaowarat', '曼谷最熱鬧的街頭小吃區，晚上招牌亮起後最有氣氛。粿條、海鮮、甜湯一路吃過去。', '晚上人多，貴重物品放前面。', 'Yaowarat Road Bangkok'),
    P('see', '曼谷', '金山寺', 'Wat Saket (Golden Mount)', 'goldenMount', '爬上山頂的金色佛塔，可以 360 度看曼谷老城。', '要爬一段樓梯，帶水、穿好走的鞋。', 'Wat Saket Golden Mount'),
    P('see', '曼谷', '金湯普森之家', 'Jim Thompson House', 'jimThompson', '泰絲大王的柚木老宅與庭園，綠意很多，適合安靜走走。', '屋內參觀通常需跟導覽，入場方式請出發前確認。', 'Jim Thompson House'),
    P('see', '曼谷', 'Jodd Fairs 夜市（Ratchada）', 'Jodd Fairs Ratchada', 'joddFairs', '年輕人最愛的夜市，火山排骨、烤海鮮、水果冰沙都有。原本的 Rama 9 場已在 2025 年關閉，現在在 Ratchada。', 'MRT 藍線 Thailand Cultural Centre 站 4 號出口步行約 3 分鐘，每天約 17:00 開到凌晨 1 點。', 'Jodd Fairs Ratchada'),
    P('see', '曼谷', 'Asiatique 河濱夜市', 'Asiatique The Riverfront', 'asiatique', '河邊的大型夜市，有摩天輪、商店與餐廳，晚上吹河風很舒服。', '可以搭船沿昭披耶河前往，路上順便看河岸夜景。', 'Asiatique The Riverfront'),
    // 景點 · 芭達雅
    P('see', '芭達雅', '格蘭島海邊時光', 'Koh Larn', 'kohLarn', '把一天留給海。海水清、沙灘多，可以玩水或只是發呆。', '2/3 已排進共同行程。船班與海況請在出發當日確認。', 'Koh Larn'),
    P('see', '芭達雅', '真理寺', 'Sanctuary of Truth', 'sanctuary', '全木造的雕刻建築，從屋頂到柱子都是手工木雕，非常壯觀。', '2/4 已排進共同行程。出發前確認參觀場次與服裝規範。', 'Sanctuary of Truth Pattaya'),
    P('see', '芭達雅', '喬木提恩海灘', 'Jomtien Beach', 'jomtien', '比芭達雅海灘安靜，適合海邊散步、看夕陽、吃一頓不趕時間的晚餐。', '傍晚來最舒服，記得防曬。', 'Jomtien Beach'),
    P('see', '芭達雅', '東芭樂園', 'Nong Nooch Tropical Garden', 'nongNooch', '超大的熱帶花園，有造景庭園、恐龍谷和泰國文化表演。', '園區很大，園內有接駁車；表演場次請出發前確認。', 'Nong Nooch Tropical Garden'),
    P('see', '芭達雅', '四方水上市場', 'Pattaya Floating Market', 'floatingMarket', '水上木屋與小船組成的市場，可以邊逛邊吃泰式小點、買手工藝品。', '有些區域需要坐船遊覽，價格先問清楚再上船。', 'Pattaya Floating Market'),
    P('see', '芭達雅', '大佛山', 'Wat Phra Yai (Big Buddha)', 'bigBuddha', '小山丘上的金色大佛，旁邊可以眺望芭達雅市區與海灣。', '屬於寺廟範圍，請穿著遮肩、過膝的衣物。', 'Wat Phra Yai Pattaya'),
    P('see', '芭達雅', '天府夜市', 'Thepprasit Night Market', 'thepprasit', '在地人也常去的夜市，小吃、衣服、雜貨都有，價格親民。', '每天約 17:00–22:30 營業（以現場公告為準）。', 'Thepprasit Night Market'),
    // 美食
    P('eat', '曼谷・芭達雅', '冬蔭功', 'Tom Yum Goong', 'tomYum', '酸辣湯配大蝦，香茅、檸檬葉、南薑的香氣很泰國。分清湯和加椰奶的濃湯兩種。', '怕辣可以說「mai phet」（不要辣）。', 'Tom Yum Goong'),
    P('eat', '曼谷・芭達雅', '泰式炒河粉', 'Pad Thai', 'padThai', '酸甜鹹香的經典炒河粉，加蝦或豬肉，擠一點檸檬、撒花生粉。', '曼谷老字號 Thipsamai 很有名，據報導 ICONSIAM 也有分店（2/5 行程會到），出發前請確認。', 'Pad Thai Bangkok'),
    P('eat', '曼谷・芭達雅', '青木瓜沙拉', 'Som Tam', 'somTam', '用臼搗出來的酸辣青木瓜絲，配糯米和烤雞最對味。', '可以請店家調辣度：「phet nit noi」是一點點辣。', 'Som Tam'),
    P('eat', '曼谷・芭達雅', '芒果糯米飯', 'Mango Sticky Rice', 'mangoRice', '香甜的芒果配淋上椰奶的糯米，泰國人氣甜點第一名。', '甜點店、夜市都買得到，挑芒果熟透、顏色金黃的。', 'Mango Sticky Rice'),
    P('eat', '曼谷・芭達雅', '泰式海南雞飯', 'Khao Man Gai', 'chickenRice', '用雞湯煮的香米配嫩雞，再沾一點醬料，簡單又耐吃。', '路邊攤和商場美食街都吃得到，適合當早午餐。', 'Khao Man Gai'),
    P('eat', '曼谷', '船麵', 'Boat Noodles', 'boatNoodles', '一小碗一小碗的濃郁湯麵，以前在船上賣而得名，大家常一次疊好幾碗。', '曼谷勝利紀念碑附近有一整排船麵店。', 'Boat Noodles Victory Monument'),
    P('eat', '曼谷・芭達雅', '打拋豬飯加荷包蛋', 'Pad Kra Pao', 'kraPao', '九層塔炒豬絞肉配白飯，再加一顆煎得酥脆的荷包蛋，泰國人的日常便當。', '加蛋說「khai dao」。', 'Pad Kra Pao'),
    P('eat', '曼谷・芭達雅', '烤豬肉串配糯米', 'Moo Ping', 'mooPing', '甜甜的烤豬肉串配一包糯米，泰國人最常見的早餐。', '早上在路邊攤最容易遇到。', 'Moo Ping'),
    P('eat', '曼谷・芭達雅', '泰式奶茶', 'Cha Yen', 'thaiTea', '橘色的濃郁奶茶，加冰最消暑。也有綠茶口味。', '甜度可以說「wan noi」（少糖）。', 'Thai Tea'),
    P('eat', '曼谷・芭達雅', '瑪莎曼咖哩', 'Massaman Curry', 'massaman', '溫和不太辣的咖哩，有馬鈴薯、花生和燉得軟嫩的肉，怕辣的人也能吃。', '配白飯或烤餅都好吃。', 'Massaman Curry'),
    // ── 第五輪新增 ──
    // 寺廟
    P('see', '曼谷', '四面佛', 'Erawan Shrine', 'erawan', '路口旁香火鼎盛的四面梵天神壇，很多人來許願，常有傳統舞蹈還願。就在 CentralWorld 旁邊。', '2/6 去 CentralWorld 時可以順路。參拜的人多，拍照不要擋到別人。', 'Erawan Shrine Bangkok'),
    P('see', '曼谷', '大理石寺', 'Wat Benchamabophit', 'watBenja', '用義大利白色大理石蓋的寺廟，線條優雅，人比大皇宮少很多，適合慢慢拍。', '寺廟請穿著遮肩、過膝的衣物；需購票入場。', 'Wat Benchamabophit'),
    P('see', '曼谷', '蘇泰寺與大鞦韆', 'Wat Suthat & Giant Swing', 'watSuthat', '路中央高聳的紅色大鞦韆是曼谷老城地標，旁邊的蘇泰寺有很美的壁畫。', '離金山寺不遠，可以排在同一個下午。', 'Wat Suthat Bangkok'),
    // 市集
    P('see', '曼谷', '席娜卡琳火車夜市', 'Train Night Market Srinakarin', 'srinakarin', '老車、古董雜貨和一整排小吃攤，比市區夜市更有在地感。', '主要在週末前後的晚上營業，營業日請出發前確認；離市區較遠，搭 Grab 較方便。', 'Train Night Market Srinakarin'),
    P('see', '曼谷', '水門市場', 'Pratunam Market', 'pratunam', '衣服、包包、飾品的批發區，價格便宜，買多件還能再便宜。旁邊就是 Platinum 服飾商場。', '很早就開、傍晚就收，想挖寶早點去；人多注意隨身物品。', 'Pratunam Market Bangkok'),
    P('see', '曼谷近郊', '美功鐵道市場', 'Maeklong Railway Market', 'maeklong', '火車從市場正中間開過去，攤販把遮雨棚一收、火車過後又擺回來，非常特別。', '離曼谷約 1.5 小時車程，適合 2/9 自由日包車半天；火車時刻請先查好。', 'Maeklong Railway Market'),
    P('see', '曼谷近郊', '丹嫩莎朵水上市場', 'Damnoen Saduak Floating Market', 'damnoen', '最有名的水上市場，小船載著水果、船麵在河道上叫賣。', '越早去越好；可以和美功鐵道市場排成同一趟。搭船前先談好價格。', 'Damnoen Saduak Floating Market'),
    // 購物
    P('see', '曼谷', 'Siam Paragon', 'Siam Paragon', 'siamParagon', '曼谷代表性的百貨，地下樓的超市與美食街很好逛，伴手禮一次買齊。', 'BTS Siam 站直通；旁邊還有 Siam Center、Siam Discovery 可以一起逛。', 'Siam Paragon'),
    P('see', '曼谷', 'Terminal 21（Asok）', 'Terminal 21 Asok', 'terminal21', '每一層樓都布置成不同城市的主題商場，頂樓美食街 Pier 21 便宜又好吃。', 'BTS Asok／MRT Sukhumvit 站直通。美食街要先買儲值卡，用不完可以退。', 'Terminal 21 Asok'),
    P('see', '曼谷', 'MBK Center', 'MBK Center', 'mbk', '手機配件、紀念品、平價衣服都很多的老牌商場，可以殺價。', 'BTS National Stadium 站直通；旁邊就是金湯普森之家。', 'MBK Center Bangkok'),
    P('see', '芭達雅', 'Central Pattaya', 'Central Pattaya', 'centralPattaya', '芭達雅海灘路上的大型商場，逛街、吃飯、吹冷氣，下雨天也有地方去。', '面海的餐廳傍晚可以看夕陽。', 'Central Pattaya'),
    // 自然
    P('see', '曼谷', '倫披尼公園', 'Lumphini Park', 'lumphini', '市中心的大公園，湖邊常看到大蜥蜴悠閒散步，早上有人打太極、跑步。', '早上或傍晚來比較涼；不要餵或靠近蜥蜴。MRT Lumphini／Silom 站。', 'Lumphini Park'),
    P('see', '芭達雅', '芭達雅觀景台', 'Pattaya View Point', 'viewpoint', '在 Pratumnak 山上，可以一次看到整個芭達雅灣和「PATTAYA CITY」大字。', '傍晚看夕陽最漂亮；搭 Grab 或雙條車上去。', 'Pattaya View Point Khao Phra Tamnak'),
    P('see', '曼谷', '曼谷綠肺 Bang Krachao', 'Bang Krachao', 'bangKrachao', '昭披耶河彎道裡的一大片綠地，租腳踏車在高架小路穿過椰林，很難想像就在曼谷。', '從 Khlong Toei 一帶的碼頭搭小船過河；週末有小型水上市場。', 'Bang Krachao'),
    // 體驗
    P('see', '曼谷・芭達雅', '泰式按摩', 'Thai Massage', 'massage', '逛完一天腳很痠，來一個小時的泰式按摩或腳底按摩最舒服。臥佛寺裡就有傳統按摩學校。', '力道太大可以說「bao bao」（輕一點）。小費參考在「旅途工具 → 退稅與小費」。', 'Thai massage'),
    P('see', '曼谷', '高空酒吧看夜景', 'Rooftop Bar', 'rooftop', '在高樓頂端喝一杯，看曼谷夜景和昭披耶河。最有名的是電影《醉後大丈夫 2》的 Sky Bar。', '多數有服裝規定（不能穿短褲、拖鞋）；飲料偏貴，可以只點一杯慢慢坐。', 'Sky Bar lebua Bangkok'),
    P('see', '曼谷', '看一場泰拳', 'Muay Thai', 'muayThai', '現場看泰拳比賽，音樂、吶喊和選手賽前的拜師舞都很有氣氛。', '拉差達慕恩拳擊場（Rajadamnern）歷史最久，比賽日與票價請出發前在官網確認。', 'Rajadamnern Stadium'),
    P('see', '曼谷', '泰菜烹飪課', 'Thai Cooking Class', 'cooking', '跟著老師逛市場、認識香料，再自己做冬蔭功、綠咖哩，吃自己煮的午餐。', '多半是半天課程，要先預約；適合 2/9 自由日分組參加。', 'Thai cooking class Bangkok'),
    P('see', '曼谷', '搭橘旗船遊昭披耶河', 'Chao Phraya Express Boat', 'riverBoat', '當地人通勤的交通船，便宜又能沿河看鄭王廟、大皇宮和老城。', '橘色旗子的船每站都停，上船再買票；臥佛寺附近是 Tha Tien 碼頭。', 'Sathorn Pier Bangkok'),
    P('see', '芭達雅', 'Art in Paradise 3D 美術館', 'Art in Paradise Pattaya', 'artParadise', '可以「走進畫裡」拍照的 3D 錯視美術館，大人小孩都玩得開心，也適合下雨天。', '手機電量要夠，一拍就停不下來。', 'Art in Paradise Pattaya'),
    P('see', '芭達雅', '芭達雅不夜城 Walking Street', 'Walking Street Pattaya', 'pattayaWalking', '晚上封街變成霓虹燈步行街，酒吧、海鮮餐廳、街頭表演一路熱鬧到深夜。', '比較成人取向，帶長輩或小孩可以只走前段看看；人多注意隨身物品。', 'Walking Street Pattaya'),
    // 經典泰菜
    P('eat', '曼谷・芭達雅', '綠咖哩', 'Gaeng Keow Wan', 'greenCurry', '椰奶加青辣椒的綠咖哩，香甜中帶辣，配雞肉或魚丸，淋在白飯上很下飯。', '比瑪莎曼咖哩辣，怕辣的人先嚐一口。', 'Green curry'),
    P('eat', '曼谷', '泰北咖哩麵', 'Khao Soi', 'khaoSoi', '濃郁的椰奶咖哩湯，裡面是軟麵、上面撒炸得酥脆的麵條，再擠點檸檬、加醃菜。', '這是泰北料理，曼谷要找專門的店。', 'Khao Soi Bangkok'),
    P('eat', '曼谷・芭達雅', '泰式豬腳飯', 'Khao Kha Moo', 'khaoKhaMoo', '滷到入口即化的豬腳配白飯和滷蛋，再加一點酸辣醬，台灣人很容易愛上。', '路邊攤、美食街都有，便宜又大碗。', 'Khao Kha Moo'),
    P('eat', '曼谷・芭達雅', '鹽烤魚', 'Pla Pao', 'plaPao', '整條魚塞香茅、外面裹一層鹽去烤，魚肉很嫩，配生菜、米線和酸辣醬一起包著吃。', '夜市常見，一條很多人可以分。', 'Pla Pao'),
    P('eat', '曼谷・芭達雅', '咖哩炒蟹', 'Poo Pad Pong Karee', 'curryCrab', '蟹肉和蛋、咖哩粉炒成滑嫩的醬汁，配白飯是很多人來泰國必點的一道。', '海鮮依重量計價，點之前先問價錢。', 'Poo Pad Pong Karee'),
    // 小吃甜點
    P('eat', '曼谷・芭達雅', '泰式香蕉煎餅', 'Roti', 'roti', '餅皮煎得酥脆，包香蕉、淋煉乳和糖，是夜市最香的甜點。', '可以選加蛋或巧克力。', 'Thai roti'),
    P('eat', '曼谷・芭達雅', '椰子冰淇淋', 'Coconut Ice Cream', 'coconutIce', '裝在椰子殼裡的椰奶冰淇淋，加糯米、花生、玉米，清爽不膩。', '恰圖恰市集的攤位很有名。', 'Coconut ice cream Chatuchak'),
    P('eat', '曼谷・芭達雅', '椰奶小煎餅', 'Khanom Krok', 'khanomKrok', '一格一格煎出來的半圓小餅，外脆內是軟軟的椰奶，常加蔥或玉米。', '要趁熱吃；早市、夜市最容易遇到。', 'Khanom Krok'),
    P('eat', '曼谷・芭達雅', '水果與冰沙', 'Fresh Fruit & Smoothies', 'fruitShake', '路邊切好的鳳梨、木瓜、芭樂，或現打的水果冰沙，天氣熱時最需要。', '冰塊多半是製冰廠做的，腸胃敏感可以說「mai sai nam khaeng」（不要加冰）。', 'Fruit smoothie Bangkok'),
    // 名店餐廳
    P('eat', '曼谷', '痣姐 Jay Fai', 'Raan Jay Fai', 'jayFai', '米其林一星的路邊熱炒，招牌是大塊蟹肉蛋捲，戴著護目鏡掌鍋的阿嬤很有名。', '排隊很久、價格偏高，不一定能 18 人一起吃；出發前確認營業日與訂位方式。', 'Raan Jay Fai'),
    P('eat', '曼谷', '建興酒家', 'Somboon Seafood', 'somboon', '咖哩炒蟹的名店，海鮮新鮮、份量大，很適合一大群人一起點菜分著吃。', '有好幾家分店，大團體建議先訂位。', 'Somboon Seafood'),
    P('eat', '曼谷', 'Krua Apsorn', 'Krua Apsorn', 'kruaApsorn', '家常的老字號泰菜館，蟹肉蛋捲和黃咖哩炒蟹很受歡迎，口味道地不浮誇。', '店不大，用餐時間人多；離民主紀念碑不遠。', 'Krua Apsorn Dinso'),
    P('eat', '曼谷', 'After You 甜點', 'After You Dessert Café', 'afterYou', '泰國人氣甜點店，泰奶剉冰和蜂蜜吐司是招牌，逛街逛累了來坐一下。', 'Siam Paragon 等大商場都有分店。', 'After You Dessert Cafe Siam Paragon'),
    P('eat', '芭達雅', 'The Glass House', 'The Glass House Pattaya', 'glassHouse', '在 Na Jomtien 海邊的白色玻璃屋餐廳，腳踩沙灘吃泰菜，傍晚看夕陽很浪漫。', '離市區有段距離，大團體建議先訂位並安排接送。', 'The Glass House Pattaya'),
    P('eat', '芭達雅', 'Mum Aroi 海鮮', 'Mum Aroi Naklua', 'mumAroi', '芭達雅北邊 Naklua 的海邊海鮮餐廳，在地人常去，看著海吃烤魚、炒蟹。', '海鮮依重量計價，點之前先問價錢。', 'Mum Aroi Naklua'),
  ];
})();

// 旅遊靈感的分類（順序就是篩選按鈕的順序）
window.INSPIRE_CATS = [
  ['temple', '寺廟佛像', 'see'], ['old', '老城文化', 'see'], ['market', '市集夜市', 'see'], ['shop', '逛街購物', 'see'],
  ['nature', '海島自然', 'see'], ['play', '體驗玩樂', 'see'],
  ['dish', '經典泰菜', 'eat'], ['snack', '小吃甜點', 'eat'], ['restaurant', '名店餐廳', 'eat'],
].map(([k, label, type]) => ({ k, label, type }));
