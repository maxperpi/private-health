import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FHEPrivateHealth, FHEPrivateHealth__factory } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Users = {
  admin: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployHealthContract() {
  const factory = (await ethers.getContractFactory("FHEPrivateHealth")) as FHEPrivateHealth__factory;
  return (await factory.deploy()) as FHEPrivateHealth;
}

describe("FHEPrivateHealth Contract", function () {
  let users: Users;
  let health: FHEPrivateHealth;

  before(async () => {
    const allSigners = await ethers.getSigners();
    users = { admin: allSigners[0], alice: allSigners[1], bob: allSigners[2], carol: allSigners[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("⚠️ Requires FHEVM mock environment");
      this.skip();
    }
    health = await deployHealthContract();
  });

  it("allows a participant to submit and decrypt their data", async () => {
    const value = 1234;
    const enc = await fhevm
      .createEncryptedInput(await health.getAddress(), users.alice.address)
      .add32(value)
      .encrypt();

    await health.connect(users.alice).submitHealthSurvey(enc.handles[0], enc.inputProof);

    expect(await health.hasSubmitted(users.alice.address)).to.be.true;

    const stored = await health.getEncryptedHealthData(users.alice.address);
    const dec = await fhevm.userDecryptEuint(FhevmType.euint32, stored, await health.getAddress(), users.alice);
    expect(dec).to.eq(value);
  });

  it("prevents duplicate submissions", async () => {
    const first = await fhevm
      .createEncryptedInput(await health.getAddress(), users.bob.address)
      .add32(1111)
      .encrypt();
    await health.connect(users.bob).submitHealthSurvey(first.handles[0], first.inputProof);

    const second = await fhevm
      .createEncryptedInput(await health.getAddress(), users.bob.address)
      .add32(2222)
      .encrypt();
    await expect(health.connect(users.bob).submitHealthSurvey(second.handles[0], second.inputProof)).to.be.revertedWith(
      "Submission already exists",
    );
  });

  it("allows multiple participants independently", async () => {
    const encAlice = await fhevm
      .createEncryptedInput(await health.getAddress(), users.alice.address)
      .add32(1010)
      .encrypt();
    const encBob = await fhevm
      .createEncryptedInput(await health.getAddress(), users.bob.address)
      .add32(2020)
      .encrypt();

    await health.connect(users.alice).submitHealthSurvey(encAlice.handles[0], encAlice.inputProof);
    await health.connect(users.bob).submitHealthSurvey(encBob.handles[0], encBob.inputProof);

    const decAlice = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await health.getEncryptedHealthData(users.alice.address),
      await health.getAddress(),
      users.alice,
    );
    const decBob = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await health.getEncryptedHealthData(users.bob.address),
      await health.getAddress(),
      users.bob,
    );

    expect(decAlice).to.eq(1010);
    expect(decBob).to.eq(2020);
  });

  it("ensures different ciphertexts for same value from different users", async () => {
    const val = 5555;
    const enc1 = await fhevm
      .createEncryptedInput(await health.getAddress(), users.alice.address)
      .add32(val)
      .encrypt();
    const enc2 = await fhevm
      .createEncryptedInput(await health.getAddress(), users.bob.address)
      .add32(val)
      .encrypt();

    await health.connect(users.alice).submitHealthSurvey(enc1.handles[0], enc1.inputProof);
    await health.connect(users.bob).submitHealthSurvey(enc2.handles[0], enc2.inputProof);

    const stored1 = await health.getEncryptedHealthData(users.alice.address);
    const stored2 = await health.getEncryptedHealthData(users.bob.address);

    expect(stored1).to.not.eq(stored2);
  });

  it("returns false for non-submitters", async () => {
    expect(await health.hasSubmitted(users.carol.address)).to.be.false;
  });

  // --- New test cases ---
  it("handles edge case: value 0", async () => {
    const enc = await fhevm
      .createEncryptedInput(await health.getAddress(), users.carol.address)
      .add32(0)
      .encrypt();
    await health.connect(users.carol).submitHealthSurvey(enc.handles[0], enc.inputProof);

    const dec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await health.getEncryptedHealthData(users.carol.address),
      await health.getAddress(),
      users.carol,
    );
    expect(dec).to.eq(0);
  });

  it("handles edge case: max uint32", async () => {
    const max = 2 ** 32 - 1;
    const enc = await fhevm
      .createEncryptedInput(await health.getAddress(), users.carol.address)
      .add32(max)
      .encrypt();
    await health.connect(users.carol).submitHealthSurvey(enc.handles[0], enc.inputProof);

    const dec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await health.getEncryptedHealthData(users.carol.address),
      await health.getAddress(),
      users.carol,
    );
    expect(dec).to.eq(max);
  });

  it("multiple users submit sequentially", async () => {
    const values = [100, 200, 300];
    const userList = [users.alice, users.bob, users.carol];

    for (let i = 0; i < values.length; i++) {
      const enc = await fhevm
        .createEncryptedInput(await health.getAddress(), userList[i].address)
        .add32(values[i])
        .encrypt();
      await health.connect(userList[i]).submitHealthSurvey(enc.handles[0], enc.inputProof);

      const dec = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        await health.getEncryptedHealthData(userList[i].address),
        await health.getAddress(),
        userList[i],
      );
      expect(dec).to.eq(values[i]);
    }
  });
});
