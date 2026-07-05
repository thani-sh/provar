package main

import (
	"context"
	"errors"
	"io/fs"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
)

// projectServer implements ProjectService. Stateless: every RPC loads the
// project from disk afresh. A future "Open + reuse" caching layer would
// slot in here without changing the wire contract.
type projectServer struct {
	provarv1.UnimplementedProjectServiceServer
}

// Open loads a project from disk and returns its full state. Returns
// NotFound when the project directory does not contain a .provar/config.yml.
func (s *projectServer) Open(_ context.Context, req *provarv1.OpenRequest) (*provarv1.Project, error) {
	if req.GetPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "path is required")
	}
	project, err := domain.LoadProject(req.GetPath())
	if err != nil {
		return nil, mapLoadError(err)
	}
	return projectToProto(project), nil
}

// Init scaffolds a new project at target, optionally with the bundled sample
// data. Returns AlreadyExists when target exists and force is false.
func (s *projectServer) Init(_ context.Context, req *provarv1.InitRequest) (*provarv1.Project, error) {
	if req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "target is required")
	}
	err := domain.InitProject(req.GetTarget(), req.GetUseSample(), req.GetForce())
	if err != nil {
		if errors.Is(err, fs.ErrExist) || (req.GetForce() == false && isAlreadyExists(err)) {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	project, err := domain.LoadProject(req.GetTarget())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "init succeeded but reload failed: %v", err)
	}
	return projectToProto(project), nil
}

// List returns just the file paths under a project's tests directory — a
// lightweight alternative to Open when the caller only needs to enumerate
// scenarios.
func (s *projectServer) List(_ context.Context, req *provarv1.ListRequest) (*provarv1.ListResponse, error) {
	if req.GetPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "path is required")
	}
	project, err := domain.LoadProject(req.GetPath())
	if err != nil {
		return nil, mapLoadError(err)
	}
	return &provarv1.ListResponse{
		Path:  project.Path,
		Files: filesToProto(project.Files),
	}, nil
}

// mapLoadError translates domain.LoadProject errors into gRPC status codes.
// The error message is preserved so callers retain the same diagnostic text
// the CLI surface produces.
func mapLoadError(err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return status.Error(codes.NotFound, err.Error())
	}
	return status.Error(codes.InvalidArgument, err.Error())
}

// isAlreadyExists reports whether err matches the target-exists branch of
// domain.InitProject. The domain package signals this with a formatted
// error message; we detect it by checking the canonical prefix.
func isAlreadyExists(err error) bool {
	return err != nil && strings.HasPrefix(err.Error(), "target already exists")
}
