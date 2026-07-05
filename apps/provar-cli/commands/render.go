package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/thani-sh/provar/libs/domain"
)

// runRenderer consumes the engine's event stream and writes it to the user's
// preferred sink. Implementations differ on how events are surfaced (text
// stream vs newline-delimited JSON vs JUnit XML at the end) but share the
// same callback shape so runHandler doesn't care which is in use.
type runRenderer interface {
	OnEvent(ev domain.Event, projectRoot, fileStem string)
	OnFinish(projectRoot string, files []string) error // called once, after all files done
}

// textRenderer is the default. Streams friendly progress lines to out and
// warnings/errors to err. Visual-comparison events are routed through the
// shared helper which decodes + saves + diffs the screenshot.
type textRenderer struct {
	out, err io.Writer
	mu       sync.Mutex
}

func newTextRenderer(out, err io.Writer) *textRenderer {
	return &textRenderer{out: out, err: err}
}

// info / warn / success make textRenderer satisfy the textSink interface
// used by handleVisualEvent. They don't go through the normal event switch
// — visual events are decorated inline so the success/warn/info lines stay
// grouped with the task they belong to.
func (r *textRenderer) info(format string, a ...any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Fprintln(r.out, cyan(format, a...))
}

func (r *textRenderer) warn(format string, a ...any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Fprintln(r.err, yellow(format, a...))
}

func (r *textRenderer) success(format string, a ...any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Fprintln(r.out, green(format, a...))
}

func (r *textRenderer) OnEvent(ev domain.Event, projectRoot, fileStem string) {
	switch ev.Type {
	case "run-started":
		fmt.Fprintln(r.out, "run started")
	case "task-started":
		if data, ok := ev.Data.(map[string]string); ok {
			fmt.Fprintf(r.out, "  → %s (%s)\n", data["title"], data["taskId"])
			return
		}
		fmt.Fprintf(r.out, "  → %v\n", ev.Data)
	case "task-finished":
		fmt.Fprintln(r.out, "  ✓ done")
	case "task-failed":
		if data, ok := ev.Data.(map[string]string); ok {
			fmt.Fprintf(r.err, "  ✗ %s: %s\n", data["taskId"], data["error"])
			return
		}
		fmt.Fprintf(r.err, "  ✗ %v\n", ev.Data)
	case "visual-comparison-triggered":
		handleVisualEvent(ev, projectRoot, fileStem, r)
	case "run-finished":
		renderRunFinished(ev, r.out, r.err)
	}
}

func (r *textRenderer) OnFinish(projectRoot string, files []string) error { return nil }

// ANSI helpers mirror helpers/output.go but are local to render.go so the
// renderer doesn't depend on Printer internals. The escape sequences are
// duplicated rather than exported to avoid coupling the two packages —
// keep them in sync if either ever changes.
const (
	ransiReset  = "\033[0m"
	ransiGreen  = "\033[32m"
	ransiYellow = "\033[33m"
	ransiCyan   = "\033[36m"
)

func green(format string, a ...any) string {
	return ransiGreen + fmt.Sprintf(format, a...) + ransiReset
}
func yellow(format string, a ...any) string {
	return ransiYellow + fmt.Sprintf(format, a...) + ransiReset
}
func cyan(format string, a ...any) string { return ransiCyan + fmt.Sprintf(format, a...) + ransiReset }

// jsonRenderer streams newline-delimited JSON events to out. The Data field
// is preserved as-is so consumers can decode it into a typed shape (the
// engine's event types are documented in libs/engine/runner.go).
type jsonRenderer struct {
	out io.Writer
	mu  sync.Mutex
}

func newJSONRenderer(out io.Writer) *jsonRenderer { return &jsonRenderer{out: out} }

func (r *jsonRenderer) OnEvent(ev domain.Event, projectRoot, fileStem string) {
	envelope := map[string]any{
		"id":   ev.ID,
		"type": ev.Type,
		"file": fileStem,
		"data": ev.Data,
	}
	line, err := json.Marshal(envelope)
	if err != nil {
		// Marshal on the runner's typed data can fail if Data contains
		// unsupported types — surface as a warning line, never a hard error.
		r.mu.Lock()
		fmt.Fprintf(r.out, "{\"type\":\"__marshal_error\",\"error\":%q}\n", err.Error())
		r.mu.Unlock()
		return
	}
	r.mu.Lock()
	fmt.Fprintf(r.out, "%s\n", line)
	r.mu.Unlock()
}

func (r *jsonRenderer) OnFinish(projectRoot string, files []string) error { return nil }

