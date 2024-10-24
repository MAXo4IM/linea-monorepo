import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BridgedToken, UpgradedBridgedToken } from "../../typechain-types";

const initialUserBalance = 10000;

async function createTokenBeaconProxy() {
  const [admin, unknown] = await ethers.getSigners();

  const bridgedTokenFactory = await ethers.getContractFactory("BridgedToken");

  // Deploy token beacon (only one beacon if both serve the same purpose)
  const l1TokenBeacon = await upgrades.deployBeacon(bridgedTokenFactory);
  await l1TokenBeacon.deployed();

  const l2TokenBeacon = await upgrades.deployBeacon(bridgedTokenFactory);
  await l2TokenBeacon.deployed();

  // Create tokens
  const abcToken = (await upgrades.deployBeaconProxy(l1TokenBeacon.address, bridgedTokenFactory, [
    "AbcToken",
    "ABC",
    18,
  ])) as BridgedToken;

  const sixDecimalsToken = (await upgrades.deployBeaconProxy(l1TokenBeacon.address, bridgedTokenFactory, [
    "sixDecimalsToken",
    "SIX",
    6,
  ])) as BridgedToken;

  // Create a new token implementation
  const upgradedBridgedTokenFactory = await ethers.getContractFactory("UpgradedBridgedToken");
  const newImplementation = await upgradedBridgedTokenFactory.deploy();
  await newImplementation.deployed();

  // Update l2TokenBeacon with new implementation
  await l2TokenBeacon.connect(admin).upgradeTo(newImplementation.address);

  // Set initial balance
  await sixDecimalsToken.connect(admin).mint(unknown.address, initialUserBalance);

  return {
    admin,
    unknown,
    l1TokenBeacon,
    l2TokenBeacon,
    newImplementation,
    upgradedBridgedTokenFactory,
    abcToken,
    sixDecimalsToken,
  };
}

describe("BridgedToken", function () {
  it("Should deploy BridgedToken", async function () {
    const { abcToken, sixDecimalsToken } = await loadFixture(createTokenBeaconProxy);
    expect(await abcToken.address).to.be.not.null;
    expect(await sixDecimalsToken.address).to.be.not.null;
  });

  it("Should set the right metadata", async function () {
    const { abcToken, sixDecimalsToken } = await loadFixture(createTokenBeaconProxy);
    expect(await abcToken.name()).to.be.equal("AbcToken");
    expect(await abcToken.symbol()).to.be.equal("ABC");
    expect(await abcToken.decimals()).to.be.equal(18);
    expect(await sixDecimalsToken.name()).to.be.equal("sixDecimalsToken");
    expect(await sixDecimalsToken.symbol()).to.be.equal("SIX");
    expect(await sixDecimalsToken.decimals()).to.be.equal(6);
  });

  it("Should mint tokens", async function () {
    const { admin, unknown, abcToken } = await loadFixture(createTokenBeaconProxy);
    const amount = 100;
    await abcToken.connect(admin).mint(unknown.address, amount);
    expect(await abcToken.balanceOf(unknown.address)).to.be.equal(amount);
  });

  it("Should burn tokens", async function () {
    const { admin, unknown, sixDecimalsToken } = await loadFixture(createTokenBeaconProxy);
    const amount = 100;
    await sixDecimalsToken.connect(unknown).approve(admin.address, amount);
    await sixDecimalsToken.connect(admin).burn(unknown.address, amount);
    expect(await sixDecimalsToken.balanceOf(unknown.address)).to.be.equal(initialUserBalance - amount);
  });

  it("Should revert if mint/burn are called by an unknown address", async function () {
    const { unknown, abcToken } = await loadFixture(createTokenBeaconProxy);
    const amount = 100;
    await expect(abcToken.connect(unknown).mint(unknown.address, amount)).to.be.revertedWithCustomError(
      abcToken,
      "OnlyBridge"
    );
    await expect(abcToken.connect(unknown).burn(unknown.address, amount)).to.be.revertedWithCustomError(
      abcToken,
      "OnlyBridge"
    );
  });
});

describe("BeaconProxy", function () {
  it("Should enable upgrade of existing beacon proxy", async function () {
    const { admin, l1TokenBeacon, abcToken, newImplementation, upgradedBridgedTokenFactory } =
      await loadFixture(createTokenBeaconProxy);

    await l1TokenBeacon.connect(admin).upgradeTo(newImplementation.address);
    expect(await l1TokenBeacon.implementation()).to.be.equal(newImplementation.address);

    const upgradedToken = upgradedBridgedTokenFactory.attach(abcToken.address) as UpgradedBridgedToken;
    expect(await upgradedToken.isUpgraded()).to.be.equal(true);
  });

  it("Should deploy new beacon proxy with the updated implementation", async function () {
    const { l2TokenBeacon, upgradedBridgedTokenFactory } = await loadFixture(createTokenBeaconProxy);
    const newTokenBeaconProxy = await upgrades.deployBeaconProxy(
      l2TokenBeacon.address,
      upgradedBridgedTokenFactory,
      ["NAME", "SYMBOL", 18] // Decimals
    );
    const upgradedToken = upgradedBridgedTokenFactory.attach(newTokenBeaconProxy.address) as UpgradedBridgedToken;
    expect(await upgradedToken.isUpgraded()).to.be.equal(true);
  });

  it("Beacon upgrade should only be done by the owner", async function () {
    const { unknown, l1TokenBeacon, newImplementation } = await loadFixture(createTokenBeaconProxy);
    await expect(l1TokenBeacon.connect(unknown).upgradeTo(newImplementation.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });
});
