package helpers

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"
)

// FlagSpec tells the parser which CLI flags a command accepts.
type FlagSpec struct {
	Name     string
	Alias    string
	HasValue bool
	Required bool
}

// FlagBinding ties a FlagSpec list to a typed Flags struct. The parser fills the struct via
// reflection, then calls Validate() on it so the command's own rules run.
type FlagBinding struct {
	Specs []FlagSpec
	New   func() Flags
}

// Flags is the interface every per-command flags struct implements.
type Flags interface {
	Validate() error
}

// Parse fills the binding's Flags struct from args. Unknown flags and missing required
// flags error. After binding, Parse calls flags.Validate() so struct-tag rules run.
func Parse(args []string, binding FlagBinding) (Flags, error) {
	flags := binding.New()
	byName := indexSpecs(binding.Specs)
	consumed := map[string]bool{}
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if !strings.HasPrefix(arg, "-") {
			return nil, fmt.Errorf("unexpected positional argument: %s", arg)
		}
		name := strings.TrimLeft(arg, "-")
		var value string
		hasInlineValue := false
		if eq := strings.Index(name, "="); eq >= 0 {
			value = name[eq+1:]
			name = name[:eq]
			hasInlineValue = true
		}
		spec, ok := byName[name]
		if !ok {
			return nil, fmt.Errorf("unknown flag: --%s", name)
		}
		switch {
		case spec.HasValue && hasInlineValue:
		case !spec.HasValue && hasInlineValue:
			return nil, fmt.Errorf("--%s does not take a value", spec.Name)
		case spec.HasValue:
			if i+1 >= len(args) {
				return nil, fmt.Errorf("--%s requires a value", spec.Name)
			}
			i++
			value = args[i]
		default:
			value = "true"
		}
		if err := setFlag(flags, spec.Name, value); err != nil {
			return nil, err
		}
		consumed[spec.Name] = true
	}
	for _, spec := range binding.Specs {
		if spec.Required && !consumed[spec.Name] {
			return nil, fmt.Errorf("--%s is required", spec.Name)
		}
	}
	if err := flags.Validate(); err != nil {
		return nil, err
	}
	return flags, nil
}

func indexSpecs(specs []FlagSpec) map[string]*FlagSpec {
	byName := make(map[string]*FlagSpec, len(specs)*2)
	for i := range specs {
		spec := &specs[i]
		byName[spec.Name] = spec
		if spec.Alias != "" {
			byName[spec.Alias] = spec
		}
	}
	return byName
}

func setFlag(flags Flags, name, value string) error {
	v := reflect.ValueOf(flags).Elem()
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if field.Tag.Get("flag") != name {
			continue
		}
		return setField(v.Field(i), value)
	}
	return fmt.Errorf("flag %q has no matching struct field", name)
}

func setField(field reflect.Value, value string) error {
	if !field.CanSet() {
		return fmt.Errorf("flag field is not settable")
	}
	switch field.Kind() {
	case reflect.String:
		field.SetString(value)
	case reflect.Bool:
		b, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid bool value %q: %w", value, err)
		}
		field.SetBool(b)
	default:
		return fmt.Errorf("unsupported flag field type: %s", field.Kind())
	}
	return nil
}

// validate is the shared *validator.Validate instance. Package-private — commands reach it
// through ValidateStruct below. Named "validate" (not "validator") to avoid colliding with
// the imported package name.
var validate = validator.New(validator.WithRequiredStructEnabled())

// ValidateStruct runs the shared validator against s. Per-command flag structs call this
// from their Validate() method so struct-tag rules run.
func ValidateStruct(s interface{}) error {
	return validate.Struct(s)
}
