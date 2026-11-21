// Command healthsvc serves GET /health: the service's own health and, with ?service_id=N,
// the status of a cloud service read from the shared database (read-only role).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"respina/health-service/internal/config"
	"respina/health-service/internal/httpapi"
	"respina/health-service/internal/store"
)

const shutdownTimeout = 10 * time.Second

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "healthsvc:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return fmt.Errorf("invalid configuration:\n%w", err)
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	st, closeStore, err := openStore(cfg)
	if err != nil {
		return err
	}
	defer closeStore()

	srv := httpapi.NewServer(cfg.Addr(), st, log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", srv.Addr, "data_source", cfg.DataSource)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("server: %w", err)
		}
	case <-ctx.Done():
		log.Info("shutting down", "timeout", shutdownTimeout.String())
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}
	}
	log.Info("stopped")
	return nil
}

func openStore(cfg config.Config) (store.ServiceStore, func(), error) {
	if cfg.DataSource == config.SourceMemory {
		return store.NewMemory(), func() {}, nil
	}
	pg, err := store.NewPostgres(cfg.DatabaseURL, cfg.DBTimeout)
	if err != nil {
		return nil, nil, err
	}
	return pg, pg.Close, nil
}
