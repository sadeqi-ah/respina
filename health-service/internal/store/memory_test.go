package store

import (
	"context"
	"errors"
	"testing"
)

func TestMemoryStatus(t *testing.T) {
	m := NewMemory()
	for id, want := range map[int64]string{125: "active", 126: "suspended"} {
		got, err := m.Status(context.Background(), id)
		if err != nil || got != want {
			t.Fatalf("Status(%d) = %q, %v; want %q", id, got, err, want)
		}
	}
	if _, err := m.Status(context.Background(), 999999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing id: got %v, want ErrNotFound", err)
	}
	if err := m.Ping(context.Background()); err != nil {
		t.Fatalf("Ping: %v", err)
	}
}