// junitRenderer buffers events until OnFinish, then emits a JUnit XML report
// to out. Per the JUnit schema, each test file becomes a <testsuite> and
// each task becomes a <testcase>. Visual-comparison events don't have a
// JUnit slot, so they're ignored here — the run event itself is what the
// CI consumer cares about.
type junitRenderer struct {
	out     io.Writer
	mu      sync.Mutex
	suites  map[string]*junitSuite
	started time.Time
}

type junitSuite struct {
	name    string
	cases   []junitCase
	failed  int
	skipped int
}

type junitCase struct {
	name     string
	duration time.Duration
	failed   bool
	errMsg   string
}

func newJUnitRenderer(out io.Writer) *junitRenderer {
	return &junitRenderer{out: out, suites: map[string]*junitSuite{}, started: time.Now()}
}

func (r *junitRenderer) suiteFor(fileStem string) *junitSuite {
	if s, ok := r.suites[fileStem]; ok {
		return s
	}
	s := &junitSuite{name: fileStem}
	r.suites[fileStem] = s
	return s
}

func (r *junitRenderer) OnEvent(ev domain.Event, projectRoot, fileStem string) {
	switch ev.Type {
	case "task-started":
		if data, ok := ev.Data.(map[string]string); ok {
			r.mu.Lock()
			s := r.suiteFor(fileStem)
			s.cases = append(s.cases, junitCase{name: data["taskId"]})
			r.mu.Unlock()
		}
	case "task-finished":
		// JUnit reports pass implicitly (no <failure> child). Nothing to do.
	case "task-failed":
		if data, ok := ev.Data.(map[string]string); ok {
			r.mu.Lock()
			s := r.suiteFor(fileStem)
			// Update the last appended case to mark it failed.
			for i := len(s.cases) - 1; i >= 0; i-- {
				if s.cases[i].name == data["taskId"] {
					s.cases[i].failed = true
					s.cases[i].errMsg = data["error"]
					break
				}
			}
			s.failed++
			r.mu.Unlock()
		}
	}
}

func (r *junitRenderer) OnFinish(projectRoot string, files []string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Fprintf(r.out, `<?xml version="1.0" encoding="UTF-8"?>`+"\n")
	for _, stem := range files {
		s, ok := r.suites[stem]
		if !ok {
			continue
		}
		total := len(s.cases)
		failed := s.failed
		fmt.Fprintf(r.out,
			`<testsuite name=%q tests=%d failures=%d errors=0 time=%q>`+"\n",
			s.name, total, failed, formatSeconds(time.Since(r.started)))
		for _, c := range s.cases {
			if c.failed {
				fmt.Fprintf(r.out,
					`  <testcase name=%q><failure message=%q>%s</failure></testcase>`+"\n",
					c.name, escapeXML(c.errMsg), escapeXML(c.errMsg))
			} else {
				fmt.Fprintf(r.out, `  <testcase name=%q/>`+"\n", c.name)
			}
		}
		fmt.Fprintln(r.out, `</testsuite>`)
	}
	return nil
}

func escapeXML(s string) string {
	var b strings.Builder
	_ = xmlEscapeWriter(&b, s)
	return b.String()
}

// formatSeconds renders a duration as a seconds string with 3 decimal places
// — the JUnit schema convention. Keeps go vet happy (the literal value is a
// string, not the bare float).
func formatSeconds(d time.Duration) string {
	return fmt.Sprintf("%.3f", d.Seconds())
}

// xmlEscapeWriter is a tiny in-place escape so we don't pull in encoding/xml
// (which would also impose its own structure on the output). Sufficient for
// JUnit messages; they never carry CDATA-like payloads.
func xmlEscapeWriter(w io.Writer, s string) error {
	for _, r := range s {
		var rep string
		switch r {
		case '<':
			rep = "&lt;"
		case '>':
			rep = "&gt;"
		case '"':
			rep = "&quot;"
		case '\'':
			rep = "&apos;"
		case '&':
			rep = "&amp;"
		default:
			if _, err := fmt.Fprint(w, string(r)); err != nil {
				return err
			}
			continue
		}
		if _, err := fmt.Fprint(w, rep); err != nil {
			return err
		}
	}
	return nil
}

// renderRunFinished is shared between renderers that want a friendly summary
// line. JUnit ignores it because it doesn't render in the stream — the
// summary is implicit in the test counts of the emitted XML.
func renderRunFinished(ev domain.Event, out, err io.Writer) {
	if msg, ok := ev.Data.(string); ok {
		fmt.Fprintf(err, "run failed: %s\n", msg)
		return
	}
	if data, ok := ev.Data.(map[string]any); ok {
		fmt.Fprintf(out, "run finished: %s (%s)\n", data["status"], data["duration"])
		return
	}
	fmt.Fprintf(out, "run finished: %v\n", ev.Data)
}
