package build.linea.clients

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.github.michaelbull.result.Err
import com.github.michaelbull.result.Ok
import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.client.WireMock.containing
import com.github.tomakehurst.wiremock.client.WireMock.ok
import com.github.tomakehurst.wiremock.client.WireMock.post
import com.github.tomakehurst.wiremock.core.WireMockConfiguration.options
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.vertx.core.Vertx
import io.vertx.core.json.JsonObject
import io.vertx.junit5.VertxExtension
import net.consensys.fromHexString
import net.consensys.linea.BlockInterval
import net.consensys.linea.async.get
import net.consensys.linea.errors.ErrorResponse
import net.consensys.linea.jsonrpc.client.RequestRetryConfig
import net.consensys.linea.jsonrpc.client.VertxHttpJsonRpcClientFactory
import net.consensys.zkevm.coordinator.clients.GetZkEVMStateMerkleProofResponse
import net.consensys.zkevm.coordinator.clients.StateManagerErrorType
import org.apache.tuweni.bytes.Bytes32
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.net.URI
import java.nio.file.Path
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

@ExtendWith(VertxExtension::class)
class StateManagerV1JsonRpcClientTest {
  private lateinit var wiremock: WireMockServer
  private lateinit var stateManagerClient: StateManagerV1JsonRpcClient
  private lateinit var meterRegistry: SimpleMeterRegistry

  private fun wiremockStubForPost(response: JsonObject) = wiremockStubForPost(response.toString())
  private fun wiremockStubForPost(response: String) {
    wiremock.stubFor(
      post("/")
        .withHeader("Content-Type", containing("application/json"))
        .willReturn(
          ok()
            .withHeader("Content-type", "application/json")
            .withBody(response.toByteArray())
        )
    )
  }

  @BeforeEach
  fun setup(vertx: Vertx) {
    wiremock = WireMockServer(options().dynamicPort())
    wiremock.start()
    meterRegistry = SimpleMeterRegistry()

    val rpcClientFactory = VertxHttpJsonRpcClientFactory(vertx, meterRegistry)
    val vertxHttpJsonRpcClient = rpcClientFactory.createWithRetries(
      URI("http://127.0.0.1:" + wiremock.port()).toURL(),
      methodsToRetry = StateManagerV1JsonRpcClient.retryableMethods,
      retryConfig = RequestRetryConfig(
        maxRetries = 2u,
        timeout = 2.seconds,
        10.milliseconds,
        1u
      )
    )
    val clientConfig = StateManagerV1JsonRpcClient.Config(
      requestRetry = RequestRetryConfig(
        maxRetries = 1u,
        backoffDelay = 10.milliseconds
      ),
      zkStateManagerVersion = "0.0.1-dev-3e607237"
    )
    stateManagerClient =
      StateManagerV1JsonRpcClient(
        vertxHttpJsonRpcClient,
        clientConfig
      )
  }

  @AfterEach
  fun tearDown(vertx: Vertx) {
    val vertxStopFuture = vertx.close()
    wiremock.stop()
    vertxStopFuture.get()
  }

  @Test
  fun getZkEVMStateMerkleProof_success() {
    val testFilePath = "../../../testdata/type2state-manager/state-proof.json"
    val json = jacksonObjectMapper().readTree(Path.of(testFilePath).toFile())
    val zkStateManagerVersion = json.get("zkStateManagerVersion").asText()
    val zkStateMerkleProof = json.get("zkStateMerkleProof") as ArrayNode
    val zkParentStateRootHash = json.get("zkParentStateRootHash").asText()
    val zkEndStateRootHash = json.get("zkEndStateRootHash").asText()
    val startBlockNumber = 50UL
    val endBlockNumber = 100UL

    val response =
      JsonObject.of(
        "jsonrpc",
        "2.0",
        "id",
        "1",
        "result",
        mapOf(
          "zkParentStateRootHash" to zkParentStateRootHash,
          "zkEndStateRootHash" to zkEndStateRootHash,
          "zkStateMerkleProof" to zkStateMerkleProof,
          "zkStateManagerVersion" to zkStateManagerVersion
        )
      )

    wiremockStubForPost(response)

    val resultFuture = stateManagerClient
      .rollupGetStateMerkleProofWithTypedError(BlockInterval(startBlockNumber, endBlockNumber))
    resultFuture.get()

    assertThat(resultFuture)
      .isCompletedWithValue(
        Ok(
          GetZkEVMStateMerkleProofResponse(
            zkStateManagerVersion = zkStateManagerVersion,
            zkStateMerkleProof = zkStateMerkleProof,
            zkParentStateRootHash = Bytes32.fromHexString(zkParentStateRootHash),
            zkEndStateRootHash = Bytes32.fromHexString(zkEndStateRootHash)
          )
        )
      )
  }

