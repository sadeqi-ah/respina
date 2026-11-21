// Package store reads cloud service statuses. The service has read-only access by design.
package store

import (
	"context"
	"errors"
)

// ErrNotFound means no service has the requested id.
var ErrNotFound = errors.New("service not found")

// ServiceStore is everything the HTTP layer needs from a data source.
type ServiceStore interface {
	// Status returns the status ("active", "suspended", …) of service id, or ErrNotFound.
	Status(ctx context.Context, id int64) (string, error)
	// Ping reports whether the data source is reachable.
	Ping(ctx context.Context) error
}
