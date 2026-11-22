// Package httpapi is the HTTP layer: routes, the /health handler, middleware and responses.
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"respina/health-service/internal/store"
)

// NewServer returns an http.Server with every timeout set, so slow clients can't hold
// connections open forever (Slowloris).
func NewServer(addr string, st store.ServiceStore, log *slog.Logger) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           chain(Routes(st), log),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
		ErrorLog:          slog.NewLogLogger(log.Handler(), slog.LevelWarn),
	}
}
