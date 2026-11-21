// Package config reads and validates the service configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"strconv"
	"time"
)

// Data sources the service can read service statuses from.
const (
	SourcePostgres = "postgres"
	SourceMemory   = "memory"
)

// Config is the validated runtime configuration.
type Config struct {
	Port        int
	DataSource  string
	DatabaseURL string
	DBTimeout   time.Duration
}

// Load builds a Config from getenv (os.Getenv in production) and validates it.
// All problems are reported together so a misconfigured container fails with one clear message.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		Port:        8080,
		DataSource:  SourcePostgres,
		DatabaseURL: getenv("HEALTH_DATABASE_URL"),
		DBTimeout:   2 * time.Second,
	}
	var errs []error

	if v := getenv("HEALTH_PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil || port < 1 || port > 65535 {
			errs = append(errs, fmt.Errorf("HEALTH_PORT must be a port number (1-65535), got %q", v))
		} else {
			cfg.Port = port
		}
	}

	if v := getenv("HEALTH_DATA_SOURCE"); v != "" {
		cfg.DataSource = v
	}
	switch cfg.DataSource {
	case SourceMemory:
	case SourcePostgres:
		if cfg.DatabaseURL == "" {
			errs = append(errs, errors.New("HEALTH_DATABASE_URL is required when HEALTH_DATA_SOURCE=postgres"))
		}
	default:
		errs = append(errs, fmt.Errorf("HEALTH_DATA_SOURCE must be %q or %q, got %q",
			SourcePostgres, SourceMemory, cfg.DataSource))
	}

	if v := getenv("HEALTH_DB_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			errs = append(errs, fmt.Errorf("HEALTH_DB_TIMEOUT must be a positive duration like 2s, got %q", v))
		} else {
			cfg.DBTimeout = d
		}
	}

	if len(errs) > 0 {
		return Config{}, errors.Join(errs...)
	}
	return cfg, nil
}

// Addr is the listen address for net/http.
func (c Config) Addr() string { return fmt.Sprintf(":%d", c.Port) }
