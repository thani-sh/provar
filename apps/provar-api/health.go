package main

import (
	"context"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

// healthServer implements HealthService. Always reports SERVING — the
// server's existence is the proof of health at v1. Future work can add
// deeper checks (browser available, settings valid, etc.).
type healthServer struct {
	provarv1.UnimplementedHealthServiceServer
}

// Check returns the current serving status.
func (h *healthServer) Check(_ context.Context, _ *provarv1.HealthCheckRequest) (*provarv1.HealthCheckResponse, error) {
	return &provarv1.HealthCheckResponse{
		Status: provarv1.HealthServingStatus_HEALTH_SERVING_STATUS_SERVING,
	}, nil
}
