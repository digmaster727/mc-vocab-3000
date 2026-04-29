/**
 * 全域遊戲狀態
 * 單一 state 物件 + 重置函式，簡單直觀。
 */

export const state = {
  hearts: 3,
  maxHearts: 3,
  score: 0,
  scorePerCorrect: 10,
  questionIndex: 0,
  totalQuestions: 10,
  currentWord: null,
  answered: false,
};

export function resetState() {
  state.hearts = state.maxHearts;
  state.score = 0;
  state.questionIndex = 0;
  state.currentWord = null;
  state.answered = false;
}
