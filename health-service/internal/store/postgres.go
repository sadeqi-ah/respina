package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres reads statuses from the shared database as the column-restricted health_ro role,
// which may only SELECT (id, status) on services.
type Postgres struct {
	pool    *pgxpool.Pool
	timeout time.Duration
}

// NewPostgres creates a small connection pool. It does not connect yet: the service starts
// even while the database is down and reports that through /health (503).
func NewPostgres(url string, timeout time.Duration) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse HEALTH_DATABASE_URL: %w", err)
	}
	cfg.MaxConns = 5
	cfg.ConnConfig.ConnectTimeout = timeout
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	return &Postgres{pool: pool, timeout: timeout}, nil
}

// Status implements ServiceStore with a parameterized query (no string building).
func (p *Postgres) Status(ctx context.Context, id int64) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	var status string
	err := p.pool.QueryRow(ctx, "SELECT status FROM services WHERE id = $1", id).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("query service %d: %w", id, err)
	}
	return status, nil
}

// Ping implements ServiceStore.
func (p *Postgres) Ping(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	return p.pool.Ping(ctx)
}

// Close releases the pool's connections.
func (p *Postgres) Close() { p.pool.Close() }