  @Test
  fun getZkEVMStateMerkleProof_error_block_missing() {
    val errorMessage = "BLOCK_MISSING_IN_CHAIN - block 1 is missing"
    val startBlockNumber = 50UL
    val endBlockNumber = 100UL

    val response =
      JsonObject.of(
        "jsonrpc",
        "2.0",
        "id",
        "1",
        "error",
        mapOf("code" to "-32600", "message" to errorMessage)
      )

    wiremockStubForPost(response)

    val resultFuture =
      stateManagerClient.rollupGetStateMerkleProofWithTypedError(
        BlockInterval(
          startBlockNumber,
          endBlockNumber
        )
      )
    resultFuture.get()

    assertThat(resultFuture)
      .isCompletedWithValue(
        Err(ErrorResponse(StateManagerErrorType.BLOCK_MISSING_IN_CHAIN, errorMessage))
      )
  }

  @Test
  fun getZkEVMStateMerkleProof_error_unsupported_version() {
    val startBlockNumber = 50UL
    val endBlockNumber = 100UL
    val errorMessage = "UNSUPPORTED_VERSION"
    val errorData =
      mapOf(
        "requestedVersion" to "0.0.1-dev-3e607217",
        "supportedVersion" to "0.0.1-dev-3e607237"
      )

    val response =
      JsonObject.of(
        "jsonrpc",
        "2.0",
        "id",
        "1",
        "error",
        mapOf("code" to "-32602", "message" to errorMessage, "data" to errorData)
      )

    wiremockStubForPost(response)

    val resultFuture =
      stateManagerClient.rollupGetStateMerkleProofWithTypedError(
        BlockInterval(startBlockNumber, endBlockNumber)
      )
    resultFuture.get()

    assertThat(resultFuture)
      .isCompletedWithValue(
        Err(
          ErrorResponse(
            StateManagerErrorType.UNSUPPORTED_VERSION,
            "$errorMessage: $errorData"
          )
        )
      )
  }

  @Test
  fun getZkEVMStateMerkleProof_error_unknown() {
    val startBlockNumber = 50L
    val endBlockNumber = 100L
    val errorMessage = "BRA_BRA_BRA_SOME_UNKNOWN_ERROR"
    val errorData = mapOf("xyz" to "1234", "abc" to 100L)

    val response =
      JsonObject.of(
        "jsonrpc",
        "2.0",
        "id",
        "1",
        "error",
        mapOf("code" to "-999", "message" to errorMessage, "data" to errorData)
      )

    wiremockStubForPost(response)

    val resultFuture =
      stateManagerClient.rollupGetStateMerkleProofWithTypedError(
        BlockInterval(startBlockNumber, endBlockNumber)
      )
    resultFuture.get()

    assertThat(resultFuture)
      .isCompletedWithValue(
        Err(ErrorResponse(StateManagerErrorType.UNKNOWN, "$errorMessage: $errorData"))
      )
  }

  @Test
  fun rollupGetHeadBlockNumber_success_response() {
    val response = """{"jsonrpc":"2.0","id":1,"result":"0xf1"}"""

    wiremockStubForPost(response)

    assertThat(stateManagerClient.rollupGetHeadBlockNumber().get())
      .isEqualTo(ULong.fromHexString("0xf1"))
  }

  @Test
  fun rollupGetHeadBlockNumber_error_response() {
    val response = """{"jsonrpc":"2.0","id":1,"error":{"code": -32603, "message": "Internal error"}}"""

    wiremockStubForPost(response)

    assertThatThrownBy { stateManagerClient.rollupGetHeadBlockNumber().get() }
      .hasMessageContaining("Internal error")
  }
}