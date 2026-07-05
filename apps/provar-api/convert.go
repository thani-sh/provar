package main

import (
	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
)

// projectToProto maps a libs/domain.Project to its wire representation.
// Browser is always a non-nil pointer so clients can read the configured
// viewport without a nil-check. domain.Project always populates Browser
// via withDefaults, so this never reaches the zero-value path in practice.
func projectToProto(p *domain.Project) *provarv1.Project {
	if p == nil {
		return nil
	}
	w, h := p.Browser.Resolved()
	return &provarv1.Project{
		Path:  p.Path,
		Vars:  p.Vars,
		Files: filesToProto(p.Files),
		Browser: &provarv1.BrowserConfig{
			Width:  int32(w),
			Height: int32(h),
		},
	}
}

// filesToProto maps a slice of domain.File to its wire representation.
// Allocating a single slice keeps the marshaller from walking the input
// twice.
func filesToProto(files []domain.File) []*provarv1.File {
	out := make([]*provarv1.File, len(files))
	for i, f := range files {
		out[i] = &provarv1.File{Path: f.Path}
	}
	return out
}

// actionsToProto maps a slice of domain.Action to its wire representation.
func actionsToProto(actions []domain.Action) []*provarv1.Action {
	out := make([]*provarv1.Action, len(actions))
	for i, a := range actions {
		out[i] = &provarv1.Action{
			Id:   a.ID,
			Name: a.Name,
			Info: a.Info,
			Next: a.Next,
		}
	}
	return out
}
