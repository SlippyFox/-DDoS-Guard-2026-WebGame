<template>
  <div id="ddos-ninja-wrap">
    <div v-if="step !== 'game'" class="screen">
      <div class="card">
        <img src="./assets/logo_basic.svg" alt="DDoS-Guard" class="logo">
        
        <div v-if="step === 'reg'">
          <h1>DDoS NINJA PRO</h1>
          <input v-model="user.name" placeholder="Имя игрока" class="ninja-input" />
          <input v-model="user.phone" placeholder="Телефон" class="ninja-input" />
          <button @click="start" class="ninja-btn">НАЧАТЬ</button>
        </div>

        <div v-else-if="step === 'final'">
          <h2 style="color: #0057ff">ИГРА ЗАВЕРШЕНА</h2>
          <p>Ваш результат: <strong>{{ score }}</strong></p>
          <button @click="restart" class="ninja-btn">ПЕРЕИГРАТЬ</button>
        </div>
      </div>
    </div>

    <div v-show="step === 'game'" class="hud">
      <div>ОЧКИ: {{ score }}</div>
      <div>ВРЕМЯ: {{ timer }}с</div>
      <div>ОШИБКИ: {{ health }}/3</div>
    </div>

    <div id="game-container"></div>
  </div>
</template>

<script>
import { launchGame } from './main.js'

export default {
  data() {
    return {
      step: 'reg',
      score: 0,
      timer: 120,
      health: 0,
      user: { name: '', phone: '' }
    }
  },
  methods: {
    start() {
      if (!this.user.name) return;
      this.step = 'game';
      launchGame({
        onScore: (s) => this.score = s,
        onTime: (t) => this.timer = t,
        onHealth: (h) => this.health = h,
        onGameOver: () => this.finish()
      });
    },
    async finish() {
      this.step = 'final';
      // Отправка данных на твой Go-сервер
      try {
        await fetch('http://localhost:8080/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: this.user.name,
            phone: this.user.phone,
            score: this.score
          })
        });
      } catch (e) { console.error("Ошибка сохранения"); }
    },
    restart() { location.reload(); }
  }
}
</script>

<style>
.screen { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 21, 41, 0.9); z-index: 100; }
.card { background: #fff; padding: 2rem; border-radius: 15px; text-align: center; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
.logo { width: 100px; margin-bottom: 20px; }
.ninja-input { display: block; margin: 10px auto; padding: 12px; width: 90%; border: 1px solid #ddd; border-radius: 8px; }
.ninja-btn { background: #0057ff; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 95%; margin-top: 10px; }
.hud { position: fixed; top: 0; width: 100%; display: flex; justify-content: space-around; padding: 25px; color: white; font-size: 24px; font-weight: 800; z-index: 50; pointer-events: none; }
</style>