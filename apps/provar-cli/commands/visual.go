package commands

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// visualDir is the project-relative directory where current-run screenshots
// are written. Each .test.yml gets its own subdirectory so concurrent runs of
// different tests don't trample each other's images.
const visualDir = ".provar/visual"

// baselinesDir is the project-relative directory where accepted baselines
// live. Same per-file layout as visualDir so saveBaseline can copy 1:1.
const baselinesDir = ".provar/baselines"

// visualResult describes the outcome of comparing a fresh screenshot against
// its baseline. Used by run.go to surface visual regressions to the user
// without failing the run outright (visual diffs are info-only by default —
// failing them belongs in a future --strict-visual flag).
type visualResult int

const (
	visualFirstRun visualResult = iota // no baseline yet — saved as current only
	visualMatch                        // bytes identical to baseline
	visualDiff                         // bytes differ from baseline
)

// visualRecord is what renderEvent needs to act on the visual-comparison
// event: the per-file bucket the screenshot belongs to, the step ID, and the
// base64-encoded PNG bytes. The runner already emits these fields on the
// event — see libs/engine/runner.go.
type visualRecord struct {
	fileStem string // basename of the .test.yml without extension
	stepID   string
	pngB64   string
}

// visualPath returns where the current-run screenshot for a (file, step)
// pair should be saved under the project root. Caller is responsible for
// creating the parent directory.
func visualPath(projectRoot, fileStem, stepID string) string {
	return filepath.Join(projectRoot, visualDir, fileStem, stepID+".png")
}

// baselinePath returns where the accepted baseline for a (file, step) pair
// lives under the project root. Missing baselines are not an error — the
// caller treats them as "first run, no comparison".
func baselinePath(projectRoot, fileStem, stepID string) string {
	return filepath.Join(projectRoot, baselinesDir, fileStem, stepID+".png")
}

// saveScreenshot decodes a base64 PNG and writes it to visualPath. Returns
// the absolute path of the saved file so the caller can print it.
func saveScreenshot(projectRoot, fileStem, stepID, pngB64 string) (string, error) {
	png, err := base64.StdEncoding.DecodeString(pngB64)
	if err != nil {
		return "", fmt.Errorf("decode screenshot for %s/%s: %w", fileStem, stepID, err)
	}
	dst := visualPath(projectRoot, fileStem, stepID)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", fmt.Errorf("create visual dir for %s: %w", fileStem, err)
	}
	if err := os.WriteFile(dst, png, 0o644); err != nil {
		return "", fmt.Errorf("write screenshot to %s: %w", dst, err)
	}
	return dst, nil
}

// compareToBaseline hashes the just-saved screenshot and compares against
// the baseline hash. Returns visualMatch if identical, visualDiff if they
// differ, visualFirstRun if no baseline exists yet.
func compareToBaseline(projectRoot, fileStem, stepID string, png []byte) visualResult {
	baseline := baselinePath(projectRoot, fileStem, stepID)
	bh, err := os.ReadFile(baseline)
	if err != nil {
		return visualFirstRun
	}
	h1 := sha256.Sum256(png)
	h2 := sha256.Sum256(bh)
	if h1 == h2 {
		return visualMatch
	}
	return visualDiff
}

// acceptBaselines promotes the current-run screenshots for fileStem to the
// baselines directory, copying bytes only (no decode). Steps that didn't
// produce a screenshot on this run are left untouched — the existing baseline
// (if any) stays in place so the user can accept incrementally.
func acceptBaselines(projectRoot, fileStem string) (copied int, err error) {
	src := filepath.Join(projectRoot, visualDir, fileStem)
	dst := filepath.Join(projectRoot, baselinesDir, fileStem)
	if _, err := os.Stat(src); err != nil {
		if os.IsNotExist(err) {
			return 0, fmt.Errorf("no current screenshots for %s — run provar run first", fileStem)
		}
		return 0, err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return 0, err
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".png" {
			continue
		}
		from, err := os.Open(filepath.Join(src, e.Name()))
		if err != nil {
			return copied, err
		}
		to, err := os.Create(filepath.Join(dst, e.Name()))
		if err != nil {
			from.Close()
			return copied, err
		}
		_, copyErr := io.Copy(to, from)
		from.Close()
		to.Close()
		if copyErr != nil {
			return copied, copyErr
		}
		copied++
	}
	return copied, nil
}

// formatVisualHash returns the short hex form of sha256(png) for human-readable
// diff messages. Pure helper so renderEvent stays free of crypto details.
func formatVisualHash(png []byte) string {
	sum := sha256.Sum256(png)
	return hex.EncodeToString(sum[:])[:12]
}
