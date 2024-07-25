package wizard

import (
	"fmt"

	"github.com/consensys/gnark/frontend"
	"github.com/consensys/zkevm-monorepo/prover/maths/common/smartvectors"
	"github.com/consensys/zkevm-monorepo/prover/maths/field"
	"github.com/consensys/zkevm-monorepo/prover/utils"
)

// QueryInclusion describes an inclusion query (a.k.a. a lookup constraint). The
// query can feature conditional “included" tables and conditional “including"
// tables. The query can additionally feature an fragmented table meaning that
// the including “table" to consider is the union of two tables.
type QueryInclusion struct {
	// Included represents the table over which the constraint applies. The
	// columns must be a non-zero collection of columns of the same size.
	Included []Column
	// Including represents the reference table of the inclusion constraint. It
	// stores all the values that the “including" table is required to store.
	// The table must be a non-zero collection of columns of the same size.
	//
	// Including can also represent a fragmented table. In that case, the double
	// slice is indexed as [fragment][column]. In the non-fragmented case, the
	// slice is as if there is only a single fragment
	Including [][]Column
	// IncludedFilter is (allegedly) a binary-assigned column specifying
	// with a one whether the corresponding row of the “included" is subjected
	// to the constraint and with a 0 whether the row is disregarded.
	IncludedFilter Column
	// IncludingFilter is (allegedly) a binary-assigned column specifying
	// with a one whether a row of the including “table" is allowed and with a
	// 0 whether the corresponding row is forbidden.
	//
	// The slices is indexed per number of fragment, in the non-fragmented case,
	// consider there is only a single segment.
	IncludingFilter []Column

	metadata *metadata
	*subQuery
}

// NewInclusion constructs an inclusion. Will panic if it is mal-formed
func (api *API) NewInclusion(
	included []Column,
	including [][]Column,
	includedFilter Column,
	includingFilter []Column,
) *QueryInclusion {

	if len(included) == 0 {
		utils.Panic("the included table has no columns")
	}

	if len(including) == 0 {
		utils.Panic("no including fragments were provided")
	}

	// This works because we already tested that both sides have the same number of columns
	var (
		nCol  = len(included)
		round = 0
	)

	for frag := range including {

		for _, c := range including[frag] {
			round = max(round, c.Round())
		}

		if len(including[frag]) != nCol {
			utils.Panic(
				"Table(T)[fragment=%v] and lookups(S) don't have the same number of columns %v %v",
				frag, len(including[frag]), len(included))
		}

		// All columns of including must have the same MaxSize
		if _, err := utils.AllReturnEqual(Column.Size, including[frag]); err != nil {
			utils.Panic(
				"The fragment %v of the including table is malformed, all columns must have the same length: %v",
				frag, err.Error(),
			)
		}

		// Checks on filters, and the including filter size
		if includingFilter != nil {
			for _, c := range includingFilter {
				round = max(round, c.Round())
			}

			if includingFilter[frag].Size() != including[frag][0].Size() {
				utils.Panic(
					"the fragment of the including fragment #%v does not have the same size (%v) as the table fragment it is refering to (%v)",
					frag, includingFilter[frag].Size(), including[frag][0].Size(),
				)
			}
		}
	}

	// Same thing for included
	if _, err := utils.AllReturnEqual(Column.Size, included); err != nil {
		utils.Panic("The included table is malformed, all columns must have the same length: %v", err.Error())
	}

	for _, c := range included {
		round = max(round, c.Round())
	}

	// Checks on filters, and the included filter size
	if includedFilter != nil {
		round = max(round, includedFilter.Round())

		if includedFilter.Size() != included[0].Size() {
			utils.Panic(
				"the included filter (size=%v) does not have the same size as the table it is refering to (size=%v)",
				includedFilter.Size(), included[0].Size(),
			)
		}
	}

	res := &QueryInclusion{
		Included:        included,
		Including:       including,
		IncludedFilter:  includedFilter,
		IncludingFilter: includingFilter,
		metadata:        api.newMetadata(),
		subQuery: &subQuery{
			round: round,
		},
	}

	api.queries.addToRound(round, res)
	return res
}

// IsFilteredOnIncluding returns true if the table is filtered on the included
// side of the table.
func (r QueryInclusion) IsFilteredOnIncluding() bool {
	return r.IncludingFilter != nil
}

// IsFilteredOnIncluded returns true if the table is filtered on the including
// side of the table
func (r QueryInclusion) IsFilteredOnIncluded() bool {
	return r.IncludedFilter != nil
}

// Check implements the [Query] interface
func (r QueryInclusion) Check(run Runtime) error {

	including := make([][]smartvectors.SmartVector, len(r.Including))
	included := make([]smartvectors.SmartVector, len(r.Included))

	// Populate the `including`
	for frag := range r.Including {
		including[frag] = make([]smartvectors.SmartVector, len(r.Including[frag]))
		for i, pol := range r.Including[frag] {
			including[frag][i] = pol.GetAssignment(run)
		}
	}

	// Populate the included
	for i, pol := range r.Included {
		included[i] = pol.GetAssignment(run)
	}

	// Populate Filters
	var (
		filterIncluding []smartvectors.SmartVector
		filterIncluded  smartvectors.SmartVector
	)

	if r.IsFilteredOnIncluding() {
		filterIncluding = make([]smartvectors.SmartVector, len(r.IncludingFilter))
		for frag := range r.IncludingFilter {
			filterIncluding[frag] = r.IncludingFilter[frag].GetAssignment(run)
		}
	}

	if r.IsFilteredOnIncluded() {
		filterIncluded = r.IncludedFilter.GetAssignment(run)
	}

	/*
		Sample a random element alpha, usefull for multivalued inclusion checks
		It allows to reference multiple number through a linear combination
	*/
	var alpha field.Element
	_, err := alpha.SetRandom()
	if err != nil {
		// Cannot happen unless the entropy was exhausted
		panic(err)
	}

	// Gather the elements of including in a set. Randomly combining the columns
	// so that the rows can be summed up by a single field element, easier to
	// look up in the map.
	inclusionSet := make(map[field.Element]struct{})
	for frag := range r.Including {
		for row := 0; row < r.Including[frag][0].Size(); row++ {
			if !r.IsFilteredOnIncluding() || filterIncluding[frag].Get(row) == field.One() {
				rand := rowLinComb(alpha, row, including[frag])
				inclusionSet[rand] = struct{}{}
			}
		}
	}

	// Effectively run the check on the included table
	for row := 0; row < r.Included[0].Size(); row++ {
		if r.IsFilteredOnIncluded() && filterIncluded.Get(row) == field.Zero() {
			continue
		}

		rand := rowLinComb(alpha, row, included)
		if _, ok := inclusionSet[rand]; !ok {
			notFoundRow := []string{}
			for c := range included {
				x := included[c].Get(row)
				notFoundRow = append(notFoundRow, fmt.Sprintf("%v=%v", r.Included[c].String(), x.String()))
			}
			return fmt.Errorf("row %v was not found in the `including` table : %v", row, notFoundRow)
		}
	}

	return nil
}

// GnarkCheck implements the [Query] interface. It will panic in this
// construction because we do not have a good way to check the query within a
// circuit
func (i QueryInclusion) CheckGnark(api frontend.API, run GnarkRuntime) {
	panic("UNSUPPORTED : can't check an inclusion query directly into the circuit")
}
