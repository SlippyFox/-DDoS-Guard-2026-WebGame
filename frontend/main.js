import { createApp } from "vue";
import App from "./App.vue";
import Phaser from "phaser";

export function launchGame(cb) {
  const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    width: window.innerWidth,
    height: window.innerHeight,
    transparent: true,
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 500 } },
    },
    scene: {
      preload() {
        // Загружаем маскотов и вирус из корня/assets
        for (let i = 1; i <= 6; i++) {
          this.load.image(`mascot${i}`, `./assets/mascot${i}.png`);
        }
        this.load.image("virus", `./assets/virus.png`);
      },
      create() {
        this.score = 0;
        this.timer = 120;
        this.health = 0;

        // Таймер появления объектов
        this.time.addEvent({
          delay: 900,
          callback: this.spawnObject,
          callbackScope: this,
          loop: true,
        });

        // Обратный отсчет
        this.time.addEvent({
          delay: 1000,
          callback: () => {
            this.timer--;
            cb.onTime(this.timer);
            if (this.timer <= 0) cb.onGameOver();
          },
          loop: true,
        });
      },
      spawnObject() {
        const x = Phaser.Math.Between(100, window.innerWidth - 100);
        const isVirus = Math.random() < 0.3;
        const key = isVirus ? "virus" : `mascot${Phaser.Math.Between(1, 6)}`;

        const obj = this.physics.add.sprite(x, window.innerHeight + 50, key);
        obj.setDisplaySize(150, 150);
        obj.setInteractive();

        // Эффект броска вверх под углом
        obj.setVelocityY(Phaser.Math.Between(-700, -500));
        obj.setVelocityX(Phaser.Math.Between(-150, 150));

        obj.on("pointerdown", () => {
          if (key === "virus") {
            this.score += 20;
            cb.onScore(this.score);
          } else {
            this.health++;
            cb.onHealth(this.health);
            if (this.health >= 3) cb.onGameOver();
          }
          obj.destroy();
        });
      },
    },
  };
  return new Phaser.Game(config);
}

createApp(App).mount("#app");
