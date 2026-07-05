package main

import (
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/models"
)

// newServer builds a *grpc.Server with the provar services registered.
// Phase 5: HealthService, ProjectService, ScenarioService, CompileService,
// RunService, UtilityService.
//
// CompileService holds a clientFactory that builds a fresh models.Client
// per call. The default factory loads ~/.provar/settings.yml; tests pass
// their own.
//
// Reflection is enabled so grpc-cli, grpcurl, and other debugging tools can
// introspect the surface without the caller shipping a .proto.
func newServer() *grpc.Server {
	srv := grpc.NewServer()
	provarv1.RegisterHealthServiceServer(srv, &healthServer{})
	provarv1.RegisterProjectServiceServer(srv, &projectServer{})
	provarv1.RegisterScenarioServiceServer(srv, &scenarioServer{})
	provarv1.RegisterCompileServiceServer(srv, &compileServer{newClient: defaultClientFactory()})
	provarv1.RegisterRunServiceServer(srv, &runServer{})
	provarv1.RegisterUtilityServiceServer(srv, &utilityServer{})
	reflection.Register(srv)
	return srv
}

// defaultClientFactory returns a clientFactory that loads the active model
// provider from ~/.provar/settings.yml each call. Settings can change
// between RPCs (the user edits the file and re-runs), so we don't cache.
func defaultClientFactory() clientFactory {
	return func() (models.Client, error) {
		settings, err := domain.LoadSettings()
		if err != nil {
			return nil, err
		}
		if err := settings.Validate(); err != nil {
			return nil, err
		}
		active, ok := settings.Providers[string(settings.Provider)]
		if !ok {
			return nil, fmt.Errorf("active provider %q has no configuration entry", settings.Provider)
		}
		return models.NewClient(
			mapDomainProvider(settings.Provider),
			active.APIKey,
			active.BaseURL,
			active.Model,
		)
	}
}

// mapDomainProvider bridges the domain provider identifier to the SDK
// provider type. The two packages use distinct types but share the same
// string values today.
func mapDomainProvider(p domain.Provider) models.Provider {
	switch p {
	case domain.ProviderGoogle:
		return models.Google
	case domain.ProviderOpenAI:
		return models.OpenAI
	case domain.ProviderAnthropic:
		return models.Anthropic
	}
	return ""
}
