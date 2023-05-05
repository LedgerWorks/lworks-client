import {
  decodeBase64Message,
  getCompleteHCSMessageBySequenceNumber,
} from "../src/clients/hedera-mirror/hcs";
import { callMirror, getAllHCSMessages, Network, setNetwork } from "../src/index";

setNetwork(Network.Testnet);

async function main() {
  await callMirror(`/api/v1/topics/0.0.48459811/messages`).then((resp) => console.log(resp));

  const esgStandardRegistryTopicMessages = await getAllHCSMessages({ topicId: "0.0.46022543" });

  const foundMessage = esgStandardRegistryTopicMessages.find((x) =>
    decodeBase64Message(x).includes("0.0.48459815")
  );

  if (foundMessage) {
    console.log(
      await getCompleteHCSMessageBySequenceNumber({
        topicId: "0.0.46022543",
        sequenceNumber: foundMessage.sequence_number,
      })
      // Returns a string that looks like this
      // {
      //   "id": "6a2d6c25-e3dd-4efe-a780-b1b6ca6b2e84",
      //   "status": "ISSUE",
      //   "type": "Standard Registry",
      //   "action": "Initialization",
      //   "lang": "en-US",
      //   "did": "did:hedera:testnet:BasKfGc5f2UDmb55oiPYZaJqx9mdNhPBX4ctyTTntdBo;hedera:testnet:tid=0.0.48459815",
      //   "topicId": "0.0.48459815",
      //   "attributes": {
      //     "geography": "Systems Integration",
      //     "law": "ESG",
      //     "tags": "lw-1, lw-2, lw-3",
      //     "ISIC": "LDJDK"
      //   }
      // }
    );
  }
}

main().finally(() => console.log("Done with HCS Messages"));
