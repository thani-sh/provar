package main

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
)

// scenarioServer implements ScenarioService. Stateless: Get parses the
// file on each call; Validate walks the whole project and reports every
// problem it finds in a single response.
type scenarioServer struct {
	provarv1.UnimplementedScenarioServiceServer
}

// Get parses a single .test.yml file and returns its actions.
func (s *scenarioServer) Get(_ context.Context, req *provarv1.GetRequest) (*provarv1.Scenario, error) {
	if req.GetProjectPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_path is required")
	}
	if req.GetFilePath() == "" {
		return nil, status.Error(codes.InvalidArgument, "file_path is required")
	}
	actions, err := domain.ParseFile(req.GetProjectPath(), req.GetFilePath())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	return &provarv1.Scenario{
		Path:    req.GetFilePath(),
		Actions: actionsToProto(actions),
	}, nil
}

// Validate parses every .test.yml in the project and reports all errors.
// Mirrors apps/provar-cli/commands/validate.go: empty IDs, missing names,
// and duplicate IDs across the whole project are hard errors. The result
// is always returned (never an RPC error) so callers can render the full
// problem list in one pass.
func (s *scenarioServer) Validate(_ context.Context, req *provarv1.ValidateRequest) (*provarv1.ValidationResult, error) {
	if req.GetProjectPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_path is required")
	}
	project, err := domain.LoadProject(req.GetProjectPath())
	if err != nil {
		return nil, mapLoadError(err)
	}
	result := &provarv1.ValidationResult{Valid: true}
	seenIDs := make(map[string]string)
	for _, f := range project.Files {
		actions, err := domain.ParseFile(project.Path, f.Path)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, &provarv1.ValidationError{
				Path:    f.Path,
				Message: fmt.Sprintf("parse: %v", err),
			})
			continue
		}
		for _, a := range actions {
			switch {
			case a.ID == "":
				result.Valid = false
				result.Errors = append(result.Errors, &provarv1.ValidationError{
					Path:    f.Path,
					Message: fmt.Sprintf("action with empty id (name=%q)", a.Name),
				})
			case a.Name == "":
				result.Valid = false
				result.Errors = append(result.Errors, &provarv1.ValidationError{
					Path:    f.Path,
					Message: fmt.Sprintf("%s: missing name", a.ID),
				})
			default:
				if other, dup := seenIDs[a.ID]; dup {
					result.Valid = false
					result.Errors = append(result.Errors, &provarv1.ValidationError{
						Path:    f.Path,
						Message: fmt.Sprintf("duplicate action id %q (also in %s)", a.ID, other),
					})
					continue
				}
				seenIDs[a.ID] = f.Path
			}
		}
	}
	return result, nil
}
