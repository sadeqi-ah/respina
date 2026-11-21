//go:build integration

package store

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"
)

// Run with: HEALTH_TEST_DATABASE_URL=postgres://health_ro:…@localhost:5432/cloudpanel \
//
//	go test -tags integration ./internal/store/
//
// Uses the seeded database (service 125 exists) and the column-restricted health_ro role.
func TestPostgresAgainstSeededDatabase(t *testing.T) {
	url := os.Getenv("HEALTH_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("HEALTH_TEST_DATABASE_URL not set")
	}
	pg, err := NewPostgres(url, 2*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer pg.Close()
	ctx := context.Background()

	if err := pg.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}
	status, err := pg.Status(ctx, 125)
	if err != nil || (status != "active" && status != "suspended") {
		t.Fatalf("Status(125) = %q, %v", status, err)
	}
	if _, err := pg.Status(ctx, 999999999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing id: got %v, want ErrNotFound", err)
	}
}

func TestPostgresUnreachableFailsWithinTimeout(t *testing.T) {
	pg, err := NewPostgres("postgres://u:p@127.0.0.1:1/db", 500*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	defer pg.Close()
	start := time.Now()
	if err := pg.Ping(context.Background()); err == nil {
		t.Fatal("expected an error")
	}
	if time.Since(start) > 2*time.Second {
		t.Fatalf("ping took %s, timeout not applied", time.Since(start))
	}
}
