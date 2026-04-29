/**
 * Web Speech API 發音模組
 * 自動挑選最佳英文語音；首次使用者互動後才能穩定朗讀（瀏覽器限制）
 */

let preferredVoice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  preferredVoice =
    voices.find(v => /en-US/i.test(v.lang) && /samantha|google|zira|ava|jenny/i.test(v.name)) ||
    voices.find(v => /en-GB/i.test(v.lang) && /google|hazel/i.test(v.name)) ||
    voices.find(v => /^en[-_]/i.test(v.lang)) ||
    voices[0];
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = pickVoice;
  pickVoice();
}

export function speak(text, { rate = 0.85, pitch = 1.0 } = {}) {
  if (!('speechSynthesis' in window)) {
    console.warn('[audio] 此瀏覽器不支援 Web Speech API');
    return;
  }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    if (preferredVoice) u.voice = preferredVoice;
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn('[audio] 發音失敗', err);
  }
}

/** 播放答對 / 答錯的簡易 8-bit 音效（WebAudio 合成，零檔案） */
let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playSfx(type) {
  try {
    const ac = ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.connect(gain).connect(ac.destination);
    gain.gain.setValueAtTime(0.08, ac.currentTime);

    if (type === 'correct') {
      // 上升兩音
      osc.frequency.setValueAtTime(660, ac.currentTime);
      osc.frequency.setValueAtTime(880, ac.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      osc.start();
      osc.stop(ac.currentTime + 0.26);
    } else if (type === 'wrong') {
      osc.frequency.setValueAtTime(220, ac.currentTime);
      osc.frequency.setValueAtTime(160, ac.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3);
      osc.start();
      osc.stop(ac.currentTime + 0.31);
    } else if (type === 'click') {
      osc.frequency.setValueAtTime(520, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08);
      osc.start();
      osc.stop(ac.currentTime + 0.09);
    }
  } catch (_) { /* 忽略 autoplay 限制錯誤 */ }
}
