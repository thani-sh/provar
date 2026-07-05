package main

import (
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

// newServer builds a *grpc.Server with the provar services registered.
// Phase 1: HealthService only. Subsequent phases add ProjectService,
// ScenarioService, CompileService, RunService, UtilityService.
//
// Reflection is enabled so grpc-cli, grpcurl, and other debugging tools can
// introspect the surface without the caller shipping a .proto.
func newServer() *grpc.Server {
	srv := grpc.NewServer()
	provarv1.RegisterHealthServiceServer(srv, &healthServer{})
	reflection.Register(srv)
	return srv
}
