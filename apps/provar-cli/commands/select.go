package commands

import (
	"fmt"
	"strings"

	"github.com/thani-sh/provar/libs/domain"
)

// selectFiles filters project.Files by a glob-ish pattern on the file's path
// relative to the project root. Returns all files when pattern is empty. The
// match is a suffix check (e.g. "login" matches "tests/login.test.yml") so
// users can pass either a basename or a relative path without thinking about
// the tests/ directory.
//
// Returns an error listing the matched (and unmatched) files so the user can
// see what they typed vs what was available — the typical "did I get the
// name right?" debugging loop.
func selectFiles(project *domain.Project, pattern string) ([]domain.File, error) {
	if pattern == "" {
		return project.Files, nil
	}
	var matched []domain.File
	for _, f := range project.Files {
		if strings.Contains(f.Path, pattern) {
			matched = append(matched, f)
		}
	}
	if len(matched) == 0 {
		names := make([]string, 0, len(project.Files))
		for _, f := range project.Files {
			names = append(names, f.Path)
		}
		return nil, fmt.Errorf("--test %q matched no files; available: %s", pattern, strings.Join(names, ", "))
	}
	return matched, nil
}

// truncateFrom is the inverse of truncateUpTo: returns the action list
// starting from the first action whose ID equals `from`, inclusive. Lets the
// user re-run from a failing action without re-running the whole file.
func truncateFrom(actions []domain.Action, from string) ([]domain.Action, bool) {
	for i, a := range actions {
		if a.ID == from {
			return actions[i:], true
		}
	}
	return nil, false
}
