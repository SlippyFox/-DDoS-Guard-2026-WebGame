const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { Telegraf } = require("telegraf");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const bot = new Telegraf("8754916703:AAETRCS6RrPgrqT1ne1Jni-Q4vEfS3no-9g"); // Вставь токен от BotFather

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Раздаем фронтенд из папки public

let db;

// Инициализация БД
(async () => {
  db = await open({ filename: "./database.sqlite", driver: sqlite3.Database });
  await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            tg_id TEXT,
            score INTEGER DEFAULT 0,
            played INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user'
        )
    `);
  console.log("Database Ready.");
})();

// --- ЛОГИКА ТЕЛЕГРАМ БОТА ---
// Команда /start теперь будет предлагать регистрацию красиво
bot.start((ctx) => {
  ctx.reply(
    "Привет! Ты пришел из игры DDoS Ninja. Нажми на кнопку ниже, чтобы подтвердить свой номер и участвовать в турнире!",
    {
      reply_markup: {
        keyboard: [
          [{ text: "📲 Подтвердить регистрацию", request_contact: true }],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    },
  );
});

// Когда пользователь нажал кнопку и отправил контакт
bot.on("contact", async (ctx) => {
  const contact = ctx.message.contact;
  const name = `${contact.first_name} ${contact.last_name || ""}`.trim();
  const phone = contact.phone_number.replace("+", ""); // Убираем плюс для базы

  try {
    // Проверяем, есть ли уже такой человек
    await db.run(
      "INSERT OR IGNORE INTO users (name, phone, tg_id) VALUES (?, ?, ?)",
      [name, phone, ctx.from.id],
    );
    ctx.reply(
      `✅ Готово, ${name}! Ты зарегистрирован.\n\nТеперь вернись в браузер и просто нажми "Вход в систему", используя свой номер: ${phone}`,
    );
  } catch (e) {
    ctx.reply("❌ Ой, что-то пошло не так. Попробуй еще раз через минуту.");
  }
});

bot.on("contact", async (ctx) => {
  const contact = ctx.message.contact;
  const name = `${contact.first_name} ${contact.last_name || ""}`.trim();
  const phone = contact.phone_number.replace("+", "");

  try {
    await db.run(
      "INSERT OR IGNORE INTO users (name, phone, tg_id) VALUES (?, ?, ?)",
      [name, phone, ctx.from.id],
    );
    ctx.reply(
      `Отлично, ${name}! Ты в базе. Теперь переходи на сайт и вводи свой номер телефона для игры.`,
    );
  } catch (e) {
    ctx.reply("Ошибка регистрации.");
  }
});
bot.launch();

// --- API ДЛЯ САЙТА ---

// Вход/Регистрация
app.post("/api/login", async (req, res) => {
  const { name, phone } = req.body;

  // Админский вход (хардкод для безопасности)
  if (name === "admin" && phone === "admin") {
    return res.json({ role: "admin" });
  }

  let user = await db.get("SELECT * FROM users WHERE phone = ?", [phone]);

  if (!user) {
    // Если зашел не через бота, а сразу на сайт
    await db.run("INSERT INTO users (name, phone) VALUES (?, ?)", [
      name,
      phone,
    ]);
    user = await db.get("SELECT * FROM users WHERE phone = ?", [phone]);
  }

  if (user.played) {
    return res.json({
      success: false,
      message: "Попытка уже использована!",
      user,
    });
  }

  res.json({ success: true, user });
});

// Сохранение счета (1 игра = 1 попытка)
app.post("/api/submit-score", async (req, res) => {
  const { phone, score } = req.body;
  const user = await db.get("SELECT * FROM users WHERE phone = ?", [phone]);

  if (user && !user.played) {
    await db.run("UPDATE users SET score = ?, played = 1 WHERE phone = ?", [
      score,
      phone,
    ]);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Попытка уже была использована" });
  }
});

// Топ-5 игроков
app.get("/api/leaderboard", async (req, res) => {
  const top = await db.all(
    "SELECT name, score FROM users WHERE played = 1 ORDER BY score DESC LIMIT 5",
  );
  res.json(top);
});

// Данные для админа
// Вставь это в server.js перед app.listen
app.get("/api/admin-stats", async (req, res) => {
  try {
    const users = await db.all("SELECT * FROM users ORDER BY score DESC");
    console.log("Админ запросил данные, отправлено строк:", users.length); // Это появится в терминале
    res.json(users);
  } catch (e) {
    console.error("Ошибка БД:", e);
    res.status(500).json({ error: e.message });
  }
});

// ОПАСНАЯ ЗОНА: Удаление всех игроков (только для админа)
// Маршрут для полной очистки базы данных
app.post("/api/admin-reset-db", async (req, res) => {
  try {
    // 1. Удаляем всех пользователей
    await db.run("DELETE FROM users");
    // 2. Сбрасываем счетчик ID (чтобы следующий юзер снова был №1)
    await db.run("DELETE FROM sqlite_sequence WHERE name='users'");

    console.log("⚠️ База данных была полностью очищена через панель админа");
    res.json({ success: true });
  } catch (e) {
    console.error("Ошибка при очистке БД:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
