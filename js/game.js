/**
 * 主控流程：載入資料 → 綁定事件 → 關卡循環
 */
import { state, resetState } from './store.js';
import { showScreen, renderHUD, renderQuestion, renderEnd } from './ui.js';
import { speak, playSfx } from './audio.js';

let vocab = [];
let sessionWords = [];

/* ---------- 工具 ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickChoices(correct, pool, n = 4) {
  const distractors = shuffle(pool.filter((w) => w.en !== correct.en)).slice(0, n - 1);
  return shuffle([correct, ...distractors]);
}

/* ---------- 資料載入 ---------- */
async function loadVocab() {
  try {
    const res = await fetch('data/vocab.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    vocab = await res.json();
  } catch (err) {
    // 以 file:// 直接打開時 fetch 可能失敗 → 退回內嵌種子資料
    console.warn('[game] vocab.json 載入失敗，使用內嵌備援資料', err);
    vocab = FALLBACK_VOCAB;
  }
  if (!vocab.length) throw new Error('單字資料為空');
}

/* ---------- 關卡流程 ---------- */
function startGame() {
  resetState();
  const pool = vocab.length >= state.totalQuestions ? vocab : vocab;
  sessionWords = shuffle(pool).slice(0, state.totalQuestions);
  showScreen('game');
  renderHUD();
  nextQuestion();
}

function nextQuestion() {
  if (state.questionIndex >= state.totalQuestions || state.hearts <= 0) {
    return endGame();
  }
  const word = sessionWords[state.questionIndex];
  state.currentWord = word;
  const choices = pickChoices(word, vocab);
  renderHUD();
  renderQuestion(word, choices, onAnswer);
  // 題目出現自動朗讀（延遲讓動畫先開始）
  setTimeout(() => speak(word.en), 300);
}

function onAnswer(correct) {
  if (correct) {
    state.score += state.scorePerCorrect;
    playSfx('correct');
  } else {
    state.hearts -= 1;
    playSfx('wrong');
  }
  renderHUD({ heartLost: !correct });

  const delay = correct ? 1000 : 1600; // 答錯多停一下讓學生看正解
  setTimeout(() => {
    state.questionIndex += 1;
    nextQuestion();
  }, delay);
}

function endGame() {
  showScreen('end');
  renderEnd();
}

/* ---------- 事件綁定 ---------- */
function bindEvents() {
  document.getElementById('btn-start').addEventListener('click', () => {
    playSfx('click');
    startGame();
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    playSfx('click');
    startGame();
  });
  document.getElementById('btn-speak').addEventListener('click', () => {
    if (state.currentWord) speak(state.currentWord.en);
  });
  document.getElementById('btn-hint').addEventListener('click', () => {
    const el = document.getElementById('hint-content');
    el.hidden = !el.hidden;
    playSfx('click');
  });

  // 鍵盤快捷鍵：1-4 選答、H 提示、S 發音
  window.addEventListener('keydown', (e) => {
    if (!document.getElementById('game-screen').classList.contains('active')) return;
    const key = e.key.toLowerCase();
    if (['1', '2', '3', '4'].includes(key)) {
      const i = parseInt(key, 10) - 1;
      const btns = document.querySelectorAll('#options .option-btn');
      if (btns[i]) btns[i].click();
    } else if (key === 'h') {
      document.getElementById('btn-hint').click();
    } else if (key === 's') {
      document.getElementById('btn-speak').click();
    }
  });
}

/* ---------- 內嵌備援（file:// 直接開啟時用） ---------- */
const FALLBACK_VOCAB = [
  { en: 'apple', zh: '蘋果', hint: '諧音：阿婆賣的水果 🍎' },
  { en: 'book',  zh: '書本', hint: 'B 像兩本疊起來的書 📚' },
  { en: 'cat',   zh: '貓',   hint: 'C 開頭短短的就是貓 🐱' },
  { en: 'dog',   zh: '狗',   hint: '諧音：逗哥 🐶' },
  { en: 'egg',   zh: '蛋',   hint: '兩個 g 像兩顆蛋黃 🥚' },
  { en: 'fish',  zh: '魚',   hint: 'fi 像魚頭、sh 像魚尾 🐟' },
  { en: 'good',  zh: '好的', hint: '兩個 o 像比讚的眼睛 👍' },
  { en: 'happy', zh: '快樂的', hint: '諧音：哈批 😊' },
  { en: 'ice',   zh: '冰',   hint: 'I see ice 🧊' },
  { en: 'juice', zh: '果汁', hint: '諧音：啾司 🧃' },
  { en: 'king',  zh: '國王', hint: 'King Kong 大王 👑' },
  { en: 'love',  zh: '愛',   hint: '把 O 當成愛心 ❤️' },
];

/* ---------- 啟動 ---------- */
(async function init() {
  bindEvents();
  try {
    await loadVocab();
  } catch (err) {
    console.error('[game] 初始化失敗', err);
    alert('單字資料載入失敗，請改用本地伺服器（例如 VSCode Live Server）開啟。');
  }
})();
