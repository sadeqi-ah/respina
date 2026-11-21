package store

import "context"

// Memory is an in-process store with fixed sample data, for local runs and tests.
type Memory struct {
	statuses map[int64]string
}

// NewMemory returns a store seeded with sample services, including id 125 from the API docs.
func NewMemory() *Memory {
	return &Memory{statuses: map[int64]string{
		1:   "active",
		2:   "suspended",
		125: "active",
		126: "suspended",
	}}
}

// Status implements ServiceStore.
func (m *Memory) Status(_ context.Context, id int64) (string, error) {
	status, ok := m.statuses[id]
	if !ok {
		return "", ErrNotFound
	}
	return status, nil
}

// Ping implements ServiceStore; memory is always reachable.
func (m *Memory) Ping(context.Context) error { return nil }
