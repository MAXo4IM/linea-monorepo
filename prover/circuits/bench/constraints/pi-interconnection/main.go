package main

import (
	"fmt"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/scs"
	"github.com/consensys/gnark/profile"
	pi_interconnection "github.com/consensys/zkevm-monorepo/prover/circuits/pi-interconnection"
	"github.com/consensys/zkevm-monorepo/prover/config"
	"github.com/consensys/zkevm-monorepo/prover/protocol/compiler/dummy"
	"github.com/consensys/zkevm-monorepo/prover/utils/test_utils"
	"github.com/stretchr/testify/assert"
)

func main() {

	fmt.Println("creating wizard circuit")

	c, err := pi_interconnection.Compile(config.PublicInput{
		MaxNbDecompression: 400,
		MaxNbExecution:     400,
		MaxNbKeccakF:       10000,
		ExecutionMaxNbMsg:  16,
		L2MsgMerkleDepth:   5,
		L2MsgMaxNbMerkle:   10,
	}, dummy.Compile) // TODO The output of this bench is not worth much until we come up with proper Wizard compilation parameters.

	var t test_utils.FakeTestingT
	assert.NoError(t, err)

	p := profile.Start(profile.WithPath("pi-interconnection.pprof"))
	_, err = frontend.Compile(ecc.BLS12_377.ScalarField(), scs.NewBuilder, c.Circuit, frontend.WithCapacity(1<<27))
	p.Stop()
	assert.NoError(t, err)
}