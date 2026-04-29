/**
 * UI 渲染模組：負責 DOM 操作與動畫觸發
 */
import { state } from './store.js';
import { renderPixelIcon } from './imageProvider.js';

const $ = (id) => document.getElementById(id);

const screens = {
  start: $('start-screen'),
  game:  $('game-screen'),
  end:   $('end-screen'),
};

export function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/** HUD：血量 / 寶石 / 進度 */
export function renderHUD({ heartLost = false } = {}) {
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
    `${Math.min(state.questionIndex + 1, state.totalQuestions)} / ${state.totalQuestions}`;
}

/**
 * 渲染題目
 * @param {{en:string,zh:string,hint:string}} word
 * @param {Array} choices  4 個選項，含正解
 * @param {(correct:boolean, chosen:object)=>void} onChoose
 */
export function renderQuestion(word, choices, onChoose) {
  state.answered = false;

  // 單字與圖片
  $('word-text').textContent = word.en;
  $('word-image').innerHTML = renderPixelIcon(word.en);

  // 提示區塊收合 & 換文字
  const hintContent = $('hint-content');
  hintContent.hidden = true;
  hintContent.textContent = word.hint || '（這個單字還沒有提示）';

  // 重置方塊動畫 class
  const block = $('word-block');
  block.classList.remove('cracked', 'shake');
  // 觸發一次 reflow 讓動畫能重新播放
  void block.offsetWidth;

  // 重繪選項
  const optsEl = $('options');
  optsEl.innerHTML = '';
  choices.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'mc-btn mc-btn--stone option-btn';
    btn.type = 'button';
    btn.textContent = c.zh;
    btn.addEventListener('click', () => {
      if (state.answered) return;
      state.answered = true;
      const correct = c.en === word.en;

      btn.classList.add(correct ? 'correct' : 'wrong');
      if (correct) {
        block.classList.add('cracked');
      } else {
        block.classList.add('shake');
        // 同步把正確答案高亮提示
        [...optsEl.children].forEach((b) => {
          if (b.textContent === word.zh) b.classList.add('correct');
        });
      }
      onChoose(correct, c);
    });
    optsEl.appendChild(btn);
  });
}

/** 結算畫面 */
export function renderEnd() {
  $('end-score').textContent = state.score;
  $('end-hearts').textContent = state.hearts;

  const title = $('end-title');
  const rank  = $('end-rank');
  if (state.hearts > 0) {
    title.textContent = '🎉 關卡完成！';
    // 依分數給評價
    const total = state.totalQuestions * state.scorePerCorrect;
    const ratio = state.score / total;
    if (ratio >= 1)       rank.textContent = '⭐⭐⭐ 鑽石礦工！全部答對！';
    else if (ratio >= 0.7) rank.textContent = '⭐⭐ 黃金礦工，繼續加油！';
    else if (ratio >= 0.4) rank.textContent = '⭐ 石頭礦工，再挖一次試試！';
    else                   rank.textContent = '🪨 新手礦工，別灰心！';
  } else {
    title.textContent = '💀 挑戰失敗';
    rank.textContent  = '愛心用光了，重新冒險吧！';
  }
}
