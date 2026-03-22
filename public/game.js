const { createApp } = Vue;

createApp({
  data() {
    return {
      step: "reg",
      resultStatus: null,
      score: 0,
      combo: 0,
      speedMultiplier: 1.0,
      errors: 0,
      timeLeft: 120,
      users: [],
      currentUser: null,
      isAdmin: false,
      form: { name: "", phone: "" },
      gameInstance: null,
    };
  },
  methods: {
    openTgBot() {
      const botName = "ANTIBD_bot";
      const appUrl = `tg://resolve?domain=${botName}&start=reg`;
      const webUrl = `https://t.me/${botName}?start=reg`;
      window.location.href = appUrl;
      setTimeout(() => {
        if (document.hasFocus()) window.open(webUrl, "_blank");
      }, 500);
    },

    async login() {
      const name = this.form.name.trim();
      const rawPhone = this.form.phone.trim();
      if (!name || !rawPhone) return alert("Введите имя и номер телефона!");

      if (
        name.toLowerCase() === "admin" &&
        rawPhone.toLowerCase() === "admin"
      ) {
        return this.proceedLogin(name, "admin");
      }

      let phone = rawPhone.replace(/\D/g, "");
      if (phone.length !== 11) return alert("Номер должен содержать 11 цифр!");
      if (!["7", "8"].includes(phone[0]))
        return alert("Номер должен начинаться с 7 или 8!");
      if (phone.startsWith("8")) phone = "7" + phone.substring(1);

      this.proceedLogin(name, phone);
    },

    async proceedLogin(name, phone) {
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone }),
        });
        if (!response.ok) throw new Error();
        const data = await response.json();

        if (data.role === "admin") {
          this.isAdmin = true;
          this.step = "admin";
          this.loadAdminStats();
        } else if (data.success) {
          this.currentUser = data.user;
          this.step = "game";
          this.resetStats();
          setTimeout(() => this.initPhaser(), 100);
        } else {
          alert(data.message || "Попытка использована.");
          if (data.user) this.score = data.user.score;
          this.loadLeaderboard();
        }
      } catch (e) {
        alert("Ошибка сервера.");
      }
    },

    async loadLeaderboard() {
      const res = await fetch("/api/leaderboard");
      this.users = await res.json();
      this.step = "leaderboard";
    },

    async loadAdminStats() {
      const res = await fetch("/api/admin-stats");
      this.users = await res.json();
    },

    async resetFullDB() {
      if (!confirm("Очистить БД?")) return;
      await fetch("/api/admin-reset-db", { method: "POST" });
      this.users = [];
    },

    logout() {
      this.step = "reg";
      this.isAdmin = false;
      this.currentUser = null;
      this.form.name = "";
      this.form.phone = "";
      if (this.gameInstance) this.gameInstance.destroy(true);
    },

    resetStats() {
      this.score = 0;
      this.combo = 0;
      this.errors = 0;
      this.timeLeft = 120;
      this.speedMultiplier = 1.0;
    },

    async handleGameOver(isWin) {
      this.resultStatus = isWin ? "win" : "loss";
      setTimeout(async () => {
        await fetch("/api/submit-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: this.currentUser.phone,
            score: this.score,
          }),
        });
        this.resultStatus = null;
        this.loadLeaderboard();
      }, 3500);
    },

    initPhaser() {
      const self = this;
      const config = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#11151d",
        physics: { default: "arcade" },
        scene: {
          preload() {
            this.load.image("virus", "virus.png");
            this.load.image("m1", "mascot1.png");
            this.load.image("m2", "mascot2.png");
            this.load.image("m3", "mascot3.png");
            this.load.image("m5", "mascot5.png");
            this.load.image("m6", "mascot6.png");
            this.load.audio("sfx_slice", "slice.mp3");
            this.load.audio("sfx_error", "error.mp3");
            this.load.audio("sfx_tick", "tick.mp3");
          },
          create() {
            this.line = this.add.graphics();
            this.points = [];
            this.activeTargets = [];
            this.bgElements = this.add.group();

            this.soundSlice = this.sound.add("sfx_slice", { volume: 0.4 });
            this.soundError = this.sound.add("sfx_error", { volume: 0.5 });
            this.soundTick = this.sound.add("sfx_tick", { volume: 0.3 });

            // --- ФОНОВЫЕ БИНАРНЫЕ ДАННЫЕ ---
            this.spawnBinary = () => {
              const x = Phaser.Math.Between(0, window.innerWidth);
              const val = Math.random() > 0.5 ? "1" : "0";
              const txt = this.add.text(x, -50, val, {
                font: "20px monospace",
                fill: "#0077ff",
              });
              txt.setAlpha(Phaser.Math.FloatBetween(0.1, 0.3));
              txt.setDepth(-1); // Уводим на задний план

              this.physics.add.existing(txt);
              txt.body.setVelocityY(Phaser.Math.Between(30, 80));
              this.bgElements.add(txt);
            };

            // Создаем начальную пачку данных
            for (let i = 0; i < 30; i++) {
              this.spawnBinary();
              this.bgElements.getChildren()[i].y = Phaser.Math.Between(
                0,
                window.innerHeight,
              );
            }

            // Постоянный спавн новых цифр
            this.time.addEvent({
              delay: 400,
              callback: this.spawnBinary,
              loop: true,
            });

            // --- ТАЙМЕР И ИГРОВАЯ ЛОГИКА ---
            this.time.addEvent({
              delay: 1000,
              callback: () => {
                self.timeLeft--;
                if (self.timeLeft <= 10 && self.timeLeft > 0) {
                  this.cameras.main.shake(150, 0.002);
                  this.soundTick.play();
                }
                if (self.timeLeft <= 0) {
                  this.scene.pause();
                  self.handleGameOver(true);
                }
              },
              loop: true,
            });

            this.spawnLoop = () => {
              if (self.step !== "game") return;
              this.time.delayedCall(850 / self.speedMultiplier, () => {
                this.createTarget();
                this.spawnLoop();
              });
            };

            this.createTarget = () => {
              const isMascot = Math.random() > 0.7;
              const key = isMascot
                ? ["m1", "m2", "m3", "m5", "m6"][Math.floor(Math.random() * 5)]
                : "virus";
              const x = Phaser.Math.Between(100, window.innerWidth - 100);
              const obj = this.physics.add
                .sprite(x, window.innerHeight + 50, key)
                .setScale(0.25);
              obj.setVelocity(
                Phaser.Math.Between(-60, 60),
                -Phaser.Math.Between(700, 900) * self.speedMultiplier,
              );
              obj.setGravityY(500 * self.speedMultiplier);
              obj.isMascot = isMascot;
              this.activeTargets.push(obj);
            };

            this.spawnLoop();

            this.slice = (obj, idx) => {
              if (obj.isSliced) return;
              obj.isSliced = true;
              this.activeTargets.splice(idx, 1);

              if (obj.isMascot) {
                this.soundError.play();
                obj.setTint(0xff0000);
                this.tweens.add({
                  targets: obj,
                  alpha: 0,
                  scale: 0,
                  duration: 200,
                  onComplete: () => obj.destroy(),
                });
                self.errors++;
                self.combo = 0;
                this.cameras.main.shake(300, 0.02);
                if (self.errors >= 3) {
                  this.scene.pause();
                  self.handleGameOver(false);
                }
              } else {
                this.soundSlice.play();
                const emitter = this.add.particles(obj.x, obj.y, "virus", {
                  speed: { min: 100, max: 400 },
                  scale: { start: 0.05, end: 0 },
                  lifespan: 600,
                  gravityY: 400,
                  emitting: false,
                });
                emitter.explode(20);
                this.time.delayedCall(1000, () => emitter.destroy());
                obj.destroy();
                self.score += 10;
                self.combo++;
                if (self.combo >= 10) {
                  self.score += 50;
                  self.combo = 0;
                  self.speedMultiplier += 0.1;
                  this.cameras.main.flash(200, 0, 100, 255, 0.3);
                }
              }
            };
          },
          update() {
            // Чистка фоновых данных, ушедших за экран
            this.bgElements.getChildren().forEach((el) => {
              if (el.y > window.innerHeight + 50) el.destroy();
            });

            const p = this.input.activePointer;
            for (let i = this.activeTargets.length - 1; i >= 0; i--) {
              const t = this.activeTargets[i];
              if (t.y > window.innerHeight + 100) {
                if (!t.isMascot && !t.isSliced) self.combo = 0;
                this.activeTargets.splice(i, i === 0 ? 1 : i);
                t.destroy();
              }
            }
            if (p.isDown) {
              this.points.push({ x: p.x, y: p.y });
              if (this.points.length > 10) this.points.shift();
              this.line.clear().lineStyle(8, 0x00d4ff, 1).beginPath();
              this.points.forEach((pt, idx) =>
                idx === 0
                  ? this.line.moveTo(pt.x, pt.y)
                  : this.line.lineTo(pt.x, pt.y),
              );
              this.line.strokePath();
              if (this.points.length > 1) {
                const line = new Phaser.Geom.Line(
                  this.points[0].x,
                  this.points[0].y,
                  p.x,
                  p.y,
                );
                for (let i = this.activeTargets.length - 1; i >= 0; i--) {
                  if (
                    Phaser.Geom.Intersects.LineToRectangle(
                      line,
                      this.activeTargets[i].getBounds(),
                    )
                  ) {
                    this.slice(this.activeTargets[i], i);
                  }
                }
              }
            } else {
              this.points = [];
              this.line.clear();
            }
          },
        },
      };
      this.gameInstance = new Phaser.Game(config);
    },
  },
}).mount("#app");
