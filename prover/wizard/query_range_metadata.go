// Code generated by bavard DO NOT EDIT

package wizard
import (
	"strconv"

	"github.com/consensys/gnark/frontend"
)

func (i *QueryRange) WithTags(tags ...string) *QueryRange {
	i.metadata.tags = append(i.metadata.tags, tags...)
	return i
}

func (i *QueryRange) WithName(name string) *QueryRange {
	i.metadata.name = name
	return i
}

func (i *QueryRange) WithDoc(doc string) *QueryRange {
	i.metadata.doc = doc
	return i
}

func (i *QueryRange) Tags() []string {
	return i.metadata.tags
}

func (i *QueryRange) ListTags() []string {
	return i.metadata.listTags()
}

func (i *QueryRange) String() string {
	return i.metadata.scope.getFullScope() + "/" + i.metadata.nameOrDefault(i) + "/" + strconv.Itoa(int(i.metadata.id))
}

func (i *QueryRange) Explain() string {
	return i.metadata.explain(i)
}
func (i *QueryRange) id() id {
	return i.metadata.id
}
// ComputeResult does not return any result for [QueryRange] because Global
// constraints do not return results as they are purely constraints that must
// be satisfied.
func (i QueryRange) ComputeResult(run Runtime) QueryResult {
	return &QueryResNone{}
}

// ComputeResult does not return any result for [QueryRange] because Global
// constraints do not return results.
func (i QueryRange) ComputeResultGnark(_ frontend.API, run GnarkRuntime) QueryResultGnark {
	return &QueryResNoneGnark{}
}
