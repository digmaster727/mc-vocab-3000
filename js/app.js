/**
 * 國中必備3000單字 · 主控
 * 功能：
 *  - 50 關 × 20 字（共 1000 字）
 *  - 怪物戰鬥動畫（揮劍、爆破、扣血）
 *  - 道具系統 + 商店（用 💎 購買）
 *  - localStorage 進度存檔（支援 v1 → v2 遷移）
 */
(function () {
  'use strict';

  /* ========== 道具設定 ========== */
  const ITEMS = {
    heart:      { emoji: '❤️',  name: '補血藥水',  desc: '補回 1 顆愛心',           price: 100 },
    bomb:       { emoji: '💣',  name: '雷霆強擊',  desc: '當前怪物秒殺，雙倍寶石',   price: 60  },
    fiftyFifty: { emoji: '✂️',  name: '砍半魔法',  desc: '消除 2 個錯誤選項',       price: 30  },
    skip:       { emoji: '⏭️',  name: '時光跳過',  desc: '跳過此題不扣愛心',         price: 50  }
  };

  /* ========== 多使用者 + 存檔（v1 → v2 → v3 遷移） ========== */
  const USERS = ['JOE', 'LEO'];
  const USER_AVATARS = { JOE: '🧑‍🎓', LEO: '🧑‍🚀' };
  const SAVE_KEY_BASE = 'mc-vocab-save-v1';
  const ACTIVE_USER_KEY = 'mc-vocab-active-user';

  function getSaveKey(user) { return SAVE_KEY_BASE + '::' + user; }

  function defaultSave() {
    return {
      version: 3,
      totalGems: 0,
      levels: {},                                                  // 每關: {stars,bestScore,plays,seenWords[]}
      inventory: { heart: 0, bomb: 0, fiftyFifty: 0, skip: 0 },
      mistakes: [],                                                // 錯題池 [{en,zh,hint}]
      dailyClears: {}                                              // {'YYYY-MM-DD': {score,stars,bonus}}
    };
  }
  function loadSaveFor(user) {
    try {
      const raw = localStorage.getItem(getSaveKey(user));
      if (!raw) return defaultSave();
      const data = JSON.parse(raw);
      if (!data) return defaultSave();
      if (data.version === 1) {
        data.version = 2;
        data.inventory = { heart: 0, bomb: 0, fiftyFifty: 0, skip: 0 };
      }
      if (data.version === 2) {
        data.version = 3;
        data.mistakes = [];
        data.dailyClears = {};
      }
      if (!data.inventory) data.inventory = { heart: 0, bomb: 0, fiftyFifty: 0, skip: 0 };
      if (!data.mistakes) data.mistakes = [];
      if (!data.dailyClears) data.dailyClears = {};
      return data;
    } catch (_) { return defaultSave(); }
  }
  // 把舊版單一存檔（mc-vocab-save-v1）自動遷移到 JOE
  function migrateLegacySave() {
    const legacy = localStorage.getItem(SAVE_KEY_BASE);
    if (!legacy) return;
    if (!localStorage.getItem(getSaveKey('JOE')) && !localStorage.getItem(getSaveKey('LEO'))) {
      localStorage.setItem(getSaveKey('JOE'), legacy);
    }
  }
  function persist() {
    if (!currentUser) return;
    try { localStorage.setItem(getSaveKey(currentUser), JSON.stringify(save)); }
    catch (e) { console.warn('[save] 寫入失敗', e); }
  }
  function clearSave() {
    if (!currentUser) return;
    if (!confirm('確定要清除「' + currentUser + '」的所有進度與道具嗎？此動作無法還原。')) return;
    localStorage.removeItem(getSaveKey(currentUser));
    save = defaultSave();
    refreshSaveSummary();
    renderLevelGrid();
    renderUserCards();
  }

  let currentUser = null;
  let save = defaultSave();

  function switchToUser(name) {
    if (USERS.indexOf(name) < 0) return;
    if (currentUser) persist();   // 切換前先存舊使用者
    currentUser = name;
    try { localStorage.setItem(ACTIVE_USER_KEY, name); } catch (_) {}
    save = loadSaveFor(name);
    refreshSaveSummary();
    renderLevelGrid();
  }

  /* ========== 成就封號（依累計星星數） ========== */
  const TITLES = [
    { min: 0,   key: 'novice',   name: '新手',     emoji: '🌱', color: '#7FB040' },
    { min: 10,  key: 'apprentice', name: '學徒',   emoji: '📖', color: '#A67B4A' },
    { min: 30,  key: 'iron',     name: '鐵騎兵',   emoji: '⚔️', color: '#A8B5BC' },
    { min: 60,  key: 'knight',   name: '騎士',     emoji: '🛡️', color: '#4FC3F7' },
    { min: 100, key: 'commander',name: '騎士團長', emoji: '🎖️', color: '#FFC830' },
    { min: 150, key: 'duke',     name: '公爵',     emoji: '👑', color: '#E91E63' },
    { min: 200, key: 'king',     name: '王者',     emoji: '🌟', color: '#FF6B00' }
  ];
  function getTitle(stars) {
    let t = TITLES[0];
    for (let i = 0; i < TITLES.length; i++) if (stars >= TITLES[i].min) t = TITLES[i];
    return t;
  }
  function getNextTitle(stars) {
    for (let i = 0; i < TITLES.length; i++) if (stars < TITLES[i].min) return TITLES[i];
    return null;
  }

  function getLevelRecord(id) {
    return save.levels[id] || { stars: 0, bestScore: 0, plays: 0 };
  }
  function updateLevelRecord(id, score, stars, monstersKilled) {
    const cur = getLevelRecord(id);
    save.levels[id] = {
      stars: Math.max(cur.stars, stars),
      bestScore: Math.max(cur.bestScore, score),
      plays: cur.plays + 1
    };
    save.totalGems += score + (monstersKilled || 0) * 5; // 每隻怪 +5💎
    persist();
  }
  function totalStarsEarned() {
    let t = 0;
    for (const k in save.levels) t += save.levels[k].stars || 0;
    return t;
  }

  /* ========== 狀態 ========== */
  const state = {
    hearts: 3, maxHearts: 5,             // 上限提高到 5（藥水才有意義）
    score: 0, scorePerCorrect: 10,
    questionIndex: 0, totalQuestions: 10,
    currentWord: null, answered: false,
    currentLevel: null,
    monsterHp: 3, monsterMaxHp: 3,
    monstersKilled: 0,
    activeBomb: false,                   // 下一答對是否雙倍 + 秒殺
    eliminated: [],                      // 50/50 已消除的選項
    gameMode: 'level',                   // 'level' | 'mistake' | 'daily'
    dailyKey: null,
    correctStreak: 0,                    // 連勝（連續答對）
    bestStreakInSession: 0
  };
  function resetState() {
    state.hearts = 3;                    // 起始仍 3 顆，藥水可補到上限 5
    state.score = 0;
    state.questionIndex = 0;
    state.totalQuestions = 10;
    state.currentWord = null;
    state.answered = false;
    state.monsterHp = 3;
    state.monsterMaxHp = 3;
    state.monstersKilled = 0;
    state.activeBomb = false;
    state.eliminated = [];
    state.gameMode = 'level';
    state.dailyKey = null;
    state.correctStreak = 0;
    state.bestStreakInSession = 0;
  }

  /* ========== 語音 ========== */
  let preferredVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    preferredVoice =
      voices.find(v => /en-US/i.test(v.lang) && /samantha|google|zira|ava|jenny/i.test(v.name)) ||
      voices.find(v => /en-GB/i.test(v.lang)) ||
      voices.find(v => /^en[-_]/i.test(v.lang)) ||
      voices[0];
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = pickVoice;
    pickVoice();
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.85; u.pitch = 1.0;
      if (preferredVoice) u.voice = preferredVoice;
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  /* ========== 8-bit SFX ========== */
  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }
  function tone(freq, dur, type, vol) {
    try {
      const ac = getCtx(); if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(vol || 0.08, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch (_) {}
  }
  function playSfx(type) {
    const ac = getCtx(); if (!ac) return;
    const t = ac.currentTime;
    if (type === 'attack') {        // 揮劍命中：高頻往下滑
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.18);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(ac.destination);
      osc.start(); osc.stop(t + 0.21);
    } else if (type === 'hurt') {   // 受傷：低頻
      tone(180, 0.25, 'sawtooth', 0.1);
      setTimeout(() => tone(120, 0.2, 'sawtooth', 0.08), 100);
    } else if (type === 'kill') {   // 擊殺：上揚 4 音
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => tone(f, 0.12, 'square', 0.09), i * 70));
    } else if (type === 'bomb') {   // 強擊：爆炸
      tone(80, 0.4, 'sawtooth', 0.15);
      tone(150, 0.3, 'square', 0.1);
    } else if (type === 'click') {
      tone(520, 0.07, 'square', 0.06);
    } else if (type === 'buy') {
      tone(880, 0.08, 'square', 0.08);
      setTimeout(() => tone(1320, 0.1, 'square', 0.08), 80);
    } else if (type === 'win') {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        setTimeout(() => tone(f, 0.15, 'square', 0.1), i * 100));
    } else if (type === 'correct') {        // 答對：4 音琶音 + 鈴聲
      [659, 784, 988, 1319].forEach((f, i) =>
        setTimeout(() => tone(f, 0.10, 'square', 0.10), i * 50));
      setTimeout(() => tone(2093, 0.18, 'triangle', 0.06), 220);
    } else if (type === 'combo') {          // 連勝特效：更燦爛
      [659, 784, 988, 1319, 1568, 2093].forEach((f, i) =>
        setTimeout(() => tone(f, 0.09, 'square', 0.11), i * 45));
      setTimeout(() => tone(2637, 0.22, 'triangle', 0.08), 320);
    } else if (type === 'levelup') {        // 連勝升級提示
      [880, 1175, 1568].forEach((f, i) =>
        setTimeout(() => tone(f, 0.12, 'square', 0.09), i * 70));
    } else if (type === 'wrong') {          // 答錯：低音 buzz
      tone(220, 0.2, 'sawtooth', 0.09);
      setTimeout(() => tone(165, 0.25, 'sawtooth', 0.08), 100);
    }
  }

  /* ========== 怪物 SVG 生成 ========== */
  // 6 種半張像素模板（12 列 × 6 欄，左右鏡像為 12×12）
  // 編碼：0=透明, 1=主色skin, 2=陰影shadow, 3=亮部light, 4=眼eye, 5=嘴/特徵mouth
  const SPRITE_TEMPLATES = {
    // A. 經典人形（殭屍、骷髏、村民、烈焰使者…）
    humanoid: [
      [0,0,0,2,2,2],
      [0,0,2,1,1,1],
      [0,2,1,1,3,3],
      [2,1,1,3,3,3],
      [2,1,4,4,1,1],
      [2,1,1,1,1,1],
      [2,1,5,5,5,5],
      [2,1,1,1,1,1],
      [2,2,1,1,1,1],
      [0,2,2,1,1,1],
      [0,0,2,2,1,1],
      [0,0,0,2,2,2]
    ],
    // B. 立方體（史萊姆、岩漿立方怪、苦力怕、雪人）
    cube: [
      [2,2,2,2,2,2],
      [2,1,1,1,1,1],
      [2,1,3,3,1,1],
      [2,1,1,1,1,1],
      [2,1,4,4,1,1],
      [2,1,1,1,1,1],
      [2,1,1,1,5,5],
      [2,1,1,1,1,1],
      [2,1,1,1,1,1],
      [2,1,1,1,1,1],
      [2,1,1,1,1,1],
      [2,2,2,2,2,2]
    ],
    // C. 海洋／魚（河豚、海豚、六角恐龍、鸚鵡螺）
    fish: [
      [0,0,0,0,0,2],
      [0,0,0,2,2,1],
      [0,0,2,1,1,1],
      [0,2,1,1,3,3],
      [2,1,1,4,4,1],
      [2,1,1,1,1,1],
      [2,1,1,1,5,5],
      [2,1,1,1,1,1],
      [2,1,1,3,1,1],
      [0,2,1,1,1,1],
      [0,0,2,2,1,1],
      [0,0,0,0,2,2]
    ],
    // D. 飄浮幽靈（地獄幽靈、夜魅、旋風使者）
    ghost: [
      [0,0,2,2,2,2],
      [0,2,1,1,1,1],
      [0,2,1,1,3,3],
      [2,1,1,1,1,1],
      [2,1,4,4,1,1],
      [2,1,1,1,1,1],
      [2,1,1,1,5,5],
      [2,1,1,1,1,1],
      [2,1,1,1,1,1],
      [2,1,1,1,1,1],
      [2,2,0,0,2,2],
      [0,2,0,0,0,2]
    ],
    // E. 小蟲（蜜蜂、蜘蛛、終界蟎）
    bug: [
      [0,2,0,0,0,0],
      [0,2,2,0,0,0],
      [0,0,2,1,1,2],
      [2,2,1,1,3,1],
      [2,1,4,1,1,1],
      [2,1,1,5,1,1],
      [2,1,1,1,1,1],
      [2,2,1,1,1,1],
      [0,2,2,1,1,2],
      [0,0,0,2,2,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0]
    ],
    // F. 四足動物（貓、狐狸、貓熊、北極熊、駱馬、山羊、山貓、豬布獸…）
    feline: [
      [2,2,0,0,0,2],
      [2,1,2,0,2,1],
      [0,2,1,2,1,1],
      [0,2,1,1,1,1],
      [0,2,4,1,4,1],
      [0,2,1,3,1,1],
      [0,2,1,5,1,1],
      [0,2,1,1,1,1],
      [0,2,1,1,1,1],
      [0,2,1,1,1,1],
      [0,2,1,1,1,1],
      [0,2,2,1,1,1]
    ]
  };

  const MONSTERS = [
    // ===== 既有 7 隻 =====
    { name:'zombie',         type:'humanoid', skin:'#5D8A3A', shadow:'#3D5E23', light:'#7FB040', eye:'#FF2222', mouth:'#1A2A0F' },
    { name:'skeleton',       type:'humanoid', skin:'#E4E4E4', shadow:'#909090', light:'#FFFFFF', eye:'#000000', mouth:'#000000' },
    { name:'spider',         type:'bug',      skin:'#3A3A3A', shadow:'#1A1A1A', light:'#5A5A5A', eye:'#FF6B00', mouth:'#8B0000' },
    { name:'creeper',        type:'cube',     skin:'#5D8A3A', shadow:'#2D4A1A', light:'#7FB040', eye:'#000000', mouth:'#000000' },
    { name:'slime',          type:'cube',     skin:'#4FC3F7', shadow:'#0288D1', light:'#B3E5FC', eye:'#000000', mouth:'#01579B' },
    { name:'enderman',       type:'humanoid', skin:'#1A1A2E', shadow:'#000000', light:'#3A3A5E', eye:'#E91E63', mouth:'#9C27B0' },
    { name:'blaze',          type:'humanoid', skin:'#F4C430', shadow:'#B8860B', light:'#FFE066', eye:'#FF0000', mouth:'#8B0000' },
    // ===== 友善生物 =====
    { name:'villager',       type:'humanoid', skin:'#7B6B5C', shadow:'#5C4D40', light:'#A89378', eye:'#1A1A1A', mouth:'#3A2A1A' },
    { name:'goat',           type:'feline',   skin:'#F5F5F0', shadow:'#7A7570', light:'#FFFFFF', eye:'#000000', mouth:'#5A5A5A' },
    { name:'pufferfish',     type:'fish',     skin:'#F4C430', shadow:'#9A6F0E', light:'#FFE066', eye:'#000000', mouth:'#8B4513' },
    { name:'axolotl',        type:'fish',     skin:'#FFB6D9', shadow:'#D88AA8', light:'#FFD6E8', eye:'#5A1A2E', mouth:'#8B3A60' },
    { name:'cat',            type:'feline',   skin:'#1A1A1A', shadow:'#000000', light:'#3A3A3A', eye:'#5DCC3A', mouth:'#FFB6D9' },
    { name:'frog',           type:'cube',     skin:'#DD7C2A', shadow:'#A05C1A', light:'#F5A45A', eye:'#FFFFFF', mouth:'#1A1A1A' },
    { name:'ocelot',         type:'feline',   skin:'#E8B860', shadow:'#A88040', light:'#F5D080', eye:'#5DCC3A', mouth:'#5A3A1A' },
    { name:'snowgolem',      type:'cube',     skin:'#FFFFFF', shadow:'#A8B8C8', light:'#FFFFFF', eye:'#1A1A1A', mouth:'#FF6B00' },
    { name:'bee',            type:'bug',      skin:'#F4C430', shadow:'#1A1A1A', light:'#FFE066', eye:'#000000', mouth:'#000000' },
    { name:'dolphin',        type:'fish',     skin:'#7AB8E8', shadow:'#3A78B8', light:'#B0D8F8', eye:'#000000', mouth:'#1A4A78' },
    { name:'fox',            type:'feline',   skin:'#E8743A', shadow:'#A85020', light:'#FFA060', eye:'#000000', mouth:'#FFFFFF' },
    { name:'irongolem',      type:'humanoid', skin:'#A8B5BC', shadow:'#5C6870', light:'#D8E0E5', eye:'#FF1A1A', mouth:'#3A3A3A' },
    { name:'llama',          type:'feline',   skin:'#E8D5B0', shadow:'#A89070', light:'#FFE5C8', eye:'#000000', mouth:'#A0856A' },
    { name:'nautilus',       type:'fish',     skin:'#F5E5D0', shadow:'#C8A878', light:'#FFFFFF', eye:'#1A1A1A', mouth:'#A85020' },
    { name:'panda',          type:'feline',   skin:'#FFFFFF', shadow:'#1A1A1A', light:'#F0F0F0', eye:'#000000', mouth:'#000000' },
    { name:'polarbear',      type:'feline',   skin:'#F8F8F8', shadow:'#B8B8B8', light:'#FFFFFF', eye:'#000000', mouth:'#5A5A5A' },
    // ===== 敵對生物 =====
    { name:'drowned',        type:'humanoid', skin:'#3A8AA0', shadow:'#1A4A60', light:'#5AB0C5', eye:'#FFFFFF', mouth:'#1A2A30' },
    { name:'breeze',         type:'ghost',    skin:'#A8C5E5', shadow:'#5078A0', light:'#D5E5FF', eye:'#FFFFFF', mouth:'#FF9A1A' },
    { name:'elderguardian',  type:'humanoid', skin:'#7A7060', shadow:'#3A3528', light:'#B5A88C', eye:'#FF1A1A', mouth:'#5A4A30' },
    { name:'endermite',      type:'bug',      skin:'#1A1A2E', shadow:'#000000', light:'#3A3A5E', eye:'#E91E63', mouth:'#000000' },
    { name:'evoker',         type:'humanoid', skin:'#9090A0', shadow:'#5A5A6A', light:'#C0C0D0', eye:'#1A1A1A', mouth:'#FFC830' },
    { name:'ghast',          type:'ghost',    skin:'#F0EBDA', shadow:'#9A8A60', light:'#FFFFFF', eye:'#5A2A0A', mouth:'#3A1A0A' },
    { name:'guardian',       type:'humanoid', skin:'#A8A065', shadow:'#5A5028', light:'#C8C088', eye:'#FF3A3A', mouth:'#5A4A20' },
    { name:'hoglin',         type:'feline',   skin:'#A85838', shadow:'#5A2818', light:'#D87858', eye:'#1A1A1A', mouth:'#FFFFFF' },
    { name:'husk',           type:'humanoid', skin:'#C8B580', shadow:'#7A6840', light:'#E8D8A8', eye:'#A05828', mouth:'#5A3818' },
    { name:'magmacube',      type:'cube',     skin:'#3A1A0A', shadow:'#1A0A00', light:'#FF6800', eye:'#FF8A20', mouth:'#FFE066' },
    { name:'witherskeleton', type:'humanoid', skin:'#3A3A3A', shadow:'#1A1A1A', light:'#5A5A5A', eye:'#FFFFFF', mouth:'#000000' },
    { name:'phantom',        type:'ghost',    skin:'#3A4A5A', shadow:'#1A2A3A', light:'#5A6A7A', eye:'#5DCC3A', mouth:'#1A1A1A' },
    { name:'piglinbrute',    type:'humanoid', skin:'#D88060', shadow:'#9A4830', light:'#FFB098', eye:'#000000', mouth:'#FFFFFF' },
    { name:'pillager',       type:'humanoid', skin:'#7A8090', shadow:'#3A4050', light:'#A8B0C0', eye:'#000000', mouth:'#5A4030' }
  ];

  // 怪物像素圖：依 type 取模板，左右鏡像
  function renderMonster(monsterIdx) {
    const m = MONSTERS[monsterIdx % MONSTERS.length];
    const W = 12;
    const half = SPRITE_TEMPLATES[m.type] || SPRITE_TEMPLATES.humanoid;
    let cells = '';
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const sx = x < W/2 ? x : (W - 1 - x);
        const v = half[y][sx];
        if (!v) continue;
        const c = v === 1 ? m.skin : v === 2 ? m.shadow : v === 3 ? m.light : v === 4 ? m.eye : m.mouth;
        cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
      }
    }
    return '<svg viewBox="0 0 ' + W + ' ' + W + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">' + cells + '</svg>';
  }

  /* ========== 主角（Steve + 鑽石劍）SVG ========== */
  function renderPlayer() {
    // 12×12 完整網格（不對稱：右手要拿劍）
    // 1=褐髮, 2=膚色, 3=藍衣, 4=眼黑, 5=嘴, 6=鑽石劍刃, 7=劍柄棕, 8=褐褲, 9=膚色亮
    const grid = [
      [0,1,1,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,0,0],
      [0,2,2,2,2,2,2,2,2,0,0,0],
      [0,2,4,2,9,9,2,4,2,0,0,0],
      [0,2,2,2,9,9,2,2,2,0,0,0],
      [0,2,2,2,5,5,2,2,2,0,0,6],
      [0,3,3,3,3,3,3,3,3,0,6,6],
      [0,3,3,3,3,3,3,3,3,6,6,0],
      [0,3,3,3,3,3,3,3,6,6,0,0],
      [0,3,3,3,3,3,3,7,6,0,0,0],
      [0,8,8,8,0,0,8,8,7,0,0,0],
      [0,8,8,8,0,0,8,8,8,0,0,0]
    ];
    const C = {
      1:'#5A3A1A', 2:'#F5C49C', 3:'#3A78B8', 4:'#1A1A1A',
      5:'#8B3A60', 6:'#A8E5FF', 7:'#8B5A2B', 8:'#5A4A30', 9:'#FFD8B0'
    };
    let cells = '';
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const v = grid[y][x];
        if (!v) continue;
        cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + C[v] + '"/>';
      }
    }
    return '<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">' + cells + '</svg>';
  }

  /* ========== UI helpers ========== */
  const $ = (id) => document.getElementById(id);
  const screens = {
    user:   $('user-screen'),
    start:  $('start-screen'),
    select: $('level-select-screen'),
    shop:   $('shop-screen'),
    game:   $('game-screen'),
    end:    $('end-screen')
  };
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }
  function starsString(n, total) {
    total = total || 3;
    let s = '';
    for (let i = 0; i < total; i++) s += i < n ? '⭐' : '☆';
    return s;
  }
  function refreshSaveSummary() {
    const totalLevels = window.LEVELS.length;
    const totalStars = totalStarsEarned();
    const maxStars = totalLevels * 3;
    const html = '⭐ <b>' + totalStars + '</b>/' + maxStars +
                 '   💎 <b>' + save.totalGems + '</b>';
    ['start-summary','select-summary','shop-gems'].forEach(id => {
      const el = $(id); if (el) el.innerHTML = html;
    });
    // 錯題徽章
    const mb = $('mistake-badge');
    if (mb) {
      const n = (save.mistakes || []).length;
      mb.textContent = n;
      mb.className = 'badge ' + (n > 0 ? 'badge--alert' : 'badge--mute');
    }
    // 每日挑戰徽章
    const db = $('daily-badge');
    if (db) {
      const cleared = !!(save.dailyClears && save.dailyClears[getTodayKey()]);
      db.textContent = cleared ? '✓' : '!';
      db.className = 'badge ' + (cleared ? 'badge--ok' : 'badge--alert');
    }
    // 目前使用者 + 封號
    const cu = $('current-user');
    if (cu) cu.textContent = (USER_AVATARS[currentUser] || '👤') + ' ' + (currentUser || '—');
    const ct = $('current-title');
    if (ct) {
      const t = getTitle(totalStars);
      ct.textContent = t.emoji + ' ' + t.name;
      ct.style.color = t.color;
      ct.style.borderColor = t.color;
      const next = getNextTitle(totalStars);
      ct.title = next ? '再 ' + (next.min - totalStars) + ' ⭐ 升級為「' + next.name + '」' : '已達最高封號！';
    }
    // 關卡選單上的封號 pill（複製顯示）
    const ct2 = $('select-title-pill');
    if (ct2 && ct) ct2.innerHTML = ct.textContent;
    if (ct2) { ct2.style.color = ct.style.color; ct2.style.borderColor = ct.style.borderColor; }
  }

  /* ========== 使用者選擇畫面 ========== */
  function renderUserCards() {
    const grid = $('user-grid');
    if (!grid) {
      console.warn('[user-grid] 找不到 #user-grid 容器');
      return;
    }
    try {
      grid.innerHTML = '';
      USERS.forEach(name => {
        const data = loadSaveFor(name);
        let stars = 0;
        for (const k in (data.levels || {})) stars += data.levels[k].stars || 0;
        const t = getTitle(stars);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'user-card' + (currentUser === name ? ' is-active' : '');
        card.dataset.user = name;
        card.innerHTML =
          '<div class="user-avatar">' + (USER_AVATARS[name] || '👤') + '</div>' +
          '<div class="user-name">' + name + '</div>' +
          '<div class="user-title-pill" style="color:' + t.color + ';border-color:' + t.color + '">' + t.emoji + ' ' + t.name + '</div>' +
          '<div class="user-stat">⭐ ' + stars + '   💎 ' + (data.totalGems || 0) + '</div>' +
          '<div class="user-cta">👉 點擊進入</div>';
        card.addEventListener('click', () => {
          playSfx('click');
          switchToUser(name);
          showScreen('start');
        });
        grid.appendChild(card);
      });
    } catch (e) {
      console.error('[renderUserCards] 失敗', e);
      grid.innerHTML =
        '<button class="user-card" data-user="JOE">🧑‍🎓 JOE 👉 點擊進入</button>' +
        '<button class="user-card" data-user="LEO">🧑‍🚀 LEO 👉 點擊進入</button>';
      grid.querySelectorAll('.user-card').forEach(c => {
        c.addEventListener('click', () => {
          switchToUser(c.dataset.user);
          showScreen('start');
        });
      });
    }
  }

  /* ========== 商店 ========== */
  function renderShop() {
    const grid = $('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(ITEMS).forEach(key => {
      const it = ITEMS[key];
      const owned = save.inventory[key] || 0;
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<div class="shop-emoji">' + it.emoji + '</div>' +
        '<div class="shop-name">' + it.name + '</div>' +
        '<div class="shop-desc">' + it.desc + '</div>' +
        '<div class="shop-price">💎 ' + it.price + '</div>' +
        '<button class="mc-btn mc-btn--wood mc-btn--sm shop-buy" data-item="' + key + '">購 買</button>' +
        '<div class="shop-owned">擁有：' + owned + '</div>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('.shop-buy').forEach(btn => {
      btn.addEventListener('click', () => buyItem(btn.dataset.item));
    });
  }
  function buyItem(key) {
    const it = ITEMS[key];
    if (!it) return;
    if (save.totalGems < it.price) {
      flashMsg('💎 寶石不夠！');
      return;
    }
    save.totalGems -= it.price;
    save.inventory[key] = (save.inventory[key] || 0) + 1;
    persist();
    refreshSaveSummary();
    renderShop();
    playSfx('buy');
  }

  /* ========== 飄字提示 ========== */
  function flashMsg(text) {
    const el = document.createElement('div');
    el.className = 'flash-msg';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  /* ========== 關卡選單 ========== */
  function renderLevelGrid() {
    const grid = $('level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    window.LEVELS.forEach((lv) => {
      const rec = getLevelRecord(lv.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card' + (rec.stars >= 3 ? ' level-card--gold' : (rec.stars > 0 ? ' level-card--done' : ''));
      card.innerHTML =
        '<div class="level-num">Lv.' + lv.id + '</div>' +
        '<div class="level-emoji">' + (lv.emoji || '📦') + '</div>' +
        '<div class="level-name">' + lv.name + '</div>' +
        '<div class="level-stars">' + starsString(rec.stars) + '</div>' +
        (rec.bestScore > 0 ? '<div class="level-best">最佳 ' + rec.bestScore + '</div>' : '');
      card.addEventListener('click', () => { playSfx('click'); startLevel(lv.id); });
      grid.appendChild(card);
    });
  }

  /* ========== HUD / 怪物 / 題目 ========== */
  function renderHUD(opts) {
    const heartLost = opts && opts.heartLost;
    const heartsEl = $('hud-hearts');
    heartsEl.innerHTML = '';
    for (let i = 0; i < state.maxHearts; i++) {
      const h = document.createElement('span');
      const alive = i < state.hearts;
      h.className = 'heart' + (alive ? '' : ' lost') + (heartLost && i === state.hearts ? ' shake' : '');
      h.textContent = alive ? '❤️' : '🖤';
      heartsEl.appendChild(h);
    }
    $('hud-score').textContent = state.score;
    $('hud-progress').textContent =
      Math.min(state.questionIndex + 1, state.totalQuestions) + ' / ' + state.totalQuestions;
    if (state.currentLevel) {
      if (state.gameMode === 'level') {
        $('level-title').textContent = 'Lv.' + state.currentLevel.id + ' ' + state.currentLevel.emoji + ' ' + state.currentLevel.name;
      } else {
        $('level-title').textContent = state.currentLevel.emoji + ' ' + state.currentLevel.name;
      }
    }
  }

  function renderMonsterUI(opts) {
    const idx = ((state.currentLevel ? state.currentLevel.id : 1) + state.monstersKilled - 1) % MONSTERS.length;
    const sprite = $('monster-sprite');
    sprite.innerHTML = renderMonster(idx);
    sprite.className = 'monster-sprite' + (opts && opts.spawn ? ' spawn' : '');
    const fill = $('monster-hp-fill');
    const ratio = state.monsterHp / state.monsterMaxHp;
    fill.style.width = (ratio * 100) + '%';
    fill.style.background =
      ratio > 0.66 ? 'linear-gradient(to bottom, #7FB040, #5D8A3A)' :
      ratio > 0.33 ? 'linear-gradient(to bottom, #F4C430, #B8860B)' :
                     'linear-gradient(to bottom, #FF6B6B, #B22222)';
    $('monster-hp-text').textContent = state.monsterHp + ' / ' + state.monsterMaxHp;

    // 同步繪製主角（只需要繪一次，之後 SVG 會留著）
    const playerSprite = $('player-sprite');
    if (playerSprite && !playerSprite.dataset.rendered) {
      playerSprite.innerHTML = renderPlayer();
      playerSprite.dataset.rendered = '1';
    }
  }

  function renderItemBar() {
    const bar = $('item-bar');
    bar.innerHTML = '';
    Object.keys(ITEMS).forEach(key => {
      const it = ITEMS[key];
      const cnt = save.inventory[key] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-btn' + (cnt <= 0 ? ' disabled' : '');
      btn.dataset.item = key;
      btn.title = it.name + '：' + it.desc;
      btn.innerHTML =
        '<span class="item-icon">' + it.emoji + '</span>' +
        '<span class="item-count">x' + cnt + '</span>';
      btn.addEventListener('click', () => useItem(key));
      bar.appendChild(btn);
    });
  }

  function renderQuestion(word, choices, onChoose) {
    state.answered = false;
    state.eliminated = [];
    $('word-text').textContent = word.en;

    const hintContent = $('hint-content');
    hintContent.hidden = true;
    hintContent.textContent = word.hint || '（這個單字還沒有提示）';

    const optsEl = $('options');
    optsEl.innerHTML = '';
    choices.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.className = 'mc-btn mc-btn--stone option-btn';
      btn.type = 'button';
      btn.dataset.idx = idx;
      btn.dataset.en = c.en;
      btn.textContent = c.zh;
      btn.addEventListener('click', () => {
        if (state.answered) return;
        if (btn.classList.contains('eliminated')) return;
        state.answered = true;
        const correct = c.en === word.en;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          Array.from(optsEl.children).forEach((b) => {
            if (b.dataset.en === word.en) b.classList.add('correct');
          });
        }
        onChoose(correct, c);
      });
      optsEl.appendChild(btn);
    });
    renderItemBar();
  }

  /* ========== 動畫 / 戰鬥效果 ========== */
  function playerAttack(damage) {
    const monster = $('monster');
    const slash  = $('slash-effect');
    const player = $('player');
    monster.classList.remove('hit', 'die');
    slash.classList.remove('show');
    if (player) player.classList.remove('attack');
    void monster.offsetWidth;
    if (player) player.classList.add('attack');
    // 主角衝刺到一半才命中怪物（像素感更強）
    setTimeout(() => {
      slash.classList.add('show');
      monster.classList.add('hit');
      showDamage('-' + damage, 'damage-monster');
      playSfx('attack');
    }, 220);
    setTimeout(() => {
      slash.classList.remove('show');
      if (player) player.classList.remove('attack');
    }, 600);
  }
  function monsterAttack() {
    const stage = $('battle-area');
    const monster = $('monster');
    const player = $('player');
    monster.classList.add('attack');
    if (player) player.classList.add('hurt');
    stage.classList.add('player-hit');
    showDamage('-1❤️', 'damage-player');
    playSfx('hurt');
    setTimeout(() => {
      monster.classList.remove('attack');
      if (player) player.classList.remove('hurt');
      stage.classList.remove('player-hit');
    }, 600);
  }
  function monsterDie(callback) {
    const monster = $('monster');
    const player = $('player');
    monster.classList.add('die');
    if (player) player.classList.add('victory');
    showDamage('+5💎', 'gem-bonus');
    playSfx('kill');
    setTimeout(() => {
      monster.classList.remove('die');
      if (player) player.classList.remove('victory');
      if (callback) callback();
    }, 700);
  }
  function showDamage(text, cls) {
    const el = document.createElement('div');
    el.className = 'damage-num ' + cls;
    el.textContent = text;
    $('battle-area').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ========== 強烈答對視覺特效 ========== */
  // 1) 五彩紙屑爆破
  function spawnConfetti(count) {
    const stage = $('battle-area');
    if (!stage) return;
    const colors = ['#FFD700','#FF6B6B','#4FC3F7','#7FB040','#E91E63','#FF8A20','#9C27B0'];
    const n = count || 16;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'confetti';
      const ang = (Math.PI * 2 * i) / n + (Math.random() * 0.4 - 0.2);
      const dist = 80 + Math.random() * 140;
      p.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist - 60) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.background = colors[i % colors.length];
      p.style.left = (45 + Math.random() * 10) + '%';
      p.style.top = '38%';
      stage.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }
  // 2) Combo 文字（GREAT! / 連勝 x N）
  function showComboText(streak) {
    const el = document.createElement('div');
    el.className = 'combo-text';
    let txt;
    if (streak >= 8)      { txt = '🔥 NO MERCY x' + streak + ' 🔥'; el.classList.add('combo-fire'); }
    else if (streak >= 5) { txt = '⚡ AMAZING x' + streak + ' ⚡'; el.classList.add('combo-amazing'); }
    else if (streak >= 3) { txt = '✨ COMBO x' + streak + ' ✨'; el.classList.add('combo-combo'); }
    else                  { txt = 'GREAT!'; }
    el.textContent = txt;
    $('battle-area').appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  // 3) 螢幕綠色閃光
  function spawnScreenFlash() {
    const f = document.createElement('div');
    f.className = 'screen-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 420);
  }
  // 4) 連勝徽章 HUD 更新
  function renderStreak() {
    const wrap = $('hud-streak');
    const num  = $('streak-num');
    if (!wrap || !num) return;
    if (state.correctStreak >= 2) {
      wrap.hidden = false;
      wrap.className = 'hud-streak' + (state.correctStreak >= 5 ? ' is-hot' : '');
      num.textContent = state.correctStreak;
    } else {
      wrap.hidden = true;
    }
  }

  /* ========== 道具使用 ========== */
  function useItem(key) {
    if (state.answered) return;
    const cnt = save.inventory[key] || 0;
    if (cnt <= 0) { flashMsg('沒有這個道具！'); return; }

    if (key === 'heart') {
      if (state.hearts >= state.maxHearts) { flashMsg('愛心已滿！'); return; }
      state.hearts++;
      save.inventory.heart--;
      renderHUD();
      flashMsg('❤️ +1');
    } else if (key === 'fiftyFifty') {
      const word = state.currentWord;
      const wrongs = Array.from(document.querySelectorAll('#options .option-btn'))
        .filter(b => b.dataset.en !== word.en && !b.classList.contains('eliminated'));
      if (wrongs.length < 2) { flashMsg('沒有可消除的'); return; }
      // 隨機消除 2 個錯誤
      const shuffled = wrongs.sort(() => Math.random() - 0.5);
      shuffled.slice(0, 2).forEach(b => b.classList.add('eliminated'));
      save.inventory.fiftyFifty--;
      flashMsg('✂️ 砍掉 2 個錯誤');
    } else if (key === 'skip') {
      save.inventory.skip--;
      flashMsg('⏭️ 跳過此題');
      state.answered = true;
      // 顯示正解
      Array.from(document.querySelectorAll('#options .option-btn')).forEach(b => {
        if (b.dataset.en === state.currentWord.en) b.classList.add('correct');
      });
      setTimeout(() => { state.questionIndex++; nextQuestion(); }, 800);
    } else if (key === 'bomb') {
      save.inventory.bomb--;
      flashMsg('💣 雷霆強擊！');
      state.activeBomb = true;
      // 立即模擬答對
      state.answered = true;
      Array.from(document.querySelectorAll('#options .option-btn')).forEach(b => {
        if (b.dataset.en === state.currentWord.en) b.classList.add('correct');
      });
      onAnswer(true);
    }
    persist();
    renderItemBar();
  }

  /* ========== 流程 ========== */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickChoices(correct, pool, n) {
    n = n || 4;
    const distractors = shuffle(pool.filter((w) => w.en !== correct.en)).slice(0, n - 1);
    return shuffle([correct].concat(distractors));
  }

  /* ---------- 每日挑戰：用日期當種子，當天所有玩家題目相同 ---------- */
  function getTodayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function dailySeedFor(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(h) || 1;
  }
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function getAllVocab() {
    const all = [];
    window.LEVELS.forEach(lv => lv.words.forEach(w => all.push(w)));
    return all;
  }
  function getDailyWords(n) {
    n = n || 10;
    const all = getAllVocab();
    const rand = seededRandom(dailySeedFor(getTodayKey()));
    const a = all.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, n);
  }

  let sessionWords = [];
  let remainingWords = [];   // 本場剩下未抽的字（依連勝動態抽）
  let playedWords = [];      // 本場已實際出過題的字（用於 seenWords）

  /**
   * 動態難度：依當前連勝挑下一題
   *  - streak 0-1：在「短的一半」抽（基礎題）
   *  - streak 2-3：中等
   *  - streak 4+ ：往長的抽
   *  - streak 6+ ：直接從最長段挑
   * pool 太小時自動 fallback。
   */
  function pickByStreak(pool) {
    if (!pool.length) return null;
    const sorted = pool.slice().sort((a, b) => a.en.length - b.en.length);
    const n = sorted.length;
    let band;
    const s = state.correctStreak;
    if (s >= 6) {
      band = sorted.slice(Math.floor(n * 0.7));   // 最難 30%
    } else if (s >= 4) {
      band = sorted.slice(Math.floor(n * 0.5));   // 中上
    } else if (s >= 2) {
      band = sorted.slice(Math.floor(n * 0.25), Math.ceil(n * 0.85));  // 中段
    } else {
      band = sorted.slice(0, Math.max(1, Math.ceil(n * 0.6)));         // 短的一半
    }
    if (!band.length) band = sorted;
    return band[Math.floor(Math.random() * band.length)];
  }

  /**
   * 同關多次：優先抽未出過的單字
   * - 未出過 ≥ 10 → 全部從未出過裡抽
   * - 未出過 = 0 → 自動重置「已出過」紀錄、整關重新開始
   * - 0 < 未出過 < 10 → 未出過全用 + 從出過的補滿
   */
  function pickLevelSession(level) {
    const rec = save.levels[level.id] || { stars: 0, bestScore: 0, plays: 0, seenWords: [] };
    if (!rec.seenWords) rec.seenWords = [];
    const seenSet = new Set(rec.seenWords);
    const unseen = level.words.filter(w => !seenSet.has(w.en));
    let picked;
    if (unseen.length >= state.totalQuestions) {
      picked = shuffle(unseen).slice(0, state.totalQuestions);
    } else if (unseen.length === 0) {
      // 已全部出過 → 重置
      rec.seenWords = [];
      save.levels[level.id] = rec;
      persist();
      flashMsg('🔁 本關已全部出過，重新開始！');
      picked = shuffle(level.words).slice(0, state.totalQuestions);
    } else {
      const seenWords = level.words.filter(w => seenSet.has(w.en));
      picked = shuffle(unseen.concat(shuffle(seenWords).slice(0, state.totalQuestions - unseen.length)));
    }
    return picked;
  }

  function startLevel(levelId) {
    const level = window.LEVELS.find(l => l.id === levelId);
    if (!level) return;
    state.currentLevel = level;
    resetState();
    state.gameMode = 'level';
    sessionWords = pickLevelSession(level);
    remainingWords = sessionWords.slice();
    playedWords = [];
    showScreen('game');
    renderHUD();
    renderMonsterUI({ spawn: true });
    renderItemBar();
    renderStreak();
    nextQuestion();
  }

  /* ---------- 錯題複習 ---------- */
  function startMistakeReview() {
    const pool = (save.mistakes || []).slice();
    if (pool.length === 0) {
      flashMsg('📓 還沒有錯題！');
      return;
    }
    state.currentLevel = {
      id: '__mistake__',
      emoji: '📓',
      name: '錯題複習',
      words: pool
    };
    resetState();
    state.gameMode = 'mistake';
    sessionWords = shuffle(pool).slice(0, Math.min(10, pool.length));
    state.totalQuestions = sessionWords.length;
    remainingWords = sessionWords.slice();
    playedWords = [];
    showScreen('game');
    renderHUD();
    renderMonsterUI({ spawn: true });
    renderItemBar();
    renderStreak();
    nextQuestion();
  }

  /* ---------- 每日挑戰 ---------- */
  function startDaily() {
    const todayKey = getTodayKey();
    const dailyWords = getDailyWords(10);
    state.currentLevel = {
      id: '__daily_' + todayKey + '__',
      emoji: '🌟',
      name: '每日挑戰 ' + todayKey,
      words: dailyWords
    };
    resetState();
    state.gameMode = 'daily';
    state.dailyKey = todayKey;
    sessionWords = dailyWords.slice();
    state.totalQuestions = sessionWords.length;
    remainingWords = sessionWords.slice();
    playedWords = [];
    showScreen('game');
    renderHUD();
    renderMonsterUI({ spawn: true });
    renderItemBar();
    renderStreak();
    nextQuestion();
  }
  function nextQuestion() {
    if (state.questionIndex >= state.totalQuestions || state.hearts <= 0 || remainingWords.length === 0) {
      return endGame();
    }
    // 依連勝挑下一題
    const word = pickByStreak(remainingWords);
    const idx = remainingWords.indexOf(word);
    if (idx >= 0) remainingWords.splice(idx, 1);
    state.currentWord = word;
    playedWords.push(word);
    // 一般關卡用該關單字當干擾；錯題/每日從全字庫
    const pool = (state.gameMode === 'level') ? state.currentLevel.words : getAllVocab();
    const choices = pickChoices(word, pool);
    renderHUD();
    renderQuestion(word, choices, onAnswer);
    setTimeout(() => speak(word.en), 300);
  }
  function spawnNewMonster() {
    state.monsterHp = state.monsterMaxHp;
    renderMonsterUI({ spawn: true });
  }
  function onAnswer(correct) {
    // 錯題池更新
    if (correct) {
      // 在錯題模式答對 → 從錯題池移除
      if (state.gameMode === 'mistake') {
        const en = state.currentWord.en;
        save.mistakes = save.mistakes.filter(w => w.en !== en);
        persist();
      }
    } else {
      // 不在錯題模式 → 答錯就加進錯題池（去重）
      if (state.gameMode !== 'mistake') {
        const w = state.currentWord;
        if (!save.mistakes.some(m => m.en === w.en)) {
          save.mistakes.push({ en: w.en, zh: w.zh, hint: w.hint });
          persist();
        }
      }
    }

    if (correct) {
      // 連勝累積（觸發升級提示）
      const prevTier = streakTier(state.correctStreak);
      state.correctStreak += 1;
      if (state.correctStreak > state.bestStreakInSession) state.bestStreakInSession = state.correctStreak;
      const newTier = streakTier(state.correctStreak);
      const tierUp = newTier > prevTier;

      const bombed = state.activeBomb;
      state.activeBomb = false;

      const damage = bombed ? state.monsterMaxHp : 1;
      // 連勝 ≥3 加 1💎、≥5 加 2💎、≥8 加 3💎（小額連勝獎勵）
      const streakBonus = state.correctStreak >= 8 ? 3
                        : state.correctStreak >= 5 ? 2
                        : state.correctStreak >= 3 ? 1 : 0;
      const gems   = (bombed ? state.scorePerCorrect * 2 : state.scorePerCorrect) + streakBonus;
      state.score += gems;

      // ===== 強烈答對視覺特效 =====
      spawnConfetti(state.correctStreak >= 5 ? 28 : 16);
      showComboText(state.correctStreak);
      spawnScreenFlash();
      playSfx(state.correctStreak >= 3 ? 'combo' : 'correct');
      if (tierUp) {
        setTimeout(() => playSfx('levelup'), 240);
        flashMsg('🆙 難度提升！更長的單字來了');
      }

      if (bombed) {
        // 強擊先爆炸再砍
        const monster = $('monster');
        monster.classList.add('bombed');
        playSfx('bomb');
        setTimeout(() => monster.classList.remove('bombed'), 500);
      }
      playerAttack(damage);
      state.monsterHp -= damage;
      if (state.monsterHp <= 0) {
        state.monsterHp = 0;
        state.monstersKilled++;
        renderMonsterUI();
        setTimeout(() => {
          monsterDie(() => {
            if (state.questionIndex + 1 < state.totalQuestions && state.hearts > 0) {
              spawnNewMonster();
            }
          });
        }, 350);
      } else {
        setTimeout(renderMonsterUI, 350);
      }
    } else {
      // 答錯：連勝歸零，下一題會退回基礎難度
      const lostStreak = state.correctStreak;
      state.correctStreak = 0;
      state.hearts -= 1;
      monsterAttack();
      playSfx('wrong');
      if (lostStreak >= 3) flashMsg('💔 連勝中斷（' + lostStreak + '）→ 退回基礎題');
    }
    renderStreak();
    renderHUD({ heartLost: !correct });
    const delay = correct ? 1300 : 1700;
    setTimeout(() => { state.questionIndex++; nextQuestion(); }, delay);
  }
  // 連勝難度等級：0(易) → 1(中) → 2(難) → 3(極難)
  function streakTier(s) {
    if (s >= 6) return 3;
    if (s >= 4) return 2;
    if (s >= 2) return 1;
    return 0;
  }
  function calcStars() {
    if (state.hearts <= 0) return 0;
    const total = state.totalQuestions * state.scorePerCorrect;
    const r = state.score / total;
    if (r >= 1) return 3;
    if (r >= 0.7) return 2;
    if (r >= 0.4) return 1;
    return 0;
  }
  function endGame() {
    const stars = calcStars();
    let isNewBest = false;
    let bonusMsg = '';

    if (state.gameMode === 'level') {
      const prev = getLevelRecord(state.currentLevel.id);
      isNewBest = stars > prev.stars || state.score > prev.bestScore;
      updateLevelRecord(state.currentLevel.id, state.score, stars, state.monstersKilled);
      // 紀錄真的有出過題的單字（不重複出題用，依 playedWords 而非全部 sessionWords）
      const rec = save.levels[state.currentLevel.id] || { stars: 0, bestScore: 0, plays: 0, seenWords: [] };
      if (!rec.seenWords) rec.seenWords = [];
      playedWords.forEach(w => { if (rec.seenWords.indexOf(w.en) < 0) rec.seenWords.push(w.en); });
      save.levels[state.currentLevel.id] = rec;
      persist();
      renderLevelGrid();
    } else if (state.gameMode === 'daily') {
      save.totalGems += state.score + (state.monstersKilled || 0) * 5;
      const todayKey = state.dailyKey;
      const prev = save.dailyClears[todayKey];
      if (!prev && state.hearts > 0) {
        // 首次過關 → 額外 +50💎
        save.totalGems += 50;
        save.dailyClears[todayKey] = { score: state.score, stars: stars, bonus: 50 };
        isNewBest = true;
        bonusMsg = '🌟 每日首勝獎勵 +50💎';
      } else if (prev && (stars > prev.stars || state.score > prev.score)) {
        prev.stars = Math.max(prev.stars, stars);
        prev.score = Math.max(prev.score, state.score);
        isNewBest = true;
      }
      persist();
    } else if (state.gameMode === 'mistake') {
      save.totalGems += state.score + (state.monstersKilled || 0) * 5;
      persist();
    }
    refreshSaveSummary();

    $('end-score').textContent = state.score;
    $('end-hearts').textContent = state.hearts;
    $('end-killed').textContent = state.monstersKilled;
    $('end-level-name').textContent =
      (state.gameMode === 'level' ? 'Lv.' + state.currentLevel.id + ' ' : '') +
      state.currentLevel.emoji + ' ' + state.currentLevel.name;
    $('star-display').textContent = starsString(stars);

    const title = $('end-title');
    const rank  = $('end-rank');
    if (state.hearts > 0) {
      if (state.gameMode === 'mistake') {
        title.textContent = '📓 錯題複習完成！';
        const remain = save.mistakes.length;
        rank.textContent = remain === 0
          ? '🏆 太強了！錯題池清空！'
          : '剩 ' + remain + ' 個錯題待消滅';
      } else if (state.gameMode === 'daily') {
        title.textContent = '🌟 每日挑戰完成！';
        rank.textContent = bonusMsg || '今日已挑戰過，繼續加油！';
      } else {
        title.textContent = '🎉 關卡完成！';
        if (stars === 3) rank.textContent = '⭐⭐⭐ 鑽石礦工！全勝！';
        else if (stars === 2) rank.textContent = '⭐⭐ 黃金礦工！';
        else if (stars === 1) rank.textContent = '⭐ 石頭礦工，再挑戰一次！';
        else rank.textContent = '🪨 過關了，但要再加油！';
      }
    } else {
      title.textContent = '💀 你被怪物擊敗了';
      rank.textContent = '愛心用光了，再來一次！';
    }
    $('end-newbest').hidden = !isNewBest;

    if (state.hearts > 0 && stars === 3) playSfx('win');
    showScreen('end');
  }

  /* ========== 事件綁定 ========== */
  function bindEvents() {
    // 換玩家
    const btnSwitch = $('btn-switch-user');
    if (btnSwitch) btnSwitch.addEventListener('click', () => {
      playSfx('click');
      renderUserCards();
      showScreen('user');
    });
    const btnUserBack = $('btn-user-back');
    if (btnUserBack) btnUserBack.addEventListener('click', () => { playSfx('click'); showScreen('start'); });

    $('btn-play').addEventListener('click', () => {
      playSfx('click');
      refreshSaveSummary();
      renderLevelGrid();
      showScreen('select');
    });
    $('btn-back-to-start').addEventListener('click', () => { playSfx('click'); showScreen('start'); });
    $('btn-clear-save').addEventListener('click', clearSave);

    // 每日挑戰 / 錯題複習
    $('btn-daily').addEventListener('click', () => { playSfx('click'); startDaily(); });
    $('btn-mistakes').addEventListener('click', () => { playSfx('click'); startMistakeReview(); });

    $('btn-shop').addEventListener('click', () => {
      playSfx('click');
      refreshSaveSummary();
      renderShop();
      showScreen('shop');
    });
    $('btn-shop-back').addEventListener('click', () => {
      playSfx('click');
      renderLevelGrid();
      refreshSaveSummary();
      showScreen('select');
    });

    $('btn-quit').addEventListener('click', () => {
      if (confirm('要中途退出本關嗎？目前進度不會儲存。')) {
        playSfx('click');
        renderLevelGrid();
        refreshSaveSummary();
        showScreen('select');
      }
    });
    $('btn-retry').addEventListener('click', () => {
      playSfx('click');
      if (state.gameMode === 'daily') startDaily();
      else if (state.gameMode === 'mistake') startMistakeReview();
      else startLevel(state.currentLevel.id);
    });
    $('btn-to-select').addEventListener('click', () => {
      playSfx('click'); renderLevelGrid(); refreshSaveSummary(); showScreen('select');
    });
    $('btn-speak').addEventListener('click', () => { if (state.currentWord) speak(state.currentWord.en); });
    $('btn-hint').addEventListener('click', () => {
      const el = $('hint-content');
      el.hidden = !el.hidden;
      playSfx('click');
    });

    // 鍵盤快捷鍵
    window.addEventListener('keydown', (e) => {
      if (!$('game-screen').classList.contains('active')) return;
      const key = e.key.toLowerCase();
      if (['1','2','3','4'].indexOf(key) >= 0) {
        const i = parseInt(key, 10) - 1;
        const btns = document.querySelectorAll('#options .option-btn');
        if (btns[i]) btns[i].click();
      } else if (key === 'h') $('btn-hint').click();
      else if (key === 's') $('btn-speak').click();
      else if (key === 'escape') $('btn-quit').click();
      else if (key === 'q') document.querySelector('.item-btn[data-item="heart"]').click();
      else if (key === 'w') document.querySelector('.item-btn[data-item="bomb"]').click();
      else if (key === 'e') document.querySelector('.item-btn[data-item="fiftyFifty"]').click();
      else if (key === 'r') document.querySelector('.item-btn[data-item="skip"]').click();
    });
  }

  /* ========== 啟動 ========== */
  function init() {
    if (!window.LEVELS || !window.LEVELS.length) {
      alert('單字資料尚未載入。');
      return;
    }
    migrateLegacySave();
    bindEvents();

    // 預載「上次使用者」資料（讓 currentUser 不為 null，存檔/UI 可用）
    let lastUser = null;
    try { lastUser = localStorage.getItem(ACTIVE_USER_KEY); } catch (_) {}
    if (lastUser && USERS.indexOf(lastUser) >= 0) {
      currentUser = lastUser;
      save = loadSaveFor(lastUser);
      refreshSaveSummary();
    }

    // 永遠先顯示玩家選擇畫面（兩位玩家共用裝置時才不會誤進對方帳號）
    renderUserCards();
    showScreen('user');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
