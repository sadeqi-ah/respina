package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(map[string]string{"HEALTH_DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != 8080 || cfg.DataSource != SourcePostgres || cfg.DBTimeout != 2*time.Second {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.Addr() != ":8080" {
		t.Fatalf("Addr() = %q", cfg.Addr())
	}
}

func TestLoadMemoryNeedsNoDatabaseURL(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"HEALTH_DATA_SOURCE": "memory", "HEALTH_PORT": "9000", "HEALTH_DB_TIMEOUT": "500ms",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != 9000 || cfg.DBTimeout != 500*time.Millisecond {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := map[string]struct {
		env  map[string]string
		want string
	}{
		"port not a number":    {map[string]string{"HEALTH_PORT": "http", "HEALTH_DATA_SOURCE": "memory"}, "HEALTH_PORT"},
		"port out of range":    {map[string]string{"HEALTH_PORT": "70000", "HEALTH_DATA_SOURCE": "memory"}, "HEALTH_PORT"},
		"unknown data source":  {map[string]string{"HEALTH_DATA_SOURCE": "redis"}, "HEALTH_DATA_SOURCE"},
		"postgres without url": {map[string]string{}, "HEALTH_DATABASE_URL"},
		"bad timeout":          {map[string]string{"HEALTH_DATA_SOURCE": "memory", "HEALTH_DB_TIMEOUT": "2"}, "HEALTH_DB_TIMEOUT"},
		"negative timeout":     {map[string]string{"HEALTH_DATA_SOURCE": "memory", "HEALTH_DB_TIMEOUT": "-1s"}, "HEALTH_DB_TIMEOUT"},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := Load(env(tc.env))
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want error mentioning %s, got %v", tc.want, err)
			}
		})
	}
}

func TestLoadReportsAllProblemsAtOnce(t *testing.T) {
	_, err := Load(env(map[string]string{"HEALTH_PORT": "x", "HEALTH_DB_TIMEOUT": "y"}))
	for _, want := range []string{"HEALTH_PORT", "HEALTH_DB_TIMEOUT", "HEALTH_DATABASE_URL"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("want %s in %v", want, err)
		}
	}
}
