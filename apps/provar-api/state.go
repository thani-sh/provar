package api

import (
	"context"
	"sync"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
)

// Server holds the per-process state that handlers read and mutate: a cache
// of loaded projects (keyed by absolute path) and the job registry used to
// route job/* control events. Projects are loaded lazily on first use via
// GetOrLoadProject and never explicitly evicted — a localhost dev tool's
// process lifetime is short enough that the cache stays bounded by the
// number of projects a user touches in one session.
//
// All mutation goes through mu. The critical sections are short except for
// GetOrLoadProject, which holds mu across a (small) disk read; that's
// acceptable for the load we're under.
type Server struct {
	mu       sync.Mutex
	projects map[string]*domain.Project
	jobs     map[string]*domain.Job

	compiler *engine.Compiler
	runner   *engine.Runner
}

// NewServer builds a Server ready to accept connections. The compiler needs
// a models.Client at startup because Compile is the only engine entry point
// that talks to an LLM; runner doesn't.
func NewServer() (*Server, error) {
	settings, err := domain.LoadSettings()
	if err != nil {
		return nil, err
	}
	if err := settings.Validate(); err != nil {
		return nil, err
	}
	active, ok := settings.Providers[string(settings.Provider)]
	if !ok {
		return nil, nil // unreachable: settings.Validate() covers this
	}
	client, err := domain.ModelsClient(settings.Provider, active)
	if err != nil {
		return nil, err
	}
	return &Server{
		projects: make(map[string]*domain.Project),
		jobs:     make(map[string]*domain.Job),
		compiler: engine.NewCompiler(client),
		runner:   engine.NewRunner(),
	}, nil
}

// GetOrLoadProject returns the project at path. Cache hit: returns the stored
// instance. Cache miss: loads from disk via domain.LoadProject, inserts, and
// returns. Multiple projects can be cached simultaneously — there's no
// concept of "the active project"; every compile/run specifies its own path.
//
// Caveat: if .provar/config.yml changes on disk after a project is cached,
// the cached copy is used until the process restarts. The ADR's planned
// v1/fs/changed server-pushed event (when wired) will evict stale entries.
func (s *Server) GetOrLoadProject(path string) (*domain.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p, ok := s.projects[path]; ok {
		return p, nil
	}
	p, err := domain.LoadProject(path)
	if err != nil {
		return nil, err
	}
	s.projects[path] = p
	return p, nil
}

// RegisterJob stores a Job under its own id and returns the id. Caller passes
// the Job already created by the engine (domain.NewJob generates the id).
func (s *Server) RegisterJob(j *domain.Job) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
	return j.ID
}

// LookupJob finds a Job by id. Returns (job, true) or (nil, false).
func (s *Server) LookupJob(id string) (*domain.Job, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	return j, ok
}

// ForgetJob removes a Job from the registry. Called when the Job has emitted
// its terminal event and been Close()'d.
func (s *Server) ForgetJob(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.jobs, id)
}

// Compile returns the configured Compiler.
func (s *Server) Compile() *engine.Compiler { return s.compiler }

// Run returns the configured Runner.
func (s *Server) Run() *engine.Runner { return s.runner }

// ctxKey is the unexported type for context keys in this package. Used to
// stash per-connection state (e.g. active jobs) on the connection's context.
type ctxKey int

const (
	ctxKeyConnectionID ctxKey = iota
)

// WithConnectionID tags ctx with the connection id. Available to handlers
// via ConnectionIDFromContext.
func WithConnectionID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKeyConnectionID, id)
}

// ConnectionIDFromContext returns the connection id previously tagged on ctx,
// or "" if the context wasn't tagged by WithConnectionID.
func ConnectionIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyConnectionID).(string)
	return id
}
