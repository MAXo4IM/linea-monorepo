package net.consensys.linea.ethereum.gaspricing.staticcap

import net.consensys.linea.FeeHistory
import net.consensys.linea.ethereum.gaspricing.FeesCalculator
import net.consensys.linea.ethereum.gaspricing.MinerExtraDataCalculator
import net.consensys.linea.ethereum.gaspricing.MinerExtraDataV1
import net.consensys.tokWeiUInt

class MinerExtraDataV1CalculatorImpl(
  val config: Config,
  private val variableFeesCalculator: FeesCalculator,
  private val legacyFeesCalculator: FeesCalculator
) : MinerExtraDataCalculator {

  data class Config(
    val fixedCostInKWei: UInt,
    val ethGasPriceMultiplier: Double
  )

  override fun calculateMinerExtraData(feeHistory: FeeHistory): MinerExtraDataV1 {
    val variableFees = variableFeesCalculator.calculateFees(feeHistory)
    val legacyFees = legacyFeesCalculator.calculateFees(feeHistory) * config.ethGasPriceMultiplier
    return MinerExtraDataV1(
      fixedCostInKWei = config.fixedCostInKWei,
      variableCostInKWei = variableFees.tokWeiUInt(),
      ethGasPriceInKWei = legacyFees.tokWeiUInt()
    )
  }
}
