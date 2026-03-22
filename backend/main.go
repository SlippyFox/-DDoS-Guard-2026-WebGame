package main

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"sync"
)

// Структура анкеты игрока [cite: 34]
type PlayerResult struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
	Score     int    `json:"score"`
}

var (
	leaderboard []PlayerResult
	mutex       sync.Mutex // Защита данных от одновременной записи
)

func main() {
	r := gin.Default()

	// Разрешаем фронтенду подключаться к бэкенду (CORS)
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		c.Next()
	})

	// Эндпоинт для сохранения результата [cite: 39]
	r.POST("/api/save", func(c *gin.Context) {
		var res PlayerResult
		if err := c.ShouldBindJSON(&res); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ошибка данных"})
			return
		}
		mutex.Lock()
		leaderboard = append(leaderboard, res)
		mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"status": "success"})
	})

	// Эндпоинт для админа (турнирная таблица) 
	r.GET("/api/admin", func(c *gin.Context) {
		c.JSON(http.StatusOK, leaderboard)
	})

	r.Run(":8080") // Запуск на порту 8080
}